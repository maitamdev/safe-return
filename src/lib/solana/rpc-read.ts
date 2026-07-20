export const SOLANA_RPC_BUSY_MESSAGE =
  "Solana Devnet đang giới hạn truy cập. SafeReturn sẽ tự thử lại; vui lòng chờ vài giây.";

export function isSolanaRateLimitError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && "message" in error
        ? String(error.message)
        : String(error);
  return /\b429\b|too many requests|rate.?limit/i.test(message);
}

export async function withRpcReadRetry<T>(
  operation: () => Promise<T>,
  options: {
    attempts?: number;
    baseDelayMs?: number;
    sleep?: (delayMs: number) => Promise<void>;
    random?: () => number;
  } = {},
) {
  const attempts = Math.max(1, options.attempts ?? 4);
  const baseDelayMs = options.baseDelayMs ?? 750;
  const sleep = options.sleep ?? ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)));
  const random = options.random ?? Math.random;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isSolanaRateLimitError(error)) throw error;
      if (attempt === attempts - 1) {
        throw new Error(SOLANA_RPC_BUSY_MESSAGE);
      }
      const jitter = Math.floor(random() * 250);
      await sleep(baseDelayMs * 2 ** attempt + jitter);
    }
  }

  throw new Error(SOLANA_RPC_BUSY_MESSAGE);
}
