import { describe, expect, it } from "vitest";
import {
  evidenceIntegrityPayload,
  evidenceIntegrityPayloadV2,
  imageDescriptorFromDataUrl,
  metadataIntegrityPayload,
  metadataIntegrityPayloadV2,
} from "./integrity";

describe("on-chain integrity payloads", () => {
  it("changes the metadata payload when a persisted field changes", () => {
    const base = {
      title: "Ví da đen",
      description: "Có đường chỉ trắng",
      category: "Ví và túi",
      location: "Thư viện",
    };
    expect(metadataIntegrityPayload(base)).not.toBe(
      metadataIntegrityPayload({ ...base, location: "Nhà xe" })
    );
  });

  it("binds evidence to its finder and image presence", () => {
    const base = {
      description: "Ví da đen có đường chỉ trắng",
      location: "Thư viện",
      foundAt: "2026-07-20T09:30",
      finder: "FinderWallet",
    };
    expect(evidenceIntegrityPayload(base)).not.toBe(
      evidenceIntegrityPayload({ ...base, finder: "AnotherWallet" })
    );
    expect(evidenceIntegrityPayload(base)).not.toBe(
      evidenceIntegrityPayload({ ...base, imageDataUrl: "data:image/jpeg;base64,real" })
    );
  });

  it("binds v2 evidence to the exact image bytes", async () => {
    const firstImage = await imageDescriptorFromDataUrl(
      "data:image/jpeg;base64,AAEC"
    );
    const changedImage = await imageDescriptorFromDataUrl(
      "data:image/jpeg;base64,AAED"
    );
    expect(firstImage?.sha256).not.toBe(changedImage?.sha256);

    const base = {
      bountyId: "bounty-1",
      finder: "FinderWallet",
      description: "Ví da đen có đường chỉ trắng",
      location: "Thư viện",
      foundAt: "2026-07-20T09:30",
      image: firstImage,
    };
    expect(evidenceIntegrityPayloadV2(base)).not.toBe(
      evidenceIntegrityPayloadV2({ ...base, image: changedImage })
    );
  });

  it("canonicalizes text and commits all settlement-relevant metadata", () => {
    const input = {
      bountyId: "bounty-1",
      owner: "OwnerWallet",
      rewardBaseUnits: "100000000",
      deadlineUnix: 1_800_000_000,
      title: "Vi\u0301 da",
      description: "Dòng một\r\nDòng hai",
      category: "Ví và túi",
      location: "Thư viện",
      image: null,
    };
    const payload = metadataIntegrityPayloadV2(input);
    expect(payload).toContain('"title":"Ví da"');
    expect(payload).toContain('"description":"Dòng một\\nDòng hai"');
    expect(payload).toContain('"rewardBaseUnits":"100000000"');
  });

  it("rejects unsupported or malformed image data", async () => {
    await expect(
      imageDescriptorFromDataUrl("data:text/plain;base64,SGVsbG8=")
    ).rejects.toThrow("JPEG, PNG hoặc WebP");
    await expect(imageDescriptorFromDataUrl("data:image/png;base64,"))
      .rejects.toThrow("JPEG, PNG hoặc WebP");
  });
});
