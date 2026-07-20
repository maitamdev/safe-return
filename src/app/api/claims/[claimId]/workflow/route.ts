import {
  ApiError,
  apiErrorResponse,
  enforceDistributedRateLimit,
  enforceRateLimit,
  requireApiUser,
  requireSameOrigin,
} from "@/lib/server/api-security";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  cleanWorkflowText,
  type ClaimParticipantRole,
  type ClaimWorkflowAction,
  type ClaimWorkflowStatus,
} from "@/lib/findback/workflow";

export const runtime = "nodejs";

type ClaimRow = {
  id: string;
  bounty_id: string;
  finder_id: string;
  workflow_status: ClaimWorkflowStatus;
};

type BountyRow = { id: string; owner_id: string };
type ParticipantContext = {
  claim: ClaimRow;
  bounty: BountyRow;
  role: ClaimParticipantRole;
  userId: string;
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ claimId: string }> },
) {
  try {
    const user = await requireApiUser();
    const { claimId } = await params;
    const admin = createAdminClient();
    const context = await requireParticipant(
      admin,
      cleanWorkflowText(claimId, 80),
      user.id,
    );
    return Response.json(await readWorkflow(admin, context), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ claimId: string }> },
) {
  try {
    requireSameOrigin(req);
    const user = await requireApiUser();
    enforceRateLimit(`claim-workflow:${user.id}`, {
      limit: 40,
      windowMs: 60_000,
    });
    const { claimId } = await params;
    const body = (await req.json()) as ClaimWorkflowAction;
    const admin = createAdminClient();
    const context = await requireParticipant(
      admin,
      cleanWorkflowText(claimId, 80),
      user.id,
    );
    await enforceDistributedRateLimit(admin, `claim-workflow:${user.id}`, {
      limit: 40,
      windowMs: 60_000,
    });

    const { error } = await admin.rpc(
      "apply_claim_workflow_action",
      workflowRpcArgs(body, context),
    );
    if (error) throw workflowRpcError(error.message);

    const refreshed = await requireParticipant(admin, context.claim.id, user.id);
    return Response.json(await readWorkflow(admin, refreshed), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

function workflowRpcArgs(body: ClaimWorkflowAction, context: ParticipantContext) {
  let message = "";
  let scheduledAt: string | null = null;
  let meetingLocation = "";
  let note = "";

  if (body.action === "send_message") {
    message = cleanWorkflowText(body.message, 1200);
    if (!message) throw new ApiError(400, "Hãy nhập nội dung tin nhắn.");
  } else if (body.action === "propose_handover") {
    meetingLocation = cleanWorkflowText(body.meetingLocation, 200);
    note = cleanWorkflowText(body.note, 500);
    if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(body.scheduledAt)) {
      throw new ApiError(400, "Thời gian hẹn phải kèm múi giờ hợp lệ.");
    }
    const parsed = new Date(body.scheduledAt);
    if (!Number.isFinite(parsed.getTime())) {
      throw new ApiError(400, "Thời gian hẹn không hợp lệ.");
    }
    scheduledAt = parsed.toISOString();
  }

  return {
    p_claim_id: context.claim.id,
    p_actor_id: context.userId,
    p_action: body.action,
    p_message: message,
    p_scheduled_at: scheduledAt,
    p_meeting_location: meetingLocation,
    p_note: note,
  };
}

function workflowRpcError(message: string) {
  const errors: Array<[string, number, string]> = [
    ["WORKFLOW_NOT_FOUND", 404, "Không tìm thấy bằng chứng."],
    ["WORKFLOW_FORBIDDEN", 403, "Bạn không thuộc cuộc trao đổi này."],
    ["OWNER_ONLY", 403, "Chỉ chủ đồ được thực hiện thao tác này."],
    ["FINDER_ONLY", 403, "Chỉ người tìm thấy được thực hiện thao tác này."],
    ["WORKFLOW_CLOSED", 409, "Yêu cầu đã kết thúc hoặc đang được phân xử."],
    ["WORKFLOW_STATE_CHANGED", 409, "Trạng thái vừa thay đổi. Hãy tải lại trước khi tiếp tục."],
    ["HANDOVER_ALREADY_ACTIVE", 409, "Đã có lịch hẹn đang hoạt động."],
    ["HANDOVER_NOT_PROPOSED", 409, "Lịch hẹn không còn chờ xác nhận."],
    ["HANDOVER_NOT_ACTIVE", 409, "Không có lịch hẹn đang hoạt động."],
    ["HANDOVER_NOT_ACCEPTED", 409, "Lịch hẹn chưa được cả hai bên xác nhận."],
    ["OTHER_PARTY_REQUIRED", 409, "Cần bên còn lại xác nhận lịch hẹn này."],
    ["DELIVERY_ALREADY_MARKED", 409, "Việc giao đồ đã được ghi nhận."],
    ["DELIVERY_TOO_EARLY", 409, "Chỉ có thể xác nhận giao đồ từ 30 phút trước giờ hẹn."],
    ["SCHEDULE_INVALID", 400, "Thời gian hẹn phải nằm trong 60 ngày tới."],
    ["LOCATION_INVALID", 400, "Hãy nhập địa điểm hẹn cụ thể."],
    ["MESSAGE_INVALID", 400, "Nội dung tin nhắn không hợp lệ."],
    ["ACTION_INVALID", 400, "Hành động không hợp lệ."],
  ];
  const match = errors.find(([code]) => message.includes(code));
  return match ? new ApiError(match[1], match[2]) : new Error(message);
}

async function requireParticipant(
  admin: ReturnType<typeof createAdminClient>,
  claimId: string,
  userId: string,
): Promise<ParticipantContext> {
  if (!claimId) throw new ApiError(400, "Thiếu mã bằng chứng.");
  const { data: claim, error: claimError } = await admin
    .from("claims")
    .select("id,bounty_id,finder_id,workflow_status")
    .eq("id", claimId)
    .maybeSingle();
  if (claimError) throw new Error(claimError.message);
  if (!claim) throw new ApiError(404, "Không tìm thấy bằng chứng.");
  const { data: bounty, error: bountyError } = await admin
    .from("bounties")
    .select("id,owner_id")
    .eq("id", claim.bounty_id)
    .maybeSingle();
  if (bountyError) throw new Error(bountyError.message);
  if (!bounty) throw new ApiError(404, "Không tìm thấy tin mất đồ.");
  const role =
    claim.finder_id === userId
      ? "finder"
      : bounty.owner_id === userId
        ? "owner"
        : null;
  if (!role) {
    throw new ApiError(
      403,
      "Chỉ chủ đồ và người gửi bằng chứng được truy cập.",
    );
  }
  return {
    claim: claim as ClaimRow,
    bounty: bounty as BountyRow,
    role,
    userId,
  };
}

async function readWorkflow(
  admin: ReturnType<typeof createAdminClient>,
  context: ParticipantContext,
) {
  const [{ data: messages, error: messageError }, handover] = await Promise.all([
    admin
      .from("claim_messages")
      .select("id,sender_id,sender_role,kind,body,created_at")
      .eq("claim_id", context.claim.id)
      .order("created_at", { ascending: true })
      .limit(200),
    readHandover(admin, context.claim.id),
  ]);
  if (messageError) throw new Error(messageError.message);
  return {
    ok: true,
    workflow: {
      claimId: context.claim.id,
      bountyId: context.bounty.id,
      role: context.role,
      status: context.claim.workflow_status,
      messages: (messages || []).map((message) => ({
        id: String(message.id),
        senderRole: message.sender_role,
        kind: message.kind,
        body: message.body,
        createdAt: message.created_at,
        mine: message.sender_id === context.userId,
      })),
      handover: handover
        ? {
            scheduledAt: handover.scheduled_at,
            meetingLocation: handover.meeting_location,
            note: handover.note,
            status: handover.status,
            proposedByMe: handover.proposed_by === context.userId,
            acceptedAt: handover.accepted_at,
            finderDeliveredAt: handover.finder_delivered_at,
            ownerReceivedAt: handover.owner_received_at,
          }
        : null,
    },
  };
}

async function readHandover(
  admin: ReturnType<typeof createAdminClient>,
  claimId: string,
) {
  const { data, error } = await admin
    .from("claim_handovers")
    .select(
      "proposed_by,scheduled_at,meeting_location,note,status,accepted_at,finder_delivered_at,owner_received_at",
    )
    .eq("claim_id", claimId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
