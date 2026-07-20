import type { SupabaseClient } from "@supabase/supabase-js";

export const SESSION_REAUTH_REQUIRED_MESSAGE =
  "Phiên đăng nhập cũ không còn hợp lệ. SafeReturn đã làm sạch phiên lỗi; vui lòng đăng nhập lại.";

let activeRepair: Promise<boolean> | null = null;

export function isJwtTimingError(error: unknown) {
  const message =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in error
        ? String(error.message)
        : "";

  return /jwt.*(?:issued at future|not yet valid)|(?:issued at future|not yet valid).*jwt/i.test(
    message,
  );
}

export async function repairJwtTimingSession(client: SupabaseClient) {
  if (activeRepair) return activeRepair;

  activeRepair = (async () => {
    try {
      const { data, error } = await client.auth.refreshSession();
      return !error && Boolean(data.session);
    } catch {
      return false;
    }
  })();

  try {
    return await activeRepair;
  } finally {
    activeRepair = null;
  }
}

export async function clearInvalidLocalSession(client: SupabaseClient) {
  try {
    await client.auth.signOut({ scope: "local" });
  } catch {
    // The stored JWT may be rejected by Auth as well. Supabase still clears
    // invalid 401/403 sessions locally; there is nothing else to revoke here.
  }
}
