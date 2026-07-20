import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./config";

export function getSupabaseAdminKey() {
  return (
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    ""
  );
}

export function isSupabaseAdminConfigured() {
  return Boolean(getSupabaseAdminKey());
}

export function createAdminClient() {
  const { url } = getSupabaseEnv();
  const adminKey = getSupabaseAdminKey();

  if (!url || !adminKey) {
    throw new Error(
      "Server chưa cấu hình SUPABASE_SECRET_KEY hoặc SUPABASE_SERVICE_ROLE_KEY. Hãy thêm một secret key Supabase vào môi trường triển khai."
    );
  }

  return createClient(url, adminKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
