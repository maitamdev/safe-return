import { describe, expect, it } from "vitest";
import { fromAtomic, toAtomic } from "./config";

describe("FIND amount conversion", () => {
  it("converts UI amounts to six-decimal atomic units", () => {
    expect(toAtomic(1)).toBe(BigInt(1_000_000));
    expect(toAtomic(12.345678)).toBe(BigInt(12_345_678));
  });

  it("round-trips normal reward values", () => {
    expect(fromAtomic(toAtomic(42.125))).toBe(42.125);
  });
});
