import { createHash } from "node:crypto";
import { PublicKey } from "@solana/web3.js";
import { PROTOCOL_V2_ENABLED } from "@/lib/findback/config";
import {
  evidenceIntegrityPayloadV2,
  metadataIntegrityPayloadV2,
} from "@/lib/findback/integrity";
import { fetchBounty, fetchClaimV2 } from "@/lib/findback/program";
import type { MediaPurpose, StoredMedia } from "@/lib/media/types";
import {
  ApiError,
  apiErrorResponse,
  enforceRateLimit,
  requireApiUser,
} from "@/lib/server/api-security";
import { downloadAndVerifyStoredImage } from "@/lib/server/media";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type MediaRow = {
  image_storage_path: string | null;
  image_sha256: string | null;
  image_mime_type: string | null;
  image_byte_size: number | null;
};

export async function GET(req: Request) {
  try {
    if (!PROTOCOL_V2_ENABLED) {
      throw new ApiError(404, "Evidence Vault chưa được bật.");
    }
    const user = await requireApiUser();
    enforceRateLimit(`media-view:${user.id}`, { limit: 180, windowMs: 10 * 60_000 });

    const url = new URL(req.url);
    const purpose = url.searchParams.get("purpose") as MediaPurpose | null;
    const bountyId = url.searchParams.get("bountyId")?.trim() || "";
    const claimId = url.searchParams.get("claimId")?.trim() || "";
    const verifyOnly = url.searchParams.get("mode") === "verify";
    if (!purpose || !["listing", "claim"].includes(purpose) || !bountyId) {
      throw new ApiError(400, "Yêu cầu ảnh không hợp lệ.");
    }

    const admin = createAdminClient();
    const [{ data: profile, error: profileError }, { data: listing, error: listingError }] =
      await Promise.all([
        admin
          .from("profiles")
          .select("wallet_pubkey,wallet_verified_at,is_arbiter")
          .eq("id", user.id)
          .maybeSingle(),
        admin.from("bounties").select("*").eq("id", bountyId).maybeSingle(),
      ]);
    if (profileError) throw new Error(profileError.message);
    if (listingError) throw new Error(listingError.message);
    if (!profile?.wallet_pubkey || !profile.wallet_verified_at) {
      throw new ApiError(403, "Hãy xác minh ví trước khi xem ảnh trong Evidence Vault.");
    }
    if (!listing) throw new ApiError(404, "Không tìm thấy bounty.");

    const onchain = await fetchBounty(bountyId);
    if (!onchain || onchain.protocolVersion < 2) {
      throw new ApiError(409, "Bounty chưa được xác nhận bằng protocol v2 trên Devnet.");
    }

    let media: StoredMedia;
    let storageOwnerId: string;
    let commitment: string;

    if (purpose === "listing") {
      media = mediaFromRow(listing);
      storageOwnerId = String(listing.owner_id);
      commitment = createHash("sha256")
        .update(
          metadataIntegrityPayloadV2({
            bountyId,
            owner: onchain.owner,
            rewardBaseUnits: onchain.rewardAmount.toString(),
            deadlineUnix: onchain.deadline,
            title: String(listing.title),
            description: String(listing.description || ""),
            category: String(listing.category || "Other"),
            location: String(listing.location || ""),
            image: descriptor(media),
          })
        )
        .digest("hex");
      const chainCommitment = Buffer.from(onchain.metadataHash).toString("hex");
      if (commitment !== chainCommitment || commitment !== listing.metadata_hash) {
        throw new ApiError(409, "Metadata ảnh không khớp commitment trên Devnet.");
      }
    } else {
      if (!claimId) throw new ApiError(400, "Thiếu mã claim cần xem.");
      const { data: claim, error: claimError } = await admin
        .from("claims")
        .select("*")
        .eq("id", claimId)
        .eq("bounty_id", bountyId)
        .maybeSingle();
      if (claimError) throw new Error(claimError.message);
      if (!claim) throw new ApiError(404, "Không tìm thấy claim.");

      const isParticipant =
        claim.finder_id === user.id ||
        listing.owner_id === user.id ||
        (profile.is_arbiter && profile.wallet_pubkey === onchain.arbiter);
      if (!isParticipant) {
        throw new ApiError(403, "Chỉ chủ bounty, finder và arbiter được xem bằng chứng riêng tư.");
      }

      const chainClaim = await fetchClaimV2(bountyId, new PublicKey(claim.finder_wallet));
      if (!chainClaim || chainClaim.address !== claim.claim_pda) {
        throw new ApiError(409, "Claim trong cơ sở dữ liệu không khớp Claim PDA trên Devnet.");
      }
      media = mediaFromRow(claim);
      storageOwnerId = String(claim.finder_id);
      commitment = createHash("sha256")
        .update(
          evidenceIntegrityPayloadV2({
            bountyId,
            finder: chainClaim.finder,
            description: String(claim.description || ""),
            location: String(claim.location || ""),
            foundAt: String(claim.found_at || ""),
            image: descriptor(media),
          })
        )
        .digest("hex");
      const chainCommitment = Buffer.from(chainClaim.evidenceHash).toString("hex");
      if (commitment !== chainCommitment || commitment !== claim.evidence_hash) {
        throw new ApiError(409, "Bằng chứng không khớp commitment của Claim PDA trên Devnet.");
      }
    }

    const bytes = await downloadAndVerifyStoredImage({
      admin,
      userId: storageOwnerId,
      bountyId,
      purpose,
      media,
    });

    if (verifyOnly) {
      return Response.json({
        ok: true,
        verified: true,
        network: "Solana Devnet",
        sha256: media.sha256,
        commitment,
        byteSize: media.byteSize,
        mimeType: media.mimeType,
      });
    }

    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": media.mimeType,
        "Content-Length": String(bytes.length),
        "Cache-Control": purpose === "claim" ? "private, no-store" : "private, max-age=300",
        ETag: `"sha256-${media.sha256}"`,
        "X-Content-Type-Options": "nosniff",
        "X-SafeReturn-Verified": "solana-devnet",
        "X-SafeReturn-SHA256": media.sha256,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

function mediaFromRow(row: MediaRow): StoredMedia {
  if (
    !row.image_storage_path ||
    !row.image_sha256 ||
    !["image/jpeg", "image/png", "image/webp"].includes(row.image_mime_type || "") ||
    !row.image_byte_size
  ) {
    throw new ApiError(404, "Bản ghi này không có ảnh trong Evidence Vault.");
  }
  return {
    storagePath: row.image_storage_path,
    sha256: row.image_sha256,
    mimeType: row.image_mime_type as StoredMedia["mimeType"],
    byteSize: row.image_byte_size,
  };
}

function descriptor(media: StoredMedia) {
  return {
    sha256: media.sha256,
    mimeType: media.mimeType,
    byteSize: media.byteSize,
  };
}
