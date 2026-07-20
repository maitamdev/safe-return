import type { PublicSafeTag } from "@/lib/tags/types";
import { ApiError, apiErrorResponse, enforceRateLimit } from "@/lib/server/api-security";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSafeTagCode, requestIp } from "@/lib/tags/security";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    if (!isSafeTagCode(code)) {
      throw new ApiError(404, "SafeTag không hợp lệ.");
    }
    enforceRateLimit(`safe-tag-public:${requestIp(req)}:${code}`, {
      limit: 40,
      windowMs: 60_000,
    });
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("safe_tags")
      .select("label,public_note,status")
      .eq("public_code", code)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data || data.status === "disabled") throw new ApiError(404, "SafeTag không tồn tại hoặc đã tắt.");
    const tag: PublicSafeTag = {
      label: data.label,
      publicNote: data.public_note,
      status: data.status,
    };
    return Response.json(
      { ok: true, tag },
      { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" } }
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
