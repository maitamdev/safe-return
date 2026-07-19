import type { ImageDescriptorV2 } from "@/lib/findback/integrity";

export type StoredMedia = ImageDescriptorV2 & {
  storagePath: string;
};

export type MediaPurpose = "listing" | "claim";
