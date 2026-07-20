import { createHash } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let decodeAndVerifyImageDataUrl: typeof import("./media").decodeAndVerifyImageDataUrl;

beforeAll(async () => {
  ({ decodeAndVerifyImageDataUrl } = await import("./media"));
});

function dataUrl(mimeType: string, bytes: Buffer) {
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

describe("Evidence Vault media boundary", () => {
  it("commits accepted bytes with SHA-256, MIME type and byte size", () => {
    const bytes = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01,
    ]);
    const result = decodeAndVerifyImageDataUrl(dataUrl("image/png", bytes));

    expect(result.bytes).toEqual(bytes);
    expect(result.descriptor).toEqual({
      sha256: createHash("sha256").update(bytes).digest("hex"),
      mimeType: "image/png",
      byteSize: bytes.length,
    });
  });

  it("rejects MIME spoofing even when the base64 payload is valid", () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
    expect(() => decodeAndVerifyImageDataUrl(dataUrl("image/png", jpeg))).toThrow(
      "không khớp định dạng ảnh",
    );
  });

  it("rejects active SVG content and unsupported data URL types", () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>');
    expect(() => decodeAndVerifyImageDataUrl(dataUrl("image/svg+xml", svg))).toThrow(
      "JPEG, PNG hoặc WebP",
    );
  });

  it("enforces the 1.2 MB decoded-byte limit", () => {
    const oversized = Buffer.alloc(1_200_001, 0);
    oversized.set([0xff, 0xd8, 0xff], 0);
    expect(() => decodeAndVerifyImageDataUrl(dataUrl("image/jpeg", oversized))).toThrow(
      "1,2 MB",
    );
  });
});
