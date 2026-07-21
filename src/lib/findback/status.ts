/** Shared Vietnamese status copy and claim-status normalizers. */

export const BOUNTY_STATUS_LABELS: Record<string, string> = {
  Draft: "Chờ khóa thưởng",
  Funded: "Đang nhận claim",
  ClaimSubmitted: "Đã có claim",
  AiReviewed: "Đã đánh giá",
  Released: "Đã trả thưởng",
  Refunded: "Đã hoàn tiền",
  Disputed: "Đang tranh chấp",
  Cancelled: "Đã hủy",
};

export function bountyStatusLabel(status?: string | null) {
  if (!status) return BOUNTY_STATUS_LABELS.Draft;
  return BOUNTY_STATUS_LABELS[status] || status;
}

export function bountyStatusTone(status?: string | null) {
  const s = status || "Draft";
  const map: Record<string, string> = {
    Draft: "border-line bg-bg-deep text-ink-soft",
    Funded: "status-pill-ok",
    ClaimSubmitted: "border-line bg-surface-soft text-ink",
    AiReviewed: "status-pill-warn",
    Released: "status-pill-ok",
    Refunded: "status-pill-warn",
    Disputed: "status-pill-danger",
    Cancelled: "border-line bg-bg-deep text-ink-muted",
  };
  return map[s] || "border-line bg-bg-deep text-ink-soft";
}

/** Normalize DB / chain / legacy claim labels to a single PascalCase form. */
export function normalizeClaimStatus(status?: string | null): string {
  if (!status) return "Submitted";
  const raw = status.trim();
  if (!raw) return "Submitted";
  // Already PascalCase on-chain labels
  if (/^[A-Z][A-Za-z]+$/.test(raw)) {
    if (raw === "ClaimSubmitted") return "Submitted";
    return raw;
  }
  const lower = raw.toLowerCase().replace(/[\s-]+/g, "_");
  const map: Record<string, string> = {
    submitted: "Submitted",
    claim_submitted: "Submitted",
    ai_reviewed: "AiReviewed",
    aireviewed: "AiReviewed",
    rejection_pending: "RejectionPending",
    rejected: "Rejected",
    disputed: "Disputed",
    settled: "Settled",
    released: "Released",
    awaiting_review: "Submitted",
    more_info_requested: "Submitted",
    handover_proposed: "Submitted",
    handover_scheduled: "Submitted",
    finder_delivered: "Submitted",
  };
  if (map[lower]) return map[lower];
  // snake_case → PascalCase fallback
  return lower
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

const TERMINAL_CLAIM = new Set([
  "Settled",
  "Rejected",
  "Released",
]);

const PAYABLE_CLAIM = new Set([
  "Submitted",
  "AiReviewed",
  "ClaimSubmitted",
]);

/** Claim still competes for escrow (owner must act or wait window). */
export function isActiveClaimStatus(status?: string | null, workflowStatus?: string | null) {
  const wf = (workflowStatus || "").toLowerCase();
  if (["settled", "rejected"].includes(wf)) return false;
  const n = normalizeClaimStatus(status);
  if (TERMINAL_CLAIM.has(n)) return false;
  // rejection_pending / disputed still "open" for dispute window, but not for pay banner count
  return ["Submitted", "AiReviewed", "RejectionPending", "Disputed"].includes(n) ||
    ["awaiting_review", "more_info_requested", "handover_proposed", "handover_scheduled", "finder_delivered", "rejection_pending", "disputed"].includes(wf);
}

/** Owner may accept/pay this claim on-chain. */
export function isPayableClaimStatus(status?: string | null, workflowStatus?: string | null) {
  const wf = (workflowStatus || "").toLowerCase();
  if (["settled", "rejected", "rejection_pending", "disputed"].includes(wf)) return false;
  const n = normalizeClaimStatus(status);
  return PAYABLE_CLAIM.has(n) ||
    ["awaiting_review", "more_info_requested", "handover_proposed", "handover_scheduled", "finder_delivered"].includes(wf);
}

/** Open claims that still need owner attention (pay/reject), excluding dispute window. */
export function isActionableOwnerClaim(status?: string | null, workflowStatus?: string | null) {
  return isPayableClaimStatus(status, workflowStatus);
}
