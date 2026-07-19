import { createHash } from "node:crypto";
import { explorerTxUrl, fromAtomic } from "@/lib/findback/config";
import { metadataIntegrityPayload } from "@/lib/findback/integrity";
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

export async function POST(req: Request) {
  try {
    requireSameOrigin(req);
    const user = await requireApiUser();
    enforceRateLimit(`bounty-register:${user.id}`, { limit: 12, windowMs: 60_000 });
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

    const admin = createAdminClient();
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
    const metadataHashHex = Buffer.from(onchain.metadataHash).toString("hex");
    const computedMetadataHash = createHash("sha256")
      .update(metadataIntegrityPayload(bounty))
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
      const txStatus = (await getConnection().getSignatureStatuses([bounty.lastTx])).value[0];
      if (!txStatus || txStatus.err) {
        throw new ApiError(409, "Giao dịch tạo bounty chưa được Devnet xác nhận.");
      }
      signature = bounty.lastTx;
    }

    const now = new Date().toISOString();
    const { error } = await admin.from("bounties").upsert(
      {
        id: bounty.id,
        owner_id: user.id,
        owner_wallet: onchain.owner,
        title: bounty.title.trim(),
        description: bounty.description.trim(),
        category: bounty.category.trim().slice(0, 80),
        location: bounty.location.trim().slice(0, 180),
        reward_ui: fromAtomic(onchain.rewardAmount),
        deadline_unix: onchain.deadline,
        image_path: bounty.imageDataUrl ?? null,
        metadata_hash: metadataHashHex,
        status: toDbStatus(onchain.status),
        last_tx: signature,
        last_tx_url: signature ? explorerTxUrl(signature) : null,
        updated_at: now,
      },
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
