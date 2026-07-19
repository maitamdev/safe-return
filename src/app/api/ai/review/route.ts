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
      finderDescription?: string;
      finderLocation?: string;
      finderFoundAt?: string;
      finderImageDataUrl?: string | null;
    };
    const bountyId = body.bountyId?.trim() || "";
    if (!bountyId || !body.finderDescription?.trim()) {
      throw new ApiError(400, "Thiếu mã bounty hoặc mô tả bằng chứng.");
    }
    if (body.finderImageDataUrl && body.finderImageDataUrl.length > MAX_IMAGE) {
      throw new ApiError(400, "Ảnh bằng chứng quá lớn (tối đa khoảng 1 MB).");
    }

    const admin = createAdminClient();
    const [{ data: profile, error: profileError }, { data: listing, error: listingError }] =
      await Promise.all([
        admin
          .from("profiles")
          .select("wallet_pubkey,wallet_verified_at")
          .eq("id", user.id)
          .maybeSingle(),
        admin.from("bounties").select("*").eq("id", bountyId).maybeSingle(),
      ]);
    if (profileError) throw new Error(profileError.message);
    if (listingError) throw new Error(listingError.message);
    if (!profile?.wallet_pubkey || !profile.wallet_verified_at) {
      throw new ApiError(403, "Hãy xác minh ví trước khi yêu cầu đánh giá.");
    }
    if (!listing) throw new ApiError(404, "Không tìm thấy bounty.");

    const onchain = await fetchBounty(bountyId);
    if (!onchain) throw new ApiError(404, "Bounty chưa tồn tại trên Devnet.");
    if (onchain.finder !== profile.wallet_pubkey) {
      throw new ApiError(403, "Ví đã xác minh không phải finder của claim này.");
    }
    if (!new PublicKey(onchain.arbiter).equals(new PublicKey(ARBITER))) {
      throw new ApiError(409, "Bounty dùng arbiter khác với cấu hình máy chủ.");
    }
    if (!['ClaimSubmitted', 'AiReviewed'].includes(onchain.status)) {
      throw new ApiError(409, "Claim chưa ở trạng thái có thể đánh giá.");
    }

    const report = await runClaimReview({
      ownerTitle: String(listing.title).slice(0, 200),
      ownerDescription: String(listing.description || "").slice(0, 2000),
      ownerCategory: String(listing.category || "").slice(0, 80),
      ownerLocation: String(listing.location || "").slice(0, 200),
      ownerImageDataUrl: listing.image_path as string | null,
      finderDescription: body.finderDescription.slice(0, 2000),
      finderLocation: body.finderLocation?.slice(0, 200),
      finderFoundAt: body.finderFoundAt?.slice(0, 80),
      finderImageDataUrl: body.finderImageDataUrl,
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

    return Response.json({
      ok: true,
      report,
      explanationHashHex,
      reviewTx,
      note:
        report.mode === "heuristic"
          ? "Đánh giá quy tắc cục bộ, được arbiter ký lên Devnet."
          : "AI đã đánh giá và arbiter đã ký kết quả lên Devnet.",
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
