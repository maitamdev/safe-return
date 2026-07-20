import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  aiInputProvenancePayload,
  aiModelIdentityPayload,
  aiReportProvenancePayload,
  canonicalJson,
} from "./provenance";
import type { AiClaimReport } from "./types";

const input = {
  promptVersion: "review-v2",
  bountyId: "bounty-1",
  claimPda: "claim-pda",
  metadataHash: "a".repeat(64),
  evidenceHash: "b".repeat(64),
  owner: {
    title: "Ví màu đen",
    description: "Có đường chỉ trắng",
    category: "Ví",
    location: "Quận 1",
    imageSha256: "c".repeat(64),
  },
  finder: {
    description: "Ví da có chỉ trắng",
    location: "Quận 1",
    foundAt: "2026-07-20",
    imageSha256: null,
  },
};

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

describe("AI provenance commitments", () => {
  it("is canonical across newline and Unicode normalization", () => {
    const canonical = aiInputProvenancePayload(input);
    const equivalent = aiInputProvenancePayload({
      ...input,
      owner: { ...input.owner, description: "Co\u0301 đường chỉ trắng\r\n" },
    });
    const normalized = aiInputProvenancePayload({
      ...input,
      owner: { ...input.owner, description: "Có đường chỉ trắng\n" },
    });
    expect(equivalent).toBe(normalized);
    expect(hash(canonical)).toHaveLength(64);
  });

  it("changes when evidence or model identity changes", () => {
    expect(hash(aiInputProvenancePayload(input))).not.toBe(
      hash(aiInputProvenancePayload({ ...input, evidenceHash: "d".repeat(64) }))
    );
    expect(aiModelIdentityPayload({ provider: "groq", model: "qwen", promptVersion: "v1" }))
      .not.toBe(aiModelIdentityPayload({ provider: "groq", model: "qwen", promptVersion: "v2" }));
  });

  it("canonicalizes report object key order and line endings", () => {
    const first = {
      mode: "live",
      score: 80,
      decision: "REVIEW",
      matching_features: ["màu sắc"],
      contradictions: [],
      fraud_signals: [],
      explanation: "Dòng một\r\nDòng hai",
      confidence: 0.8,
    } satisfies AiClaimReport;
    const second = {
      confidence: 0.8,
      explanation: "Dòng một\nDòng hai",
      fraud_signals: [],
      contradictions: [],
      matching_features: ["màu sắc"],
      decision: "REVIEW",
      score: 80,
      mode: "live",
    } satisfies AiClaimReport;

    expect(aiReportProvenancePayload(first)).toBe(
      aiReportProvenancePayload(second)
    );
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it("keeps report provenance bound to every material field", () => {
    const report = {
      score: 80,
      decision: "REVIEW",
      matching_features: [],
      contradictions: [],
      fraud_signals: [],
      explanation: "Cần kiểm tra thêm",
      confidence: 0.8,
      mode: "live",
    } satisfies AiClaimReport;
    expect(hash(aiReportProvenancePayload(report))).not.toBe(
      hash(aiReportProvenancePayload({ ...report, score: 81 }))
    );
    expect(hash(aiReportProvenancePayload(report))).not.toBe(
      hash(aiReportProvenancePayload({ ...report, provider: "groq" }))
    );
  });
});
