import {
  ApiError,
  apiErrorResponse,
  enforceRateLimit,
  requireApiUser,
  requireSameOrigin,
} from "@/lib/server/api-security";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  canMutateWorkflow,
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

type BountyRow = {
  id: string;
  owner_id: string;
};

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
    const context = await requireParticipant(admin, cleanWorkflowText(claimId, 80), user.id);
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
    enforceRateLimit(`claim-workflow:${user.id}`, { limit: 40, windowMs: 60_000 });
    const { claimId } = await params;
    const body = (await req.json()) as ClaimWorkflowAction;
    const admin = createAdminClient();
    const context = await requireParticipant(admin, cleanWorkflowText(claimId, 80), user.id);

    if (body.action === "send_message") {
      const message = cleanWorkflowText(body.message, 1200);
      if (message.length < 1) throw new ApiError(400, "Hãy nhập nội dung tin nhắn.");
      await insertMessage(admin, context, message, "message");
    } else {
      if (!canMutateWorkflow(context.claim.workflow_status)) {
        throw new ApiError(409, "Yêu cầu này đã kết thúc hoặc đang được phân xử.");
      }

      if (body.action === "request_info") {
        requireRole(context, "owner");
        await updateClaimStatus(admin, context.claim.id, "more_info_requested");
        await insertMessage(
          admin,
          context,
          "Chủ đồ yêu cầu bổ sung đặc điểm hoặc ảnh trước khi hẹn giao.",
          "system",
        );
      } else if (body.action === "propose_handover") {
        const meetingLocation = cleanWorkflowText(body.meetingLocation, 200);
        const note = cleanWorkflowText(body.note, 500);
        const scheduledAt = new Date(body.scheduledAt);
        const now = Date.now();
        if (meetingLocation.length < 3) {
          throw new ApiError(400, "Hãy nhập địa điểm hẹn cụ thể.");
        }
        if (
          !Number.isFinite(scheduledAt.getTime()) ||
          scheduledAt.getTime() < now - 5 * 60_000 ||
          scheduledAt.getTime() > now + 60 * 24 * 60 * 60_000
        ) {
          throw new ApiError(400, "Thời gian hẹn phải nằm trong 60 ngày tới.");
        }
        const { error } = await admin.from("claim_handovers").upsert(
          {
            claim_id: context.claim.id,
            bounty_id: context.bounty.id,
            proposed_by: context.userId,
            scheduled_at: scheduledAt.toISOString(),
            meeting_location: meetingLocation,
            note,
            status: "proposed",
            accepted_by: null,
            accepted_at: null,
            finder_delivered_at: null,
            owner_received_at: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "claim_id" },
        );
        if (error) throw new Error(error.message);
        await updateClaimStatus(admin, context.claim.id, "handover_proposed");
        await insertMessage(
          admin,
          context,
          `${context.role === "owner" ? "Chủ đồ" : "Người tìm thấy"} đã đề xuất một lịch giao đồ riêng tư.`,
          "system",
        );
      } else if (body.action === "accept_handover") {
        const handover = await readHandover(admin, context.claim.id);
        if (!handover || handover.status !== "proposed") {
          throw new ApiError(409, "Lịch hẹn không còn chờ xác nhận.");
        }
        if (handover.proposed_by === context.userId) {
          throw new ApiError(409, "Cần bên còn lại xác nhận lịch hẹn này.");
        }
        const now = new Date().toISOString();
        const { data, error } = await admin
          .from("claim_handovers")
          .update({ status: "accepted", accepted_by: context.userId, accepted_at: now, updated_at: now })
          .eq("claim_id", context.claim.id)
          .eq("status", "proposed")
          .select("claim_id")
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!data) throw new ApiError(409, "Lịch hẹn vừa được thay đổi. Hãy tải lại.");
        await updateClaimStatus(admin, context.claim.id, "handover_scheduled");
        await insertMessage(admin, context, "Hai bên đã xác nhận lịch giao đồ.", "system");
      } else if (body.action === "cancel_handover") {
        const { data, error } = await admin
          .from("claim_handovers")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("claim_id", context.claim.id)
          .in("status", ["proposed", "accepted"])
          .select("claim_id")
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!data) throw new ApiError(409, "Không có lịch hẹn đang hoạt động.");
        await updateClaimStatus(admin, context.claim.id, "awaiting_review");
        await insertMessage(admin, context, "Lịch giao đồ đã được hủy. Hai bên có thể đề xuất lịch mới.", "system");
      } else if (body.action === "mark_delivered") {
        requireRole(context, "finder");
        const now = new Date().toISOString();
        const { data, error } = await admin
          .from("claim_handovers")
          .update({ finder_delivered_at: now, updated_at: now })
          .eq("claim_id", context.claim.id)
          .eq("status", "accepted")
          .is("finder_delivered_at", null)
          .select("claim_id")
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!data) throw new ApiError(409, "Lịch hẹn chưa được cả hai bên xác nhận hoặc đã ghi nhận giao đồ.");
        await updateClaimStatus(admin, context.claim.id, "finder_delivered");
        await insertMessage(
          admin,
          context,
          "Người tìm thấy xác nhận đã giao đồ. Chủ đồ cần kiểm tra trực tiếp trước khi trả thưởng.",
          "system",
        );
      } else {
        throw new ApiError(400, "Hành động không hợp lệ.");
      }
    }

    const refreshed = await requireParticipant(admin, context.claim.id, user.id);
    return Response.json(await readWorkflow(admin, refreshed), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
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
  const role = claim.finder_id === userId ? "finder" : bounty.owner_id === userId ? "owner" : null;
  if (!role) throw new ApiError(403, "Chỉ chủ đồ và người gửi bằng chứng được truy cập.");
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

async function readHandover(admin: ReturnType<typeof createAdminClient>, claimId: string) {
  const { data, error } = await admin
    .from("claim_handovers")
    .select("proposed_by,scheduled_at,meeting_location,note,status,accepted_at,finder_delivered_at,owner_received_at")
    .eq("claim_id", claimId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function insertMessage(
  admin: ReturnType<typeof createAdminClient>,
  context: ParticipantContext,
  body: string,
  kind: "message" | "system",
) {
  const { error } = await admin.from("claim_messages").insert({
    claim_id: context.claim.id,
    bounty_id: context.bounty.id,
    sender_id: context.userId,
    sender_role: context.role,
    kind,
    body,
  });
  if (error) throw new Error(error.message);
}

async function updateClaimStatus(
  admin: ReturnType<typeof createAdminClient>,
  claimId: string,
  workflowStatus: ClaimWorkflowStatus,
) {
  const { error } = await admin
    .from("claims")
    .update({ workflow_status: workflowStatus, updated_at: new Date().toISOString() })
    .eq("id", claimId);
  if (error) throw new Error(error.message);
}

function requireRole(context: ParticipantContext, role: ClaimParticipantRole) {
  if (context.role !== role) {
    throw new ApiError(403, role === "owner" ? "Chỉ chủ đồ được thực hiện thao tác này." : "Chỉ người tìm thấy được thực hiện thao tác này.");
  }
}
