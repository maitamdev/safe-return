import { afterEach, describe, expect, it, vi } from "vitest";
import { runClaimReview } from "./agent";

const input = {
  ownerTitle: "Ví da màu đen",
  ownerDescription: "Ví có đường chỉ trắng và một vết xước nhỏ.",
  finderDescription: "Tìm thấy ví da màu đen có chỉ trắng.",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("live claim review", () => {
  it("fails closed instead of generating a fallback result without an AI key", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("FIND_BACK_AI_KEY", "");
    vi.stubEnv("GROQ_API_KEY", "");

    await expect(runClaimReview(input)).rejects.toThrow(
      "AI trực tuyến chưa được cấu hình"
    );
  });

  it("returns a live Groq Vision report from the configured provider", async () => {
    vi.stubEnv("GROQ_API_KEY", "groq-provider-key");
    vi.stubEnv("GROQ_MODEL", "vision-model");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    score: 84,
                    decision: "ACCEPT",
                    matching_features: ["Màu sắc và đường chỉ trùng khớp"],
                    contradictions: [],
                    fraud_signals: [],
                    explanation: "Bằng chứng có nhiều đặc điểm phù hợp.",
                    confidence: 0.82,
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    const report = await runClaimReview(input);
    expect(report.mode).toBe("live");
    expect(report.provider).toBe("groq");
    expect(report.model).toBe("vision-model");
    expect(report.score).toBe(84);
  });
});
