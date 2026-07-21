import { describe, expect, it } from "vitest";
import { bountyStatusLabel, bountyStatusTone } from "./status";

describe("bounty status helpers", () => {
  it("maps known statuses to Vietnamese labels", () => {
    expect(bountyStatusLabel("Funded")).toContain("claim");
    expect(bountyStatusLabel("Released")).toContain("trả thưởng");
    expect(bountyStatusLabel(undefined)).toContain("khóa thưởng");
  });

  it("uses semantic tone classes instead of hard-coded amber/rose", () => {
    expect(bountyStatusTone("Disputed")).toContain("status-pill-danger");
    expect(bountyStatusTone("Funded")).toContain("status-pill-ok");
    expect(bountyStatusTone("AiReviewed")).toContain("status-pill-warn");
    expect(bountyStatusTone("Unknown")).toContain("border-line");
  });
});
