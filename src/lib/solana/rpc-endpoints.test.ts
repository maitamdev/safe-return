import { afterEach, describe, expect, it } from "vitest";
import { primarySolanaRpc, resolveSolanaRpcEndpoints } from "./rpc-endpoints";

const ORIGINAL = {
  primary: process.env.NEXT_PUBLIC_SOLANA_RPC,
  fallbacks: process.env.NEXT_PUBLIC_SOLANA_RPC_FALLBACKS,
};

afterEach(() => {
  if (ORIGINAL.primary === undefined) delete process.env.NEXT_PUBLIC_SOLANA_RPC;
  else process.env.NEXT_PUBLIC_SOLANA_RPC = ORIGINAL.primary;
  if (ORIGINAL.fallbacks === undefined) delete process.env.NEXT_PUBLIC_SOLANA_RPC_FALLBACKS;
  else process.env.NEXT_PUBLIC_SOLANA_RPC_FALLBACKS = ORIGINAL.fallbacks;
});

describe("resolveSolanaRpcEndpoints", () => {
  it("puts the dedicated primary RPC first and de-duplicates fallbacks", () => {
    process.env.NEXT_PUBLIC_SOLANA_RPC = "https://devnet.helius-rpc.com/?api-key=demo";
    process.env.NEXT_PUBLIC_SOLANA_RPC_FALLBACKS =
      "https://api.devnet.solana.com, https://rpc.ankr.com/solana_devnet";
    const endpoints = resolveSolanaRpcEndpoints();
    expect(endpoints[0]).toContain("helius-rpc.com");
    expect(endpoints.filter((u) => u.includes("api.devnet.solana.com"))).toHaveLength(1);
    expect(new Set(endpoints).size).toBe(endpoints.length);
  });

  it("always includes at least one public Devnet endpoint", () => {
    delete process.env.NEXT_PUBLIC_SOLANA_RPC;
    delete process.env.NEXT_PUBLIC_SOLANA_RPC_FALLBACKS;
    const endpoints = resolveSolanaRpcEndpoints(undefined, undefined);
    expect(endpoints.length).toBeGreaterThanOrEqual(1);
    expect(endpoints.some((u) => u.includes("devnet"))).toBe(true);
    expect(primarySolanaRpc()).toBe(endpoints[0]);
  });
});
