import { PublicKey } from "@solana/web3.js";
import { runClaimReview, sha256Hex } from "@/lib/ai/agent";
import { decisionToU8, riskToU8 } from "@/lib/ai/types";
import { ARBITER } from "@/lib/findback/config";
import { fetchBounty, recordAiReviewOnChain } from "@/lib/findback/program";
import {
  ApiError,
  apiErrorResponse,
  enforceRateLimit,
  requireApiUser,
  requireSameOrigin,
} from "@/lib/server/api-security";
import { keypairWallet, loadServerKeypair } from "@/lib/server/solana-signer";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MAX_IMAGE = 1_200_000;

export async function POST(req: Request) {
  try {
    requireSameOrigin(req);
    const user = await requireApiUser();
    enforceRateLimit(`ai-review:${user.id}`, { limit: 8, windowMs: 10 * 60_000 });

    const body = (await req.json()) as {
      bountyId?: string;
    };
    const bountyId = body.bountyId?.trim() || "";
    if (!bountyId) throw new ApiError(400, "Thiếu mã bounty.");

    const admin = createAdminClient();
    const [
      { data: profile, error: profileError },
      { data: listing, error: listingError },
      { data: claim, error: claimError },
    ] =
      await Promise.all([
        admin
          .from("profiles")
          .select("wallet_pubkey,wallet_verified_at")
          .eq("id", user.id)
          .maybeSingle(),
        admin.from("bounties").select("*").eq("id", bountyId).maybeSingle(),
        admin.from("claims").select("*").eq("bounty_id", bountyId).maybeSingle(),
      ]);
    if (profileError) throw new Error(profileError.message);
    if (listingError) throw new Error(listingError.message);
    if (claimError) throw new Error(claimError.message);
    if (!profile?.wallet_pubkey || !profile.wallet_verified_at) {
      throw new ApiError(403, "Hãy xác minh ví trước khi yêu cầu đánh giá.");
    }
    if (!listing) throw new ApiError(404, "Không tìm thấy bounty.");
    if (!claim) throw new ApiError(404, "Không tìm thấy bằng chứng đã lưu.");

    const onchain = await fetchBounty(bountyId);
    if (!onchain) throw new ApiError(404, "Bounty chưa tồn tại trên Devnet.");
    if (onchain.finder !== profile.wallet_pubkey) {
      throw new ApiError(403, "Ví đã xác minh không phải finder của claim này.");
    }
    if (claim.finder_id !== user.id || claim.finder_wallet !== onchain.finder) {
      throw new ApiError(409, "Người gửi bằng chứng không khớp dữ liệu on-chain.");
    }
    if (Buffer.from(onchain.evidenceHash).toString("hex") !== claim.evidence_hash) {
      throw new ApiError(409, "Hash bằng chứng trong Supabase không khớp Devnet.");
    }
    if (!new PublicKey(onchain.arbiter).equals(new PublicKey(ARBITER))) {
      throw new ApiError(409, "Bounty dùng arbiter khác với cấu hình máy chủ.");
    }
    if (!['ClaimSubmitted', 'AiReviewed'].includes(onchain.status)) {
      throw new ApiError(409, "Claim chưa ở trạng thái có thể đánh giá.");
    }
    if (!(process.env.OPENAI_API_KEY || process.env.FIND_BACK_AI_KEY)) {
      throw new ApiError(503, "AI trực tuyến chưa được cấu hình trên máy chủ.");
    }

    if (claim.image_data && String(claim.image_data).length > MAX_IMAGE) {
      throw new ApiError(409, "Ảnh bằng chứng đã lưu vượt giới hạn xử lý.");
    }

    const report = await runClaimReview({
      ownerTitle: String(listing.title).slice(0, 200),
      ownerDescription: String(listing.description || "").slice(0, 2000),
      ownerCategory: String(listing.category || "").slice(0, 80),
      ownerLocation: String(listing.location || "").slice(0, 200),
      ownerImageDataUrl: listing.image_path as string | null,
      finderDescription: String(claim.description).slice(0, 2000),
      finderLocation: String(claim.location || "").slice(0, 200),
      finderFoundAt: String(claim.found_at || "").slice(0, 80),
      finderImageDataUrl: claim.image_data as string | null,
      bountyId,
    });

    const explanationHashHex = await sha256Hex(JSON.stringify(report));
    const signer = loadServerKeypair();
    if (signer.publicKey.toBase58() !== onchain.arbiter) {
      throw new ApiError(503, "Khóa arbiter trên máy chủ không khớp bounty.");
    }
    const reviewTx = await recordAiReviewOnChain(keypairWallet(signer), bountyId, {
      score: report.score,
      riskLevel: riskToU8(report),
      decision: decisionToU8(report.decision),
      explanationHash: Uint8Array.from(Buffer.from(explanationHashHex, "hex")),
    });

    const updatedAt = new Date().toISOString();
    const [{ error: claimUpdateError }, { error: bountyUpdateError }] =
      await Promise.all([
        admin
          .from("claims")
          .update({
            ai_report: report,
            status: "ai_reviewed",
            last_tx: reviewTx.signature,
            last_tx_url: reviewTx.url,
            updated_at: updatedAt,
          })
          .eq("bounty_id", bountyId),
        admin
          .from("bounties")
          .update({
            status: "ai_reviewed",
            last_tx: reviewTx.signature,
            last_tx_url: reviewTx.url,
            updated_at: updatedAt,
          })
          .eq("id", bountyId),
      ]);
    if (claimUpdateError) throw new Error(claimUpdateError.message);
    if (bountyUpdateError) throw new Error(bountyUpdateError.message);

    return Response.json({
      ok: true,
      report,
      explanationHashHex,
      reviewTx,
      note: "AI trực tuyến đã đánh giá và arbiter đã ký kết quả lên Devnet.",
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
