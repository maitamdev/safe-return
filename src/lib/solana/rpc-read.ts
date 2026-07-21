import { resolveSolanaRpcEndpoints } from "./rpc-endpoints";

export const SOLANA_RPC_BUSY_MESSAGE =
  "Solana Devnet đang giới hạn truy cập. SafeReturn sẽ tự thử lại; vui lòng chờ vài giây.";

export function isSolanaRateLimitError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && "message" in error
        ? String(error.message)
        : String(error);
  return /\b429\b|too many requests|rate.?limit|fetch failed|network|ECONNRESET|ETIMEDOUT|503|502|504/i.test(
    message,
  );
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

/**
 * Run a Connection-bound read against each configured RPC until one succeeds.
 * Used for critical reads when the primary endpoint is rate-limited.
 */
export async function withRpcEndpointFailover<T>(
  run: (endpoint: string) => Promise<T>,
  options: {
    endpoints?: string[];
    attemptsPerEndpoint?: number;
  } = {},
): Promise<T> {
  const endpoints = options.endpoints ?? resolveSolanaRpcEndpoints();
  const attemptsPerEndpoint = options.attemptsPerEndpoint ?? 2;
  let lastError: unknown;

  for (const endpoint of endpoints) {
    try {
      return await withRpcReadRetry(() => run(endpoint), {
        attempts: attemptsPerEndpoint,
        baseDelayMs: 400,
      });
    } catch (error) {
      lastError = error;
      if (!isSolanaRateLimitError(error) && !(error instanceof Error && error.message === SOLANA_RPC_BUSY_MESSAGE)) {
        throw error;
      }
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error(SOLANA_RPC_BUSY_MESSAGE);
}
