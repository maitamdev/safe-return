import "server-only";

import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export async function requireApiUser(): Promise<User> {
  const supabase = await createClient();
  if (!supabase) throw new ApiError(503, "Supabase chưa được cấu hình.");
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new ApiError(401, "Bạn cần đăng nhập.");
  return data.user;
}

export function requireSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return;
  const requestUrl = new URL(req.url);
  if (new URL(origin).host !== requestUrl.host) {
    throw new ApiError(403, "Yêu cầu không cùng nguồn bị từ chối.");
  }
}

export function enforceRateLimit(
  key: string,
  options: { limit: number; windowMs: number }
) {
  const now = Date.now();
  if (buckets.size > 2_000) {
    for (const [bucketKey, value] of buckets) {
      if (value.resetAt <= now) buckets.delete(bucketKey);
    }
  }

  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return;
  }
  if (current.count >= options.limit) {
    throw new ApiError(429, "Bạn thao tác quá nhanh. Vui lòng thử lại sau.");
  }
  current.count += 1;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export function apiErrorResponse(error: unknown) {
  const status = error instanceof ApiError ? error.status : 500;
  const message =
    error instanceof Error ? error.message : "Yêu cầu không thể xử lý.";
  return Response.json({ ok: false, error: message }, { status });
}
