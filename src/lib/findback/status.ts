/** Shared Vietnamese status copy for bounty cards and detail pages. */

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
