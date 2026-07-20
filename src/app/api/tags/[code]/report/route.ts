import {
  ApiError,
  apiErrorResponse,
  enforceRateLimit,
  requireSameOrigin,
} from "@/lib/server/api-security";
import { createAdminClient, getSupabaseAdminKey } from "@/lib/supabase/admin";
import {
  cleanSafeTagText,
  isSafeTagCode,
  reporterFingerprint,
  requestIp,
} from "@/lib/tags/security";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  context: { params: Promise<{ code: string }> }
) {
  try {
    requireSameOrigin(req);
    const { code } = await context.params;
    if (!isSafeTagCode(code)) {
      throw new ApiError(404, "SafeTag không hợp lệ.");
    }
    const body = (await req.json()) as {
      reporterName?: string;
      contact?: string;
      location?: string;
      message?: string;
      website?: string;
    };
    if (body.website) return Response.json({ ok: true }, { status: 202 });

    const reporterName = cleanSafeTagText(body.reporterName, 80);
    const contact = cleanSafeTagText(body.contact, 200);
    const location = cleanSafeTagText(body.location, 200);
    const message = cleanSafeTagText(body.message, 1000);
    if (contact.length < 3 || message.length < 3) {
      throw new ApiError(400, "Hãy để lại cách liên hệ và lời nhắn rõ ràng.");
    }

    const ip = requestIp(req);
    const userAgent = req.headers.get("user-agent")?.slice(0, 180) || "unknown";
    enforceRateLimit(`safe-tag-report:${ip}:${code}`, { limit: 4, windowMs: 60 * 60_000 });
    const secret = getSupabaseAdminKey();
    if (!secret) throw new Error("Máy chủ chưa cấu hình kho dữ liệu SafeTag.");
    const fingerprint = reporterFingerprint({ secret, code, ip, userAgent });

    const admin = createAdminClient();
    const { data: tag, error: tagError } = await admin
      .from("safe_tags")
      .select("id,status")
      .eq("public_code", code)
      .maybeSingle();
    if (tagError) throw new Error(tagError.message);
    if (!tag || tag.status === "disabled") throw new ApiError(404, "SafeTag không còn hoạt động.");
    if (tag.status === "recovered") throw new ApiError(409, "Đồ vật này đã được chủ sở hữu đánh dấu là đã nhận lại.");

    const since = new Date(Date.now() - 60 * 60_000).toISOString();
    const { count, error: quotaError } = await admin
      .from("safe_tag_reports")
      .select("id", { count: "exact", head: true })
      .eq("tag_id", tag.id)
      .eq("reporter_fingerprint", fingerprint)
      .gte("created_at", since);
    if (quotaError) throw new Error(quotaError.message);
    if ((count || 0) >= 3) {
      throw new ApiError(429, "Bạn đã gửi đủ số lời nhắn trong giờ này.");
    }

    const { error } = await admin.from("safe_tag_reports").insert({
      tag_id: tag.id,
      reporter_name: reporterName,
      contact,
      location,
      message,
      reporter_fingerprint: fingerprint,
      status: "unread",
    });
    if (error) throw new Error(error.message);
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
