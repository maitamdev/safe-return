import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  ApiError,
  apiErrorResponse,
  enforceRateLimit,
  requireSameOrigin,
} from "./api-security";

describe("API security boundaries", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts a matching browser Origin and server requests without Origin", () => {
    expect(() => requireSameOrigin(new Request("https://safe.test/api/action"))).not.toThrow();
    expect(() => requireSameOrigin(new Request("https://safe.test/api/action", {
      headers: { Origin: "https://safe.test" },
    }))).not.toThrow();
  });

  it("rejects cross-origin, scheme-confused, and malformed origins", () => {
    const requests = [
      new Request("https://safe.test/api/action", { headers: { Origin: "https://evil.test" } }),
      new Request("https://safe.test/api/action", { headers: { Origin: "http://safe.test" } }),
      new Request("https://safe.test/api/action", { headers: { Origin: "null" } }),
    ];

    for (const request of requests) {
      expect(() => requireSameOrigin(request)).toThrow(ApiError);
    }
  });

  it("enforces a fixed-window request limit", () => {
    const key = `security-test-${Date.now()}`;
    expect(() => enforceRateLimit(key, { limit: 2, windowMs: 60_000 })).not.toThrow();
    expect(() => enforceRateLimit(key, { limit: 2, windowMs: 60_000 })).not.toThrow();
    expect(() => enforceRateLimit(key, { limit: 2, windowMs: 60_000 })).toThrowError(
      expect.objectContaining({ status: 429 }),
    );
  });

  it("keeps unexpected internal errors out of API responses", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = apiErrorResponse(new Error("database password appeared here"));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(body.error).not.toContain("database password");
    expect(body.error).toContain("Vui lòng thử lại sau");
  });

  it("preserves deliberate public API errors", async () => {
    const response = apiErrorResponse(new ApiError(403, "Không có quyền truy cập."));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: "Không có quyền truy cập." });
  });
});
