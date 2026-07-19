import type { MediaPurpose, StoredMedia } from "./types";

export function privateMediaUrl(args: {
  purpose: MediaPurpose;
  bountyId: string;
  claimId?: string;
  mode?: "image" | "verify";
}) {
  const query = new URLSearchParams({
    purpose: args.purpose,
    bountyId: args.bountyId,
  });
  if (args.claimId) query.set("claimId", args.claimId);
  if (args.mode === "verify") query.set("mode", "verify");
  return `/api/media/view?${query.toString()}`;
}

export async function uploadPrivateMedia(args: {
  purpose: MediaPurpose;
  bountyId: string;
  dataUrl: string;
}): Promise<StoredMedia> {
  const response = await fetch("/api/media/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const json = (await response.json().catch(() => ({}))) as {
    media?: StoredMedia;
    error?: string;
  };
  if (!response.ok || !json.media) {
    throw new Error(json.error || "Không tải được ảnh bằng chứng.");
  }
  return json.media;
}
