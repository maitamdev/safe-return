import type { MediaPurpose, StoredMedia } from "./types";

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
