export const CLAIM_WORKFLOW_STATUSES = [
  "awaiting_review",
  "more_info_requested",
  "handover_proposed",
  "handover_scheduled",
  "finder_delivered",
  "settled",
  "rejected",
  "rejection_pending",
  "disputed",
] as const;

export type ClaimWorkflowStatus = (typeof CLAIM_WORKFLOW_STATUSES)[number];
export type ClaimParticipantRole = "owner" | "finder";

export type ClaimMessage = {
  id: string;
  senderRole: ClaimParticipantRole;
  kind: "message" | "system";
  body: string;
  createdAt: string;
  mine: boolean;
};

export type ClaimHandover = {
  scheduledAt: string;
  meetingLocation: string;
  note: string;
  status: "proposed" | "accepted" | "cancelled";
  proposedByMe: boolean;
  acceptedAt: string | null;
  finderDeliveredAt: string | null;
  ownerReceivedAt: string | null;
};

export type ClaimWorkflow = {
  claimId: string;
  bountyId: string;
  role: ClaimParticipantRole;
  status: ClaimWorkflowStatus;
  messages: ClaimMessage[];
  handover: ClaimHandover | null;
};

export type ClaimWorkflowAction =
  | { action: "send_message"; message: string }
  | { action: "request_info" }
  | {
      action: "propose_handover";
      scheduledAt: string;
      meetingLocation: string;
      note?: string;
    }
  | { action: "accept_handover" }
  | { action: "cancel_handover" }
  | { action: "mark_delivered" };

export function cleanWorkflowText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n?/g, "\n")
    .trim()
    .slice(0, maxLength);
}

export function canMutateWorkflow(status: ClaimWorkflowStatus) {
  return !(
    ["settled", "rejected", "rejection_pending", "disputed"] as ClaimWorkflowStatus[]
  ).includes(status);
}

export function workflowStatusLabel(status: ClaimWorkflowStatus) {
  const labels: Record<ClaimWorkflowStatus, string> = {
    awaiting_review: "Chờ chủ đồ kiểm tra",
    more_info_requested: "Cần bổ sung thông tin",
    handover_proposed: "Đang chờ xác nhận lịch hẹn",
    handover_scheduled: "Đã thống nhất lịch giao đồ",
    finder_delivered: "Người tìm thấy đã xác nhận giao",
    settled: "Đã nhận đồ và trả thưởng",
    rejected: "Bằng chứng đã bị từ chối",
    rejection_pending: "Đang trong thời hạn phản hồi",
    disputed: "Đang được phân xử",
  };
  return labels[status];
}
