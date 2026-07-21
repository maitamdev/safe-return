import { describe, expect, it } from "vitest";
import {
  isActionableOwnerClaim,
  isPayableClaimStatus,
  normalizeClaimStatus,
} from "./status";

describe("normalizeClaimStatus", () => {
  it("maps submitted variants", () => {
    expect(normalizeClaimStatus("submitted")).toBe("Submitted");
    expect(normalizeClaimStatus("claim_submitted")).toBe("Submitted");
    expect(normalizeClaimStatus("ClaimSubmitted")).toBe("Submitted");
    expect(normalizeClaimStatus("Submitted")).toBe("Submitted");
  });

  it("maps AI and terminal", () => {
    expect(normalizeClaimStatus("ai_reviewed")).toBe("AiReviewed");
    expect(normalizeClaimStatus("settled")).toBe("Settled");
    expect(normalizeClaimStatus("rejection_pending")).toBe("RejectionPending");
  });
});

describe("payable / actionable", () => {
  it("allows pay on submitted/ai", () => {
    expect(isPayableClaimStatus("submitted")).toBe(true);
    expect(isPayableClaimStatus("Submitted")).toBe(true);
    expect(isPayableClaimStatus("ai_reviewed")).toBe(true);
    expect(isActionableOwnerClaim("submitted", "awaiting_review")).toBe(true);
  });

  it("blocks pay on terminal / dispute", () => {
    expect(isPayableClaimStatus("Settled", "settled")).toBe(false);
    expect(isPayableClaimStatus("submitted", "rejection_pending")).toBe(false);
    expect(isPayableClaimStatus("Disputed", "disputed")).toBe(false);
    expect(isActionableOwnerClaim("Rejected", "rejected")).toBe(false);
  });
});
