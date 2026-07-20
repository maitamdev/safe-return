import { createHash } from "node:crypto";
import { PublicKey } from "@solana/web3.js";
import { explorerTxUrl } from "@/lib/findback/config";
import {
  evidenceIntegrityPayload,
  evidenceIntegrityPayloadV2,
} from "@/lib/findback/integrity";
import {
  fetchBounty,
  fetchClaimV2,
  fetchSignatureStatus,
} from "@/lib/findback/program";
import type { BountyMeta } from "@/lib/findback/store";
import {
  ApiError,
  apiErrorResponse,
  enforceRateLimit,
  requireApiUser,
  requireSameOrigin,
} from "@/lib/server/api-security";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyStoredImage } from "@/lib/server/media";

export const runtime = "nodejs";
const MAX_IMAGE = 1_200_000;

type ClaimBody = {
  bountyId?: string;
  signature?: string | null;
  claim?: BountyMeta["claim"];
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
    const useV2 = body.claim.protocolVersion === 2 || onchain.protocolVersion >= 2;
    if (useV2 && (body.claim.protocolVersion !== 2 || onchain.protocolVersion < 2)) {
      throw new ApiError(409, "Phiên bản claim không khớp protocol on-chain.");
    }

    if (useV2) {
      const finder = new PublicKey(profile.wallet_pubkey);
      const chainClaim = await fetchClaimV2(bountyId, finder);
      if (!chainClaim) throw new ApiError(404, "Không tìm thấy ClaimV2 trên Devnet.");
      if (
        chainClaim.finder !== profile.wallet_pubkey ||
        chainClaim.address !== body.claim.claimPda
      ) {
        throw new ApiError(409, "Claim PDA không khớp ví đã xác minh.");
      }
      if (chainClaim.status !== "Submitted") {
        throw new ApiError(409, "ClaimV2 không ở trạng thái có thể đồng bộ.");
      }
      if (body.claim.media) {
        await verifyStoredImage({
          admin,
          userId: user.id,
          bountyId,
          purpose: "claim",
          media: body.claim.media,
        });
      }
      if (body.signature) {
        const status = await fetchSignatureStatus(body.signature);
        if (!status || status.err) {
          throw new ApiError(409, "Giao dịch chưa được Devnet xác nhận.");
        }
      }
      const evidenceHex = Buffer.from(chainClaim.evidenceHash).toString("hex");
      const computedEvidenceHash = createHash("sha256")
        .update(
          evidenceIntegrityPayloadV2({
            bountyId,
            finder: chainClaim.finder,
            description: body.claim.description,
            location: body.claim.location,
            foundAt: body.claim.foundAt,
            image: body.claim.media
              ? {
                  sha256: body.claim.media.sha256,
                  mimeType: body.claim.media.mimeType,
                  byteSize: body.claim.media.byteSize,
                }
              : null,
          })
        )
        .digest("hex");
      if (
        evidenceHex !== body.claim.evidenceHashHex ||
        computedEvidenceHash !== evidenceHex
      ) {
        throw new ApiError(409, "Hash ClaimV2 không khớp dữ liệu bằng chứng.");
      }
      const now = new Date().toISOString();
      const { error } = await admin.from("claims").upsert(
        {
          bounty_id: bountyId,
          finder_id: user.id,
          finder_wallet: chainClaim.finder,
          protocol_version: 2,
          claim_pda: chainClaim.address,
          description: body.claim.description.slice(0, 2000),
          location: body.claim.location.slice(0, 200),
          found_at: body.claim.foundAt.slice(0, 80),
          image_data: null,
          image_storage_path: body.claim.media?.storagePath ?? null,
          image_sha256: body.claim.media?.sha256 ?? null,
          image_mime_type: body.claim.media?.mimeType ?? null,
          image_byte_size: body.claim.media?.byteSize ?? null,
          evidence_hash: evidenceHex,
          ai_report: null,
          status: "submitted",
          last_tx: body.signature ?? null,
          last_tx_url: body.signature ? explorerTxUrl(body.signature) : null,
          submitted_at: now,
          updated_at: now,
        },
        { onConflict: "bounty_id,finder_wallet" }
      );
      if (error) throw new Error(error.message);
      return Response.json({
        ok: true,
        status: "submitted",
        claimPda: chainClaim.address,
      });
    }

    const isFinder = profile.wallet_pubkey === onchain.finder;
    const isParticipant =
      isFinder ||
      profile.wallet_pubkey === onchain.owner ||
      (profile.is_arbiter && profile.wallet_pubkey === onchain.arbiter);
    if (!isParticipant) throw new ApiError(403, "Ví không phải thành viên của claim.");

    if (body.signature) {
      const status = await fetchSignatureStatus(body.signature);
      if (!status || status.err) throw new ApiError(409, "Giao dịch chưa được Devnet xác nhận.");
    }
    const txUrl = body.signature ? explorerTxUrl(body.signature) : null;

    if (!isFinder || onchain.status !== "ClaimSubmitted") {
      throw new ApiError(409, "Claim on-chain chưa sẵn sàng để đồng bộ.");
    }
    const evidenceHex = Buffer.from(onchain.evidenceHash).toString("hex");
    const computedEvidenceHash = createHash("sha256")
      .update(
        evidenceIntegrityPayload({
          description: body.claim.description,
          location: body.claim.location,
          foundAt: body.claim.foundAt,
          imageDataUrl: body.claim.imageDataUrl,
          finder: onchain.finder,
        })
      )
      .digest("hex");
    if (
      evidenceHex !== body.claim.evidenceHashHex ||
      computedEvidenceHash !== evidenceHex
    ) {
      throw new ApiError(409, "Hash bằng chứng không khớp dữ liệu on-chain.");
    }
    const now = new Date().toISOString();
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
      submitted_at: now,
      updated_at: now,
    });
    if (error) throw new Error(error.message);

    const { error: bountyError } = await admin
      .from("bounties")
      .update({
        status: "claim_submitted",
        last_tx: body.signature ?? null,
        last_tx_url: txUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bountyId);
    if (bountyError) throw new Error(bountyError.message);

    return Response.json({ ok: true, status: "claim_submitted" });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
