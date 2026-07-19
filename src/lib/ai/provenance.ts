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
  return JSON.stringify({
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
  return JSON.stringify({
    version: 1,
    provider: input.provider || "unknown",
    model: input.model || "unknown",
    promptVersion: input.promptVersion,
  });
}

function canonical(value: string) {
  return value.normalize("NFC").replace(/\r\n/g, "\n");
}
