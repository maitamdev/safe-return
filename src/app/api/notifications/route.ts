import {
  ApiError,
  apiErrorResponse,
  enforceDistributedRateLimit,
  enforceRateLimit,
  requireApiUser,
  requireSameOrigin,
} from "@/lib/server/api-security";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireApiUser();
    const admin = createAdminClient();
    const [{ data, error }, { count, error: countError }] = await Promise.all([
      admin
        .from("claim_notifications")
        .select("id,claim_id,bounty_id,kind,title,body,read_at,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30),
      admin
        .from("claim_notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("read_at", null),
    ]);
    if (error) throw new Error(error.message);
    if (countError) throw new Error(countError.message);
    return Response.json(
      { ok: true, notifications: data || [], unread: count || 0 },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(req: Request) {
  try {
    requireSameOrigin(req);
    const user = await requireApiUser();
    enforceRateLimit(`notifications:${user.id}`, { limit: 30, windowMs: 60_000 });
    const admin = createAdminClient();
    await enforceDistributedRateLimit(admin, `notifications:${user.id}`, {
      limit: 30,
      windowMs: 60_000,
    });
    const body = (await req.json().catch(() => ({}))) as {
      id?: string;
      all?: boolean;
    };
    let query = admin
      .from("claim_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);
    if (!body.all) {
      const id = String(body.id || "").trim();
      if (!/^[0-9a-f-]{36}$/i.test(id)) {
        throw new ApiError(400, "Mã thông báo không hợp lệ.");
      }
      query = query.eq("id", id);
    }
    const { error } = await query;
    if (error) throw new Error(error.message);
    return Response.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
