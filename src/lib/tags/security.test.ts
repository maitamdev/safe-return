import { describe, expect, it } from "vitest";
import {
  cleanSafeTagText,
  createSafeTagCode,
  isSafeTagCode,
  reporterFingerprint,
} from "./security";

describe("SafeTag public boundary", () => {
  it("creates opaque 144-bit base64url codes", () => {
    const codes = new Set(Array.from({ length: 64 }, () => createSafeTagCode()));
    expect(codes.size).toBe(64);
    for (const code of codes) {
      expect(code).toHaveLength(24);
      expect(isSafeTagCode(code)).toBe(true);
    }
  });

  it("rejects malformed, shortened, or path-like codes", () => {
    expect(isSafeTagCode("a".repeat(23))).toBe(false);
    expect(isSafeTagCode("a".repeat(25))).toBe(false);
    expect(isSafeTagCode("../../private-object!!")).toBe(false);
  });

  it("normalizes public text and enforces the stored length", () => {
    expect(cleanSafeTagText("  Ví   màu đen\n ở bàn  ", 80)).toBe("Ví màu đen ở bàn");
    expect(cleanSafeTagText("abcdef", 4)).toBe("abcd");
    expect(cleanSafeTagText({ value: "no" }, 80)).toBe("");
  });

  it("stores only a deterministic HMAC fingerprint, never the raw IP", () => {
    const first = reporterFingerprint({
      secret: "service-role-secret",
      code: "A".repeat(24),
      ip: "203.0.113.42",
      userAgent: "SafeBrowser/1",
    });
    const second = reporterFingerprint({
      secret: "service-role-secret",
      code: "A".repeat(24),
      ip: "203.0.113.42",
      userAgent: "SafeBrowser/1",
    });

    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toContain("203.0.113.42");
  });
});
