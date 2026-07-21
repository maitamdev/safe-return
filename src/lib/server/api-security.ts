import "server-only";

import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  isSolanaRateLimitError,
  SOLANA_RPC_BUSY_MESSAGE,
} from "@/lib/solana/rpc-read";
import type { createAdminClient } from "@/lib/supabase/admin";

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
  let requestOrigin: string;
  let callerOrigin: string;
  try {
    requestOrigin = new URL(req.url).origin;
    callerOrigin = new URL(origin).origin;
  } catch {
    throw new ApiError(403, "Nguồn gửi yêu cầu không hợp lệ.");
  }
  if (callerOrigin !== requestOrigin) {
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

/**
 * Shared limiter backed by Postgres. The in-memory limiter above remains a
 * cheap first line of defence; this one also works across Vercel instances.
 */
export async function enforceDistributedRateLimit(
  admin: ReturnType<typeof createAdminClient>,
  key: string,
  options: { limit: number; windowMs: number },
) {
  const { data, error } = await admin.rpc("consume_api_rate_limit", {
    p_bucket_key: key,
    p_limit: options.limit,
    p_window_seconds: Math.max(1, Math.ceil(options.windowMs / 1000)),
  });
  if (error) throw new Error(error.message);
  if (data !== true) {
    throw new ApiError(429, "Bạn thao tác quá nhanh. Vui lòng thử lại sau.");
  }
}

/**
 * In-memory gate first (fast, per-instance), then Postgres when available
 * (cross-instance). Falls back silently if the RPC is not migrated yet.
 */
export async function enforceApiRateLimit(
  key: string,
  options: { limit: number; windowMs: number },
  admin?: ReturnType<typeof createAdminClient> | null,
) {
  enforceRateLimit(key, options);
  if (!admin) return;
  try {
    await enforceDistributedRateLimit(admin, key, options);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    // Migration missing or DB blip — keep serving behind the local limiter.
    console.warn("[SafeReturn] distributed rate limit unavailable", error);
  }
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
  const rpcBusy = isSolanaRateLimitError(error);
  const status = error instanceof ApiError ? error.status : rpcBusy ? 503 : 500;
  if (!(error instanceof ApiError)) {
    console.error("[SafeReturn API] Unexpected error", error);
  }
  const message = error instanceof ApiError
    ? error.message
    : rpcBusy
      ? SOLANA_RPC_BUSY_MESSAGE
      : "Máy chủ chưa thể xử lý yêu cầu. Vui lòng thử lại sau.";
  return Response.json(
    { ok: false, error: message },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}
