import type { AiClaimReport } from "@/lib/ai/types";
import { explorerTxUrl } from "@/lib/findback/config";
import { fetchBounty, getConnection } from "@/lib/findback/program";
import type { BountyMeta } from "@/lib/findback/store";
import {
  ApiError,
  apiErrorResponse,
  enforceRateLimit,
  requireApiUser,
  requireSameOrigin,
} from "@/lib/server/api-security";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
const MAX_IMAGE = 1_200_000;

type ClaimBody = {
  bountyId?: string;
  signature?: string | null;
  claim?: BountyMeta["claim"];
  aiReport?: AiClaimReport | null;
};

export async function POST(req: Request) {
  try {
    requireSameOrigin(req);
    const user = await requireApiUser();
    enforceRateLimit(`claim-sync:${user.id}`, { limit: 20, windowMs: 60_000 });
    const body = (await req.json()) as ClaimBody;
    const bountyId = body.bountyId?.trim() || "";
    if (!bountyId || !body.claim) throw new ApiError(400, "Thiếu dữ liệu claim.");
    if ((body.claim.imageDataUrl?.length || 0) > MAX_IMAGE) {
      throw new ApiError(400, "Ảnh bằng chứng quá lớn.");
    }

    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("wallet_pubkey,wallet_verified_at,is_arbiter")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);
    if (!profile?.wallet_pubkey || !profile.wallet_verified_at) {
      throw new ApiError(403, "Ví chưa được xác minh.");
    }

    const onchain = await fetchBounty(bountyId);
    if (!onchain) throw new ApiError(404, "Không tìm thấy bounty trên Devnet.");
    const isFinder = profile.wallet_pubkey === onchain.finder;
    const isParticipant =
      isFinder ||
      profile.wallet_pubkey === onchain.owner ||
      (profile.is_arbiter && profile.wallet_pubkey === onchain.arbiter);
    if (!isParticipant) throw new ApiError(403, "Ví không phải thành viên của claim.");

    if (body.signature) {
      const status = (await getConnection().getSignatureStatuses([body.signature])).value[0];
      if (!status || status.err) throw new ApiError(409, "Giao dịch chưa được Devnet xác nhận.");
    }
    const txUrl = body.signature ? explorerTxUrl(body.signature) : null;

    if (!body.aiReport) {
      if (!isFinder || onchain.status !== "ClaimSubmitted") {
        throw new ApiError(409, "Claim on-chain chưa sẵn sàng để đồng bộ.");
      }
      const evidenceHex = Buffer.from(onchain.evidenceHash).toString("hex");
      if (evidenceHex !== body.claim.evidenceHashHex) {
        throw new ApiError(409, "Hash bằng chứng không khớp dữ liệu on-chain.");
      }
      const { error } = await admin.from("claims").upsert({
        bounty_id: bountyId,
        finder_id: user.id,
        finder_wallet: onchain.finder,
        description: body.claim.description.slice(0, 2000),
        location: body.claim.location.slice(0, 200),
        found_at: body.claim.foundAt.slice(0, 80),
        image_data: body.claim.imageDataUrl ?? null,
        evidence_hash: evidenceHex,
        ai_report: null,
        status: "claim_submitted",
        last_tx: body.signature ?? null,
        last_tx_url: txUrl,
        submitted_at: new Date(body.claim.submittedAt).toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
    } else {
      if (onchain.status !== "AiReviewed" || onchain.aiScore !== body.aiReport.score) {
        throw new ApiError(409, "Kết quả AI không khớp dữ liệu on-chain.");
      }
      const { error } = await admin
        .from("claims")
        .update({
          ai_report: body.aiReport,
          status: "ai_reviewed",
          last_tx: body.signature ?? null,
          last_tx_url: txUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("bounty_id", bountyId);
      if (error) throw new Error(error.message);
    }

    const { error: bountyError } = await admin
      .from("bounties")
      .update({
        status: body.aiReport ? "ai_reviewed" : "claim_submitted",
        last_tx: body.signature ?? null,
        last_tx_url: txUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bountyId);
    if (bountyError) throw new Error(bountyError.message);

    return Response.json({ ok: true, status: body.aiReport ? "ai_reviewed" : "claim_submitted" });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
