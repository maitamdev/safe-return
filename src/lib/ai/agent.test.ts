import { afterEach, describe, expect, it, vi } from "vitest";
import { runClaimReview } from "./agent";

const input = {
  ownerTitle: "Ví da màu đen",
  ownerDescription: "Ví có đường chỉ trắng và một vết xước nhỏ.",
  finderDescription: "Tìm thấy ví da màu đen có chỉ trắng.",
  ownerImageDataUrl: "data:image/jpeg;base64,b3duZXI=",
  finderImageDataUrl: "data:image/jpeg;base64,ZmluZGVy",
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
    expect(report.evidence_quality).toBe("image-backed");
    expect(report.evidence_notes).toEqual([]);
  });

  it("marks a claim without images as text-only and prevents ACCEPT", async () => {
    vi.stubEnv("GROQ_API_KEY", "groq-provider-key");
    vi.stubEnv("GROQ_MODEL", "vision-model");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{
            message: {
              content: JSON.stringify({
                score: 92,
                decision: "ACCEPT",
                matching_features: ["Mô tả màu sắc trùng khớp"],
                contradictions: [],
                fraud_signals: [],
                explanation: "Mô tả có nhiều điểm phù hợp.",
                confidence: 0.94,
              }),
            },
          }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const report = await runClaimReview({
      ownerTitle: input.ownerTitle,
      ownerDescription: input.ownerDescription,
      finderDescription: input.finderDescription,
    });

    expect(report.decision).toBe("REVIEW");
    expect(report.score).toBe(69);
    expect(report.confidence).toBe(0.55);
    expect(report.evidence_quality).toBe("text-only");
    expect(report.evidence_notes).toEqual([
      "Chủ tin chưa cung cấp ảnh tham chiếu.",
      "Người gửi claim chưa cung cấp ảnh bằng chứng.",
    ]);

    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(request.messages[1].content).toHaveLength(1);
    expect(request.messages[1].content[0].text).toContain(
      "Finder evidence image: not provided"
    );
  });
});
