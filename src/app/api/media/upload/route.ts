import { fetchBounty } from "@/lib/findback/program";
import type { MediaPurpose } from "@/lib/media/types";
import {
  ApiError,
  apiErrorResponse,
  enforceApiRateLimit,
  requireApiUser,
  requireSameOrigin,
} from "@/lib/server/api-security";
import { storePrivateImage } from "@/lib/server/media";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    requireSameOrigin(req);
    const user = await requireApiUser();
    const admin = createAdminClient();
    await enforceApiRateLimit(
      `media-upload:${user.id}`,
      { limit: 10, windowMs: 10 * 60_000 },
      admin,
    );
    const body = (await req.json()) as {
      purpose?: MediaPurpose;
      bountyId?: string;
      dataUrl?: string;
    };
    const purpose = body.purpose;
    const bountyId = body.bountyId?.trim() || "";
    if (!purpose || !["listing", "claim"].includes(purpose)) {
      throw new ApiError(400, "Mục đích tải ảnh không hợp lệ.");
    }
    if (!bountyId || bountyId.length > 32 || !body.dataUrl) {
      throw new ApiError(400, "Thiếu mã bounty hoặc dữ liệu ảnh.");
    }
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("wallet_pubkey,wallet_verified_at")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);
    if (!profile?.wallet_pubkey || !profile.wallet_verified_at) {
      throw new ApiError(403, "Hãy xác minh ví trước khi tải bằng chứng.");
    }

    const onchain = await fetchBounty(bountyId);
    if (purpose === "listing") {
      if (onchain && onchain.owner !== profile.wallet_pubkey) {
        throw new ApiError(403, "Ví này không sở hữu bounty đã tồn tại.");
      }
    } else {
      if (!onchain) throw new ApiError(404, "Không tìm thấy bounty trên Devnet.");
      if (onchain.owner === profile.wallet_pubkey) {
        throw new ApiError(409, "Chủ bounty không thể tải ảnh claim cho tin của mình.");
      }
      if (onchain.status !== "Funded" || onchain.deadline < Math.floor(Date.now() / 1000)) {
        throw new ApiError(409, "Bounty không còn nhận bằng chứng mới.");
      }
    }

    const media = await storePrivateImage({
      admin,
      userId: user.id,
      bountyId,
      purpose,
      dataUrl: body.dataUrl,
    });
    return Response.json({ ok: true, media });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
