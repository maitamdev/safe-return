import { describe, expect, it } from "vitest";
import { evidenceIntegrityPayload, metadataIntegrityPayload } from "./integrity";

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
});
