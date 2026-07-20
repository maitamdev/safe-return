import { describe, expect, it, vi } from "vitest";
import {
  isSolanaRateLimitError,
  withRpcReadRetry,
} from "./rpc-read";

describe("Solana RPC read resilience", () => {
  it("recognizes HTTP and JSON-RPC rate limits", () => {
    expect(isSolanaRateLimitError(new Error("429 Too Many Requests"))).toBe(true);
    expect(isSolanaRateLimitError({ message: "rate limit" })).toBe(true);
    expect(isSolanaRateLimitError(new Error("Account not found"))).toBe(false);
  });

  it("retries a rate-limited read with bounded backoff", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("Error: 429 Too many requests"))
      .mockResolvedValue("ok");
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(
      withRpcReadRetry(operation, {
        attempts: 2,
        baseDelayMs: 100,
        random: () => 0,
        sleep,
      }),
    ).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(100);
  });

  it("does not retry unrelated program errors", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("custom program error"));
    const sleep = vi.fn();

    await expect(withRpcReadRetry(operation)).rejects.toThrow("custom program error");
    expect(operation).toHaveBeenCalledOnce();
    expect(sleep).not.toHaveBeenCalled();
  });
});
