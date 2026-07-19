import { createAdminClient } from "@/lib/supabase/admin";
import { apiErrorResponse, requireApiUser } from "@/lib/server/api-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireApiUser();
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .select("wallet_pubkey,wallet_verified_at")
      .eq("id", user.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return Response.json({
      ok: true,
      address: data?.wallet_pubkey ?? null,
      verifiedAt: data?.wallet_verified_at ?? null,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
