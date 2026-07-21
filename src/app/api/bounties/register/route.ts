import { createHash } from "node:crypto";
import { explorerTxUrl, fromAtomic } from "@/lib/findback/config";
import {
  metadataIntegrityPayload,
  metadataIntegrityPayloadV2,
} from "@/lib/findback/integrity";
import { fetchBounty, fetchSignatureStatus } from "@/lib/findback/program";
import type { BountyMeta } from "@/lib/findback/store";
import {
  ApiError,
  apiErrorResponse,
  enforceApiRateLimit,
  requireApiUser,
  requireSameOrigin,
} from "@/lib/server/api-security";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyStoredImage } from "@/lib/server/media";

export const runtime = "nodejs";

const MAX_IMAGE = 1_200_000;

export async function POST(req: Request) {
  try {
    requireSameOrigin(req);
    const user = await requireApiUser();
    const admin = createAdminClient();
    await enforceApiRateLimit(
      `bounty-register:${user.id}`,
      { limit: 12, windowMs: 60_000 },
      admin,
    );
    const body = (await req.json()) as { bounty?: BountyMeta };
    const bounty = body.bounty;
    if (!bounty?.id || !bounty.title?.trim() || !bounty.metadataHashHex) {
      throw new ApiError(400, "Thiếu metadata bounty.");
    }
    if (bounty.title.length > 120 || bounty.description.length > 1800) {
      throw new ApiError(400, "Nội dung bounty vượt giới hạn.");
    }
    if ((bounty.imageDataUrl?.length || 0) > MAX_IMAGE) {
      throw new ApiError(400, "Ảnh tham chiếu quá lớn.");
    }
    const [{ data: profile, error: profileError }, { data: existing, error: existingError }] =
      await Promise.all([
        admin
          .from("profiles")
          .select("wallet_pubkey,wallet_verified_at")
          .eq("id", user.id)
          .maybeSingle(),
        admin.from("bounties").select("owner_id").eq("id", bounty.id).maybeSingle(),
      ]);
    if (profileError) throw new Error(profileError.message);
    if (existingError) throw new Error(existingError.message);
    if (!profile?.wallet_pubkey || !profile.wallet_verified_at) {
      throw new ApiError(403, "Ví chưa được xác minh.");
    }
    if (existing && existing.owner_id !== user.id) {
      throw new ApiError(409, "Bounty đã thuộc về tài khoản khác.");
    }

    const onchain = await fetchBounty(bounty.id);
    if (!onchain) throw new ApiError(404, "Bounty chưa tồn tại trên Devnet.");
    if (onchain.owner !== profile.wallet_pubkey || bounty.ownerWallet !== onchain.owner) {
      throw new ApiError(403, "Ví chủ bounty không khớp Devnet.");
    }
    const useV2 = bounty.protocolVersion === 2 || onchain.protocolVersion >= 2;
    if (useV2 && (bounty.protocolVersion !== 2 || onchain.protocolVersion < 2)) {
      throw new ApiError(409, "Phiên bản metadata không khớp protocol on-chain.");
    }
    if (useV2 && bounty.media) {
      await verifyStoredImage({
        admin,
        userId: user.id,
        bountyId: bounty.id,
        purpose: "listing",
        media: bounty.media,
      });
    }
    const metadataHashHex = Buffer.from(onchain.metadataHash).toString("hex");
    const computedMetadataHash = createHash("sha256")
      .update(
        useV2
          ? metadataIntegrityPayloadV2({
              bountyId: bounty.id,
              owner: onchain.owner,
              rewardBaseUnits: onchain.rewardAmount.toString(),
              deadlineUnix: onchain.deadline,
              title: bounty.title,
              description: bounty.description,
              category: bounty.category,
              location: bounty.location,
              image: bounty.media
                ? {
                    sha256: bounty.media.sha256,
                    mimeType: bounty.media.mimeType,
                    byteSize: bounty.media.byteSize,
                  }
                : null,
            })
          : metadataIntegrityPayload(bounty)
      )
      .digest("hex");
    if (
      metadataHashHex !== bounty.metadataHashHex ||
      computedMetadataHash !== metadataHashHex
    ) {
      throw new ApiError(409, "Hash metadata không khớp bounty trên Devnet.");
    }
    if (onchain.deadline !== bounty.deadlineUnix) {
      throw new ApiError(409, "Thời hạn bounty không khớp Devnet.");
    }
    if (Math.abs(fromAtomic(onchain.rewardAmount) - bounty.rewardUi) > 0.000001) {
      throw new ApiError(409, "Phần thưởng bounty không khớp Devnet.");
    }

    let signature: string | null = null;
    if (bounty.lastTx) {
      const txStatus = await fetchSignatureStatus(bounty.lastTx);
      if (!txStatus || txStatus.err) {
        throw new ApiError(409, "Giao dịch tạo bounty chưa được Devnet xác nhận.");
      }
      signature = bounty.lastTx;
    }

    const now = new Date().toISOString();
    const row = {
        id: bounty.id,
        owner_id: user.id,
        owner_wallet: onchain.owner,
        title: bounty.title.trim(),
        description: bounty.description.trim(),
        category: bounty.category.trim().slice(0, 80),
        location: bounty.location.trim().slice(0, 180),
        reward_ui: fromAtomic(onchain.rewardAmount),
        deadline_unix: onchain.deadline,
        image_path: useV2 ? null : bounty.imageDataUrl ?? null,
        metadata_hash: metadataHashHex,
        status: toDbStatus(onchain.status),
        last_tx: signature,
        last_tx_url: signature ? explorerTxUrl(signature) : null,
        updated_at: now,
        ...(useV2
          ? {
              protocol_version: 2,
              image_storage_path: bounty.media?.storagePath ?? null,
              image_sha256: bounty.media?.sha256 ?? null,
              image_mime_type: bounty.media?.mimeType ?? null,
              image_byte_size: bounty.media?.byteSize ?? null,
            }
          : {}),
      };
    const { error } = await admin.from("bounties").upsert(
      row,
      { onConflict: "id" }
    );
    if (error) throw new Error(error.message);

    return Response.json({ ok: true, status: onchain.status });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

function toDbStatus(status: string) {
  return status.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
}
