import "server-only";

import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  isSolanaRateLimitError,
  SOLANA_RPC_BUSY_MESSAGE,
} from "@/lib/solana/rpc-read";

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
  return Response.json({ ok: false, error: message }, { status });
}
