import { describe, expect, it } from "vitest";
import {
  explorerAddressUrl,
  explorerTokensUrl,
  explorerTxUrl,
  FIND_DECIMALS,
  FIND_MINT,
  FINDBACK_PROGRAM_ID,
  fromAtomic,
  SOLANA_CLUSTER,
  toAtomic,
} from "./config";

describe("FIND amount conversion", () => {
  it("converts UI amounts to six-decimal atomic units", () => {
    expect(FIND_DECIMALS).toBe(6);
    expect(toAtomic(1)).toBe(BigInt(1_000_000));
    expect(toAtomic(12.345678)).toBe(BigInt(12_345_678));
  });

  it("round-trips normal reward values", () => {
    expect(fromAtomic(toAtomic(42.125))).toBe(42.125);
  });

  it("builds explorer URLs on Devnet without double query strings", () => {
    expect(SOLANA_CLUSTER).toBe("devnet");
    expect(explorerTxUrl("sig123")).toContain("cluster=devnet");
    expect(explorerAddressUrl(FINDBACK_PROGRAM_ID)).toContain(FINDBACK_PROGRAM_ID);
    expect(explorerTokensUrl(FIND_MINT)).toMatch(/\/tokens\?cluster=devnet$/);
    expect(explorerTokensUrl(FIND_MINT)).not.toContain("?cluster=devnet/tokens");
  });
});
