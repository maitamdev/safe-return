import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { aiInputProvenancePayload, aiModelIdentityPayload } from "./provenance";

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
});
