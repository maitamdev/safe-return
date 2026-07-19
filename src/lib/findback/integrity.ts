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

export type ImageDescriptorV2 = {
  sha256: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  byteSize: number;
};

export type MetadataIntegrityInputV2 = MetadataIntegrityInput & {
  bountyId: string;
  owner: string;
  rewardBaseUnits: string;
  deadlineUnix: number;
  image: ImageDescriptorV2 | null;
};

export type EvidenceIntegrityInputV2 = Omit<EvidenceIntegrityInput, "imageDataUrl"> & {
  bountyId: string;
  image: ImageDescriptorV2 | null;
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

export function metadataIntegrityPayloadV2(input: MetadataIntegrityInputV2) {
  return JSON.stringify({
    version: 2,
    kind: "bounty-metadata",
    bountyId: canonicalText(input.bountyId),
    owner: input.owner,
    rewardBaseUnits: input.rewardBaseUnits,
    deadlineUnix: input.deadlineUnix,
    title: canonicalText(input.title),
    description: canonicalText(input.description),
    category: canonicalText(input.category),
    location: canonicalText(input.location),
    image: input.image,
  });
}

export function evidenceIntegrityPayloadV2(input: EvidenceIntegrityInputV2) {
  return JSON.stringify({
    version: 2,
    kind: "claim-evidence",
    bountyId: canonicalText(input.bountyId),
    finder: input.finder,
    description: canonicalText(input.description),
    location: canonicalText(input.location),
    foundAt: canonicalText(input.foundAt),
    image: input.image,
  });
}

export async function imageDescriptorFromDataUrl(
  dataUrl?: string | null
): Promise<ImageDescriptorV2 | null> {
  if (!dataUrl) return null;
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(
    dataUrl
  );
  if (!match) throw new Error("Ảnh phải là JPEG, PNG hoặc WebP dạng base64 hợp lệ.");

  let binary: string;
  try {
    binary = atob(match[2]);
  } catch {
    throw new Error("Không thể giải mã dữ liệu ảnh.");
  }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (bytes.length === 0) throw new Error("Ảnh không được để trống.");
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return {
    sha256: Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join(""),
    mimeType: match[1] as ImageDescriptorV2["mimeType"],
    byteSize: bytes.length,
  };
}

function canonicalText(value: string) {
  return value.normalize("NFC").replace(/\r\n/g, "\n");
}
