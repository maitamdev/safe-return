import { PublicKey } from "@solana/web3.js";
import {
  AI_PROMPT_VERSION,
  hasLiveAiProvider,
  runClaimReview,
  sha256Hex,
} from "@/lib/ai/agent";
import type { AiReviewInput } from "@/lib/ai/types";
import { decisionToU8, riskToU8 } from "@/lib/ai/types";
import {
  aiInputProvenancePayload,
  aiModelIdentityPayload,
  aiReportProvenancePayload,
} from "@/lib/ai/provenance";
import { ARBITER, PROTOCOL_V2_ENABLED } from "@/lib/findback/config";
import {
  evidenceIntegrityPayloadV2,
  metadataIntegrityPayloadV2,
} from "@/lib/findback/integrity";
import {
  fetchBounty,
  fetchClaimV2,
  recordAiReviewOnChain,
  recordAiReviewV2OnChain,
} from "@/lib/findback/program";
import type { StoredMedia } from "@/lib/media/types";
import {
  ApiError,
  apiErrorResponse,
  enforceApiRateLimit,
  requireApiUser,
  requireSameOrigin,
} from "@/lib/server/api-security";
import { downloadAndVerifyStoredImage } from "@/lib/server/media";
import { keypairWallet, loadServerKeypair } from "@/lib/server/solana-signer";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type MediaRow = {
  image_storage_path?: string | null;
  image_sha256?: string | null;
  image_mime_type?: StoredMedia["mimeType"] | null;
  image_byte_size?: number | null;
};

export async function POST(req: Request) {
  try {
    requireSameOrigin(req);
    const user = await requireApiUser();
    const admin = createAdminClient();
    await enforceApiRateLimit(
      `ai-review:${user.id}`,
      { limit: 8, windowMs: 10 * 60_000 },
      admin,
    );

    const body = (await req.json()) as { bountyId?: string; claimId?: string };
    const bountyId = body.bountyId?.trim() || "";
    const claimId = body.claimId?.trim() || "";
    if (!bountyId) throw new ApiError(400, "Thiếu mã bounty.");
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
    const useV2 = PROTOCOL_V2_ENABLED && onchain.protocolVersion >= 2;

    let claimQuery = admin.from("claims").select("*").eq("bounty_id", bountyId);
    if (useV2) {
      claimQuery = claimId
        ? claimQuery.eq("id", claimId)
        : claimQuery.eq("finder_id", user.id);
    }
    const { data: claim, error: claimError } = await claimQuery.maybeSingle();
    if (claimError) throw new Error(claimError.message);
    if (!claim) throw new ApiError(404, "Không tìm thấy bằng chứng đã lưu.");

    if (!new PublicKey(onchain.arbiter).equals(new PublicKey(ARBITER))) {
      throw new ApiError(409, "Bounty dùng arbiter khác với cấu hình máy chủ.");
    }
    if (!hasLiveAiProvider()) {
      throw new ApiError(503, "AI trực tuyến chưa được cấu hình trên máy chủ.");
    }

    let chainClaim = null;
    if (useV2) {
      chainClaim = await fetchClaimV2(bountyId, new PublicKey(claim.finder_wallet));
      if (!chainClaim || chainClaim.address !== claim.claim_pda) {
        throw new ApiError(409, "Claim PDA không khớp dữ liệu đã lưu.");
      }
      const isFinder = chainClaim.finder === profile.wallet_pubkey && claim.finder_id === user.id;
      const isOwner = onchain.owner === profile.wallet_pubkey && listing.owner_id === user.id;
      if (!isFinder && !isOwner) {
        throw new ApiError(403, "Chỉ chủ đồ hoặc người gửi bằng chứng được yêu cầu đánh giá.");
      }
      if (!['Submitted', 'AiReviewed'].includes(chainClaim.status)) {
        throw new ApiError(409, "Claim không ở trạng thái có thể đánh giá.");
      }
      if (Buffer.from(chainClaim.evidenceHash).toString("hex") !== claim.evidence_hash) {
        throw new ApiError(409, "Hash bằng chứng trong Supabase không khớp Claim PDA.");
      }
      const listingMedia = storedMedia(listing);
      const claimMedia = storedMedia(claim);
      const metadataHash = await sha256Hex(metadataIntegrityPayloadV2({
        bountyId,
        owner: onchain.owner,
        rewardBaseUnits: onchain.rewardAmount.toString(),
        deadlineUnix: onchain.deadline,
        title: String(listing.title),
        description: String(listing.description || ""),
        category: String(listing.category || "Other"),
        location: String(listing.location || ""),
        image: listingMedia ? descriptor(listingMedia) : null,
      }));
      const evidenceHash = await sha256Hex(evidenceIntegrityPayloadV2({
        bountyId,
        finder: chainClaim.finder,
        description: String(claim.description || ""),
        location: String(claim.location || ""),
        foundAt: String(claim.found_at || ""),
        image: claimMedia ? descriptor(claimMedia) : null,
      }));
      if (
        metadataHash !== Buffer.from(onchain.metadataHash).toString("hex") ||
        metadataHash !== listing.metadata_hash ||
        evidenceHash !== claim.evidence_hash
      ) {
        throw new ApiError(409, "Nội dung AI đầu vào không khớp commitment trên Devnet.");
      }
    } else {
      if (onchain.finder !== profile.wallet_pubkey) {
        throw new ApiError(403, "Ví đã xác minh không phải finder của claim này.");
      }
      if (claim.finder_id !== user.id || claim.finder_wallet !== onchain.finder) {
        throw new ApiError(409, "Người gửi bằng chứng không khớp dữ liệu on-chain.");
      }
      if (Buffer.from(onchain.evidenceHash).toString("hex") !== claim.evidence_hash) {
        throw new ApiError(409, "Hash bằng chứng trong Supabase không khớp Devnet.");
      }
      if (!["ClaimSubmitted", "AiReviewed"].includes(onchain.status)) {
        throw new ApiError(409, "Claim chưa ở trạng thái có thể đánh giá.");
      }
    }

    const [ownerImageDataUrl, finderImageDataUrl] = useV2
      ? await Promise.all([
          mediaDataUrl(admin, listing, String(listing.owner_id), bountyId, "listing"),
          mediaDataUrl(admin, claim, String(claim.finder_id), bountyId, "claim"),
        ])
      : [listing.image_path as string | null, claim.image_data as string | null];

    const reviewInput: AiReviewInput = {
      ownerTitle: String(listing.title).slice(0, 200),
      ownerDescription: String(listing.description || "").slice(0, 2000),
      ownerCategory: String(listing.category || "").slice(0, 80),
      ownerLocation: String(listing.location || "").slice(0, 200),
      ownerImageDataUrl,
      finderDescription: String(claim.description).slice(0, 2000),
      finderLocation: String(claim.location || "").slice(0, 200),
      finderFoundAt: String(claim.found_at || "").slice(0, 80),
      finderImageDataUrl,
      bountyId,
    };
    const report = await runClaimReview(reviewInput);
    // Hash a key-sorted, Unicode-normalized payload so the commitment can be
    // recomputed from the persisted report after a DB round trip.
    const reportHashHex = await sha256Hex(aiReportProvenancePayload(report));
    const signer = loadServerKeypair();
    if (signer.publicKey.toBase58() !== onchain.arbiter) {
      throw new ApiError(503, "Khóa arbiter trên máy chủ không khớp bounty.");
    }

    const updatedAt = new Date().toISOString();
    if (useV2 && chainClaim) {
      const inputHashHex = await sha256Hex(aiInputProvenancePayload({
        promptVersion: AI_PROMPT_VERSION,
        bountyId,
        claimPda: chainClaim.address,
        metadataHash: Buffer.from(onchain.metadataHash).toString("hex"),
        evidenceHash: claim.evidence_hash,
        owner: {
          title: reviewInput.ownerTitle,
          description: reviewInput.ownerDescription,
          category: reviewInput.ownerCategory,
          location: reviewInput.ownerLocation,
          imageSha256: listing.image_sha256 || null,
        },
        finder: {
          description: reviewInput.finderDescription,
          location: reviewInput.finderLocation,
          foundAt: reviewInput.finderFoundAt,
          imageSha256: claim.image_sha256 || null,
        },
      }));
      const modelHashHex = await sha256Hex(aiModelIdentityPayload({
        provider: report.provider,
        model: report.model,
        promptVersion: AI_PROMPT_VERSION,
      }));
      const reviewTx = await recordAiReviewV2OnChain(
        keypairWallet(signer),
        bountyId,
        new PublicKey(chainClaim.finder),
        {
          score: report.score,
          riskLevel: riskToU8(report),
          decision: decisionToU8(report.decision),
          inputHash: bytes32(inputHashHex),
          reportHash: bytes32(reportHashHex),
          modelHash: bytes32(modelHashHex),
        }
      );
      const { error: claimUpdateError } = await admin
        .from("claims")
        .update({
          ai_report: report,
          ai_input_hash: inputHashHex,
          ai_report_hash: reportHashHex,
          ai_model_hash: modelHashHex,
          ai_prompt_version: AI_PROMPT_VERSION,
          status: "ai_reviewed",
          last_tx: reviewTx.signature,
          last_tx_url: reviewTx.url,
          updated_at: updatedAt,
        })
        .eq("id", claim.id);
      if (claimUpdateError) throw new Error(claimUpdateError.message);

      return Response.json({
        ok: true,
        report,
        provenance: {
          promptVersion: AI_PROMPT_VERSION,
          inputHashHex,
          reportHashHex,
          modelHashHex,
          claimPda: chainClaim.address,
        },
        reviewTx,
        note: "AI đã đánh giá. Hash input, report và model đã được arbiter ghi lên Claim PDA.",
      });
    }

    const reviewTx = await recordAiReviewOnChain(keypairWallet(signer), bountyId, {
      score: report.score,
      riskLevel: riskToU8(report),
      decision: decisionToU8(report.decision),
      explanationHash: bytes32(reportHashHex),
    });
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
      explanationHashHex: reportHashHex,
      reviewTx,
      note: "AI đã đánh giá và arbiter đã ký kết quả lên Devnet.",
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

async function mediaDataUrl(
  admin: ReturnType<typeof createAdminClient>,
  row: MediaRow,
  userId: string,
  bountyId: string,
  purpose: "listing" | "claim"
) {
  const media = storedMedia(row);
  if (!media) return null;
  const bytes = await downloadAndVerifyStoredImage({
    admin,
    userId,
    bountyId,
    purpose,
    media,
  });
  return `data:${media.mimeType};base64,${bytes.toString("base64")}`;
}

function storedMedia(row: MediaRow): StoredMedia | null {
  if (
    !row.image_storage_path ||
    !row.image_sha256 ||
    !row.image_mime_type ||
    !row.image_byte_size
  ) {
    return null;
  }
  return {
    storagePath: row.image_storage_path,
    sha256: row.image_sha256,
    mimeType: row.image_mime_type,
    byteSize: row.image_byte_size,
  };
}

function bytes32(hex: string) {
  return Uint8Array.from(Buffer.from(hex, "hex"));
}

function descriptor(media: StoredMedia) {
  return {
    sha256: media.sha256,
    mimeType: media.mimeType,
    byteSize: media.byteSize,
  };
}
