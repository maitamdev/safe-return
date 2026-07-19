import { describe, expect, it } from "vitest";
import { toBigIntBE, toBigIntLE, toBufferBE, toBufferLE } from "./bigint-buffer";

describe("pure bigint buffer conversion", () => {
  it("round-trips big-endian values", () => {
    const value = BigInt("12345678901234567890");
    expect(toBigIntBE(toBufferBE(value, 16))).toBe(value);
  });

  it("round-trips little-endian values", () => {
    const value = BigInt("9876543210987654321");
    expect(toBigIntLE(toBufferLE(value, 16))).toBe(value);
  });

  it("handles empty buffers", () => {
    expect(toBigIntBE(Buffer.alloc(0))).toBe(BigInt(0));
  });
});
