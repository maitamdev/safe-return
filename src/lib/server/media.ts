import "server-only";

import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImageDescriptorV2 } from "@/lib/findback/integrity";
import type { MediaPurpose, StoredMedia } from "@/lib/media/types";
import { ApiError } from "@/lib/server/api-security";

const MAX_IMAGE_BYTES = 1_200_000;
const DATA_IMAGE = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

const EXTENSION: Record<ImageDescriptorV2["mimeType"], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function decodeAndVerifyImageDataUrl(dataUrl: string) {
  const match = DATA_IMAGE.exec(dataUrl);
  if (!match) {
    throw new ApiError(400, "Ảnh phải là JPEG, PNG hoặc WebP hợp lệ.");
  }
  const mimeType = match[1] as ImageDescriptorV2["mimeType"];
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
    throw new ApiError(400, "Ảnh phải có dung lượng từ 1 byte đến 1,2 MB.");
  }
  if (!hasExpectedSignature(bytes, mimeType)) {
    throw new ApiError(400, "Nội dung tệp không khớp định dạng ảnh đã khai báo.");
  }
  return {
    bytes,
    descriptor: {
      sha256: createHash("sha256").update(bytes).digest("hex"),
      mimeType,
      byteSize: bytes.length,
    } satisfies ImageDescriptorV2,
  };
}

export async function storePrivateImage(args: {
  admin: SupabaseClient;
  userId: string;
  bountyId: string;
  purpose: MediaPurpose;
  dataUrl: string;
}): Promise<StoredMedia> {
  const { bytes, descriptor } = decodeAndVerifyImageDataUrl(args.dataUrl);
  const bucket = args.purpose === "listing" ? "listing-media" : "claim-evidence";
  const safeBountyId = args.bountyId.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
  if (!safeBountyId) throw new ApiError(400, "Mã bounty không hợp lệ.");
  const storagePath = `${args.userId}/${safeBountyId}/${randomUUID()}.${EXTENSION[descriptor.mimeType]}`;
  const { error } = await args.admin.storage.from(bucket).upload(storagePath, bytes, {
    contentType: descriptor.mimeType,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw new Error(`Không lưu được ảnh bằng chứng: ${error.message}`);
  return { storagePath, ...descriptor };
}

export async function removePrivateImage(
  admin: SupabaseClient,
  purpose: MediaPurpose,
  storagePath: string
) {
  const bucket = purpose === "listing" ? "listing-media" : "claim-evidence";
  await admin.storage.from(bucket).remove([storagePath]);
}

function hasExpectedSignature(bytes: Buffer, mimeType: ImageDescriptorV2["mimeType"]) {
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return bytes.length >= 8 && bytes.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
  }
  return bytes.length >= 12
    && bytes.subarray(0, 4).toString("ascii") === "RIFF"
    && bytes.subarray(8, 12).toString("ascii") === "WEBP";
}
