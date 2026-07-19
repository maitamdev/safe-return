import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./config";

export function createAdminClient() {
  const { url } = getSupabaseEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Server chưa cấu hình SUPABASE_SERVICE_ROLE_KEY. Hãy thêm biến này vào môi trường triển khai."
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
