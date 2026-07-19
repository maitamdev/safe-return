import { createClient } from "@/lib/supabase/server";
import { apiErrorResponse, requireApiUser } from "@/lib/server/api-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireApiUser();
    const adminConfigured = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
    const supabase = await createClient();
    if (!supabase) {
      return Response.json({ ok: true, configured: false, adminConfigured, schemaReady: false, address: null, verifiedAt: null });
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("wallet_pubkey,wallet_verified_at")
      .eq("id", user.id)
      .maybeSingle();
    if (error) {
      const schemaReady = !/wallet_verified_at|column .* does not exist|schema cache/i.test(error.message);
      if (!schemaReady) {
        return Response.json({ ok: true, configured: true, adminConfigured, schemaReady: false, address: null, verifiedAt: null });
      }
      throw new Error(error.message);
    }
    return Response.json({
      ok: true,
      configured: true,
      adminConfigured,
      schemaReady: true,
      address: data?.wallet_pubkey ?? null,
      verifiedAt: data?.wallet_verified_at ?? null,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
