import type { AiClaimReport } from "./types";

export type AiProvenanceInput = {
  promptVersion: string;
  bountyId: string;
  claimPda: string;
  metadataHash: string;
  evidenceHash: string;
  owner: {
    title: string;
    description: string;
    category?: string;
    location?: string;
    imageSha256?: string | null;
  };
  finder: {
    description: string;
    location?: string;
    foundAt?: string;
    imageSha256?: string | null;
  };
};

export function aiInputProvenancePayload(input: AiProvenanceInput) {
  return canonicalJson({
    version: 2,
    kind: "ai-review-input",
    promptVersion: input.promptVersion,
    bountyId: canonical(input.bountyId),
    claimPda: input.claimPda,
    metadataHash: input.metadataHash,
    evidenceHash: input.evidenceHash,
    owner: {
      title: canonical(input.owner.title),
      description: canonical(input.owner.description),
      category: canonical(input.owner.category || ""),
      location: canonical(input.owner.location || ""),
      imageSha256: input.owner.imageSha256 || null,
    },
    finder: {
      description: canonical(input.finder.description),
      location: canonical(input.finder.location || ""),
      foundAt: canonical(input.finder.foundAt || ""),
      imageSha256: input.finder.imageSha256 || null,
    },
  });
}

export function aiModelIdentityPayload(input: {
  provider?: string;
  model?: string;
  promptVersion: string;
}) {
  return canonicalJson({
    version: 1,
    provider: input.provider || "unknown",
    model: input.model || "unknown",
    promptVersion: input.promptVersion,
  });
}

/**
 * Canonical payload used when committing a model response.  JSON.stringify is
 * insertion-order dependent, which means semantically identical reports can
 * otherwise produce different hashes after a refactor or a database round
 * trip.  Keep the payload deterministic so anyone can recompute the report
 * commitment from the public `ai_report` value.
 */
export function aiReportProvenancePayload(report: AiClaimReport): string {
  return canonicalJson({
    version: 1,
    kind: "ai-review-report",
    report,
  });
}

/** Stable JSON encoding for provenance commitments. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (typeof value === "string") return value.normalize("NFC").replace(/\r\n/g, "\n");
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((out, key) => {
        const item = record[key];
        if (item !== undefined) out[key] = sortJson(item);
        return out;
      }, {});
  }
  return value;
}

function canonical(value: string) {
  return value.normalize("NFC").replace(/\r\n/g, "\n");
}
