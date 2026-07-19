export type MetadataIntegrityInput = {
  title: string;
  description: string;
  category: string;
  location: string;
};

export type EvidenceIntegrityInput = {
  description: string;
  location: string;
  foundAt: string;
  imageDataUrl?: string | null;
  finder: string;
};

export function metadataIntegrityPayload(input: MetadataIntegrityInput) {
  return JSON.stringify({
    title: input.title,
    description: input.description,
    category: input.category,
    location: input.location,
  });
}

export function evidenceIntegrityPayload(input: EvidenceIntegrityInput) {
  return JSON.stringify({
    description: input.description,
    location: input.location,
    foundAt: input.foundAt,
    image: input.imageDataUrl ? "attached" : null,
    finder: input.finder,
  });
}
