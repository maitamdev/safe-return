"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarBlank,
  CaretDown,
  ChatCircleText,
  CheckCircle,
  Clock,
  Gavel,
  MapPin,
  Package,
  PaperPlaneTilt,
  Robot,
  ShieldWarning,
  XCircle,
} from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import {
  canMutateWorkflow,
  canSendWorkflowMessage,
  workflowStatusLabel,
  type ClaimWorkflow,
  type ClaimWorkflowAction,
} from "@/lib/findback/workflow";
import { isPayableClaimStatus } from "@/lib/findback/status";

type Props = {
  claimId: string;
  rewardUi: number;
  hasAiReport: boolean;
  chainStatus?: string;
  bountyStatus: string;
  busy: boolean;
  onReview: () => void;
  onAccept: () => void;
  onReject: () => void;
  onDispute: () => void;
  disputeDeadline?: number | null;
  resolutionDeadline?: number | null;
  onFinalizeRejection: () => void;
  onTimeoutDispute: () => void;
};

type ConfirmAction = "reward" | "reject" | "dispute" | null;

export function ClaimWorkflowPanel({
  claimId,
  rewardUi,
  hasAiReport,
  chainStatus,
  bountyStatus,
  busy,
  onReview,
  onAccept,
  onReject,
  onDispute,
  disputeDeadline,
  resolutionDeadline,
  onFinalizeRejection,
  onTimeoutDispute,
}: Props) {
  const [workflow, setWorkflow] = useState<ClaimWorkflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [showProposal, setShowProposal] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [meetingLocation, setMeetingLocation] = useState("");
  const [note, setNote] = useState("");
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [acceptRisk, setAcceptRisk] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/claims/${encodeURIComponent(claimId)}/workflow`, {
        cache: "no-store",
      });
      const json = (await response.json().catch(() => ({}))) as {
        workflow?: ClaimWorkflow;
        error?: string;
      };
      if (!response.ok || !json.workflow) throw new Error(json.error || "Không tải được tiến trình giao đồ.");
      setWorkflow(json.workflow);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tải được tiến trình giao đồ.");
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  useEffect(() => {
    const first = window.setTimeout(() => void load(), 0);
    const supabase = createClient();
    if (!supabase) return () => window.clearTimeout(first);
    const channel = supabase
      .channel(`claim-workflow-${claimId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "claim_messages", filter: `claim_id=eq.${claimId}` },
        () => void load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "claim_handovers", filter: `claim_id=eq.${claimId}` },
        () => void load(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "claims", filter: `id=eq.${claimId}` },
        () => void load(),
      )
      .subscribe();
    const fallback = window.setInterval(() => void load(), 30_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(fallback);
      void supabase.removeChannel(channel);
    };
  }, [claimId, load]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const mutate = useCallback(
    async (action: ClaimWorkflowAction) => {
      setActionBusy(true);
      setError(null);
      try {
        const response = await fetch(`/api/claims/${encodeURIComponent(claimId)}/workflow`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action),
        });
        const json = (await response.json().catch(() => ({}))) as {
          workflow?: ClaimWorkflow;
          error?: string;
        };
        if (!response.ok || !json.workflow) throw new Error(json.error || "Chưa cập nhật được tiến trình.");
        setWorkflow(json.workflow);
        return true;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Chưa cập nhật được tiến trình.");
        return false;
      } finally {
        setActionBusy(false);
      }
    },
    [claimId],
  );

  const sendMessage = async () => {
    const text = message.trim();
    if (!text) return;
    if (await mutate({ action: "send_message", message: text })) setMessage("");
  };

  const propose = async () => {
    if (!scheduledAt || !meetingLocation.trim()) {
      setError("Hãy chọn thời gian và nhập địa điểm hẹn.");
      return;
    }
    const parsedSchedule = new Date(scheduledAt);
    if (!Number.isFinite(parsedSchedule.getTime())) {
      setError("Thời gian hẹn không hợp lệ.");
      return;
    }
    if (
      await mutate({
        action: "propose_handover",
        scheduledAt: parsedSchedule.toISOString(),
        meetingLocation: meetingLocation.trim(),
        note: note.trim(),
      })
    ) {
      setShowProposal(false);
      setScheduledAt("");
      setMeetingLocation("");
      setNote("");
    }
  };

  const handover = workflow?.handover;
  const canAcceptProposal = Boolean(handover?.status === "proposed" && !handover.proposedByMe);
  const canMarkDelivered = Boolean(
    workflow?.role === "finder" &&
      handover?.status === "accepted" &&
      !handover.finderDeliveredAt,
  );
  const chainActive = chainActiveStatus(bountyStatus);
  const claimPayable = isPayableClaimStatus(chainStatus, workflow?.status);
  const itemReceived = Boolean(handover?.finderDeliveredAt);
  // Preferred: pay after finder marked delivery. Early pay needs explicit risk accept.
  const canRewardBase = Boolean(
    workflow?.role === "owner" &&
      chainActive &&
      claimPayable &&
      workflow &&
      canMutateWorkflow(workflow.status) &&
      !handover?.ownerReceivedAt,
  );
  const canRewardSafe = canRewardBase && itemReceived;
  const canRewardEarly = canRewardBase && !itemReceived;
  const canReward = canRewardSafe || (canRewardEarly && acceptRisk);
  const active = Boolean(workflow && canMutateWorkflow(workflow.status) && chainActive);
  const canChat = Boolean(
    workflow && canSendWorkflowMessage(workflow.status) && chainActive,
  );
  const locked = busy || actionBusy;
  const rejectionExpired = Boolean(disputeDeadline && now > disputeDeadline);
  const resolutionExpired = Boolean(
    resolutionDeadline && now > resolutionDeadline,
  );

  const statusTone = useMemo(() => {
    if (!workflow) return "border-line bg-bg-deep text-ink-soft";
    if (workflow.status === "settled") return "status-pill-ok";
    if (workflow.status === "disputed" || workflow.status === "rejected") return "status-pill-danger";
    if (["handover_scheduled", "finder_delivered"].includes(workflow.status)) return "status-pill-ok";
    return "status-pill-warn";
  }, [workflow]);

  if (loading) {
    return <div className="mt-5 grid gap-3" aria-label="Đang tải tiến trình"><div className="skeleton h-12 rounded-xl" /><div className="skeleton h-24 rounded-xl" /></div>;
  }

  return (
    <div className="mt-5 border-t border-line pt-5">
      {workflow ? (
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${statusTone}`}>
          <CheckCircle size={20} weight="fill" className="mt-0.5 shrink-0" aria-hidden />
          <div>
            <p className="text-sm font-bold">{workflowStatusLabel(workflow.status)}</p>
            <p className="mt-1 text-xs leading-5 opacity-80">
              {nextStepCopy(workflow)}
            </p>
          </div>
        </div>
      ) : null}

      {error ? <p className="alert-box-danger mt-3 rounded-xl p-3 text-xs leading-5" role="alert">{error}</p> : null}

      {workflow ? (
        <>
          <section className="mt-5" aria-labelledby={`handover-${claimId}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 id={`handover-${claimId}`} className="text-sm font-bold">Hẹn gặp giao đồ</h3>
                <p className="mt-1 text-xs leading-5 text-ink-muted">Chỉ bạn và chủ đồ / người tìm thấy nhìn thấy lịch này. Nên gặp nơi công cộng có camera.</p>
              </div>
              {active && (!handover || handover.status === "cancelled") && !showProposal ? (
                <button type="button" disabled={locked} onClick={() => setShowProposal(true)} className="app-button-secondary min-h-10 py-2 text-xs">
                  <CalendarBlank size={16} aria-hidden /> Đề xuất lịch hẹn
                </button>
              ) : null}
            </div>

            {showProposal ? (
              <div className="mt-4 grid gap-3 rounded-xl border border-line bg-bg-deep p-4">
                <label className="block"><span className="text-xs font-bold">Thời gian gặp</span><input type="datetime-local" className="app-input mt-2" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /></label>
                <label className="block"><span className="text-xs font-bold">Địa điểm công cộng</span><span className="mt-1 block text-[11px] leading-5 text-ink-muted">Chọn nơi có bảo vệ hoặc camera. Không dùng địa chỉ nhà riêng.</span><input className="app-input mt-2" value={meetingLocation} onChange={(event) => setMeetingLocation(event.target.value)} maxLength={200} placeholder="Ví dụ: Sảnh thư viện, cạnh quầy bảo vệ" /></label>
                <label className="block"><span className="text-xs font-bold">Ghi chú <span className="font-normal text-ink-muted">(không bắt buộc)</span></span><textarea className="app-input mt-2 min-h-20 resize-y" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} placeholder="Cách nhận biết nhau hoặc khung giờ có thể chờ" /></label>
                <div className="flex flex-wrap gap-2"><button type="button" disabled={locked} onClick={() => void propose()} className="app-button-primary min-h-10 py-2 text-xs">Gửi đề xuất</button><button type="button" disabled={locked} onClick={() => setShowProposal(false)} className="app-button-secondary min-h-10 py-2 text-xs">Đóng</button></div>
              </div>
            ) : null}

            {handover && handover.status !== "cancelled" ? (
              <div className="mt-4 rounded-xl border border-line bg-bg-deep p-4">
                <dl className="grid gap-3 text-xs sm:grid-cols-2">
                  <div><dt className="inline-flex items-center gap-1.5 text-ink-muted"><Clock size={15} aria-hidden />Thời gian</dt><dd className="mt-1 font-bold text-ink">{formatDate(handover.scheduledAt)}</dd></div>
                  <div><dt className="inline-flex items-center gap-1.5 text-ink-muted"><MapPin size={15} aria-hidden />Địa điểm riêng tư</dt><dd className="mt-1 font-bold text-ink">{handover.meetingLocation}</dd></div>
                </dl>
                {handover.note ? <p className="mt-3 text-xs leading-5 text-ink-soft">{handover.note}</p> : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  {active && canAcceptProposal ? <button type="button" disabled={locked} onClick={() => void mutate({ action: "accept_handover" })} className="app-button-primary min-h-10 py-2 text-xs"><CheckCircle size={16} aria-hidden /> Xác nhận lịch này</button> : null}
                  {handover.status === "proposed" && handover.proposedByMe ? <span className="inline-flex min-h-10 items-center text-xs font-semibold text-amber-800">Đang chờ bên còn lại xác nhận</span> : null}
                  {active && canMarkDelivered ? <button type="button" disabled={locked} onClick={() => void mutate({ action: "mark_delivered" })} className="app-button-primary min-h-10 py-2 text-xs"><Package size={16} aria-hidden /> Tôi đã giao đồ</button> : null}
                  {handover.status === "accepted" && !handover.finderDeliveredAt && workflow.role === "owner" ? <span className="inline-flex min-h-10 items-center text-xs font-semibold text-ink-soft">Chờ người tìm thấy xác nhận giao đồ</span> : null}
                  {active && !handover.finderDeliveredAt ? <button type="button" disabled={locked} onClick={() => void mutate({ action: "cancel_handover" })} className="app-button-secondary min-h-10 py-2 text-xs">Hủy lịch</button> : null}
                </div>
              </div>
            ) : null}
          </section>

          <details className="mt-5 rounded-xl border border-line bg-bg-elevated" open={workflow.messages.length === 0}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-ink">
              <span className="inline-flex items-center gap-2"><ChatCircleText size={18} className="text-forest" aria-hidden />Trao đổi riêng ({workflow.messages.length})</span><CaretDown size={16} aria-hidden />
            </summary>
            <div className="border-t border-line p-4">
              <p className="text-[11px] leading-5 text-ink-muted">Không gửi mật khẩu, mã OTP hoặc khóa ví. Nội dung chỉ dành cho chủ đồ và người tìm thấy.</p>
              <div className="mt-3 max-h-72 space-y-2 overflow-y-auto" aria-live="polite">
                {workflow.messages.length ? workflow.messages.map((item) => item.kind === "system" ? (
                  <p key={item.id} className="mx-auto max-w-[90%] rounded-lg bg-bg-deep px-3 py-2 text-center text-[11px] leading-5 text-ink-muted">{item.body}</p>
                ) : (
                  <div key={item.id} className={`flex ${item.mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-5 ${item.mine ? "bg-forest text-white" : "border border-line bg-bg-deep text-ink"}`}><p>{item.body}</p><time className={`mt-1 block text-[10px] ${item.mine ? "text-white/70" : "text-ink-muted"}`}>{formatTime(item.createdAt)}</time></div></div>
                )) : <p className="py-5 text-center text-xs text-ink-muted">Chưa có tin nhắn. Hãy trao đổi trước khi hẹn giao đồ.</p>}
              </div>
              {canChat ? (
                <div className="mt-3 flex gap-2"><label className="sr-only" htmlFor={`message-${claimId}`}>Tin nhắn riêng</label><textarea id={`message-${claimId}`} className="app-input min-h-11 flex-1 resize-none py-2.5 text-sm" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={1200} placeholder="Nhập tin nhắn riêng" /><button type="button" disabled={locked || !message.trim()} onClick={() => void sendMessage()} className="app-button-primary min-h-11 shrink-0 px-4" aria-label="Gửi tin nhắn"><PaperPlaneTilt size={18} aria-hidden /></button></div>
              ) : (
                <p className="mt-3 text-xs leading-5 text-ink-muted">Cuộc trao đổi đã đóng. Lịch sử vẫn được giữ để hai bên đối chiếu.</p>
              )}
            </div>
          </details>

          {workflow.role === "owner" && chainActive && claimPayable ? (
            <section className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4" aria-label="Việc cần làm của chủ đồ">
              <p className="text-sm font-bold text-emerald-950">Việc cần làm (chủ đồ)</p>
              <ol className="mt-3 space-y-2 text-xs leading-5 text-emerald-950/90">
                <li className="flex gap-2"><span className="font-bold">1.</span><span>Đối chiếu bằng chứng (ảnh, mô tả, đặc điểm chỉ bạn biết).</span></li>
                <li className="flex gap-2"><span className="font-bold">2.</span><span>Nhắn tin / hẹn gặp nơi công cộng để nhận đồ (khuyến nghị).</span></li>
                <li className="flex gap-2"><span className="font-bold">3.</span><span>Khi đã nhận đúng đồ → trả {rewardUi} FIND. Tiền chỉ chuyển sau khi bạn ký.</span></li>
              </ol>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {!hasAiReport ? (
                  <button type="button" disabled={locked} onClick={onReview} className="app-button-secondary w-full">
                    <Robot size={17} aria-hidden /> Hỗ trợ đối chiếu AI
                  </button>
                ) : null}
                {["awaiting_review", "more_info_requested"].includes(workflow.status) ? (
                  <button type="button" disabled={locked} onClick={() => void mutate({ action: "request_info" })} className="app-button-secondary w-full">
                    <ChatCircleText size={17} aria-hidden /> Yêu cầu thêm thông tin
                  </button>
                ) : null}
                {canRewardSafe ? (
                  <button type="button" disabled={locked} onClick={() => { setAcceptRisk(false); setConfirmAction("reward"); }} className="app-button-primary w-full sm:col-span-2">
                    <CheckCircle size={18} weight="fill" aria-hidden /> Đã nhận đúng đồ — trả {rewardUi} FIND
                  </button>
                ) : null}
                {canRewardEarly ? (
                  <div className="sm:col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-bold text-amber-950">Chưa xác nhận giao đồ</p>
                    <p className="mt-1 text-[11px] leading-5 text-amber-900/90">
                      Nên hẹn gặp và nhận đồ trước khi trả thưởng. Nếu bạn tin bằng chứng và muốn trả sớm, hãy xác nhận rủi ro bên dưới.
                    </p>
                    <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs leading-5 text-amber-950">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={acceptRisk}
                        onChange={(e) => setAcceptRisk(e.target.checked)}
                      />
                      <span>
                        Tôi hiểu rủi ro: trả thưởng trước khi nhận đồ, không hoàn lại được sau khi ký.
                      </span>
                    </label>
                    <button
                      type="button"
                      disabled={locked || !acceptRisk}
                      onClick={() => setConfirmAction("reward")}
                      className="app-button-primary mt-3 w-full disabled:opacity-50"
                    >
                      <CheckCircle size={18} weight="fill" aria-hidden /> Trả sớm {rewardUi} FIND
                    </button>
                  </div>
                ) : null}
                <button type="button" disabled={locked} onClick={() => setConfirmAction("reject")} className="app-button-secondary w-full text-rose-800 sm:col-span-2">
                  <XCircle size={17} aria-hidden /> Không đúng đồ — từ chối
                </button>
              </div>
            </section>
          ) : null}
          {workflow.role === "finder" && active ? (
            <section className="mt-5 rounded-2xl border border-line bg-bg-deep p-4" aria-label="Việc cần làm của người tìm thấy">
              <p className="text-sm font-bold text-ink">Việc cần làm (người tìm thấy)</p>
              <ol className="mt-3 space-y-2 text-xs leading-5 text-ink-soft">
                <li className="flex gap-2"><span className="font-bold text-ink">1.</span><span>Chờ chủ đồ xem bằng chứng — có thể được hỏi thêm.</span></li>
                <li className="flex gap-2"><span className="font-bold text-ink">2.</span><span>Nhắn tin / đồng ý lịch hẹn nơi công cộng.</span></li>
                <li className="flex gap-2"><span className="font-bold text-ink">3.</span><span>Sau khi giao đồ, bấm &quot;Tôi đã giao đồ&quot;. Chủ đồ sẽ trả thưởng.</span></li>
              </ol>
              <p className="mt-3 text-[11px] leading-5 text-ink-muted">Bạn không thể tự chuyển tiền. Chỉ chủ đồ ký trả thưởng.</p>
            </section>
          ) : null}

          {active && ["handover_scheduled", "finder_delivered", "handover_proposed"].includes(workflow.status) ? <details className="alert-box-warn mt-3 rounded-xl">
            <summary className="cursor-pointer list-none px-4 py-3 text-xs font-bold"><span className="inline-flex items-center gap-2"><ShieldWarning size={17} aria-hidden />Không thể thống nhất? (phương án cuối)</span></summary>
            <div className="border-t border-current/15 p-4"><p className="text-xs leading-5">Chỉ mở tranh chấp khi hai bên bất đồng về giao đồ hoặc trả thưởng. Phần thưởng sẽ tiếp tục bị khóa để trọng tài xem xét.</p><button type="button" disabled={locked || !chainActive} onClick={() => setConfirmAction("dispute")} className="app-button-secondary mt-3 min-h-10 py-2 text-xs"><Gavel size={16} aria-hidden /> Mở tranh chấp</button></div>
          </details> : null}

          {workflow.status === "rejection_pending" ? (
            <div className="alert-box-warn mt-4 rounded-xl p-4">
              <p className="text-sm font-bold">Chủ đồ đã yêu cầu từ chối bằng chứng</p>
              <p className="mt-1 text-xs leading-5">
                Người tìm thấy có thể mở tranh chấp trước {formatDeadline(disputeDeadline)}.
                Sau thời điểm đó, bất kỳ bên nào cũng có thể hoàn tất việc từ chối trên mạng thử nghiệm.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {workflow.role === "finder" && !rejectionExpired ? (
                  <button type="button" disabled={locked} onClick={onDispute} className="app-button-secondary min-h-10 py-2 text-xs"><Gavel size={16} aria-hidden /> Mở tranh chấp</button>
                ) : null}
                {rejectionExpired ? (
                  <button type="button" disabled={locked} onClick={onFinalizeRejection} className="app-button-primary min-h-10 py-2 text-xs"><CheckCircle size={16} aria-hidden /> Hoàn tất từ chối</button>
                ) : null}
              </div>
            </div>
          ) : null}

          {workflow.status === "disputed" ? (
            <div className="alert-box-danger mt-4 rounded-xl p-4">
              <p className="text-sm font-bold">Phần thưởng đang được khóa để phân xử</p>
              <p className="mt-1 text-xs leading-5">
                Hạn xử lý: {formatDeadline(resolutionDeadline)}. Nếu hội đồng không đưa ra quyết định đúng hạn, hồ sơ bị từ chối và tin tiếp tục nhận hồ sơ khác.
              </p>
              {resolutionExpired ? (
                <button type="button" disabled={locked} onClick={onTimeoutDispute} className="app-button-secondary mt-3 min-h-10 py-2 text-xs"><Clock size={16} aria-hidden /> Kết thúc tranh chấp quá hạn</button>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      {confirmAction ? (
        <div className="mt-4 rounded-xl border border-line-strong bg-bg-deep p-4" role="alertdialog" aria-labelledby={`confirm-${claimId}`}>
          <p id={`confirm-${claimId}`} className="text-sm font-bold">{confirmTitle(confirmAction, rewardUi)}</p>
          <p className="mt-1 text-xs leading-5 text-ink-soft">{confirmCopy(confirmAction)}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={locked}
              onClick={() => {
                const action = confirmAction;
                setConfirmAction(null);
                setAcceptRisk(false);
                if (action === "reward") onAccept();
                else if (action === "reject") onReject();
                else onDispute();
              }}
              className={confirmAction === "reward" ? "app-button-primary min-h-10 py-2 text-xs" : "app-button-secondary min-h-10 py-2 text-xs"}
            >
              Xác nhận
            </button>
            <button
              type="button"
              disabled={locked}
              onClick={() => {
                setConfirmAction(null);
                setAcceptRisk(false);
              }}
              className="app-button-secondary min-h-10 py-2 text-xs"
            >
              Quay lại
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function nextStepCopy(workflow: ClaimWorkflow) {
  if (workflow.status === "settled") return "Đã trả thưởng. Giao dịch đã ghi trên mạng thử nghiệm Solana.";
  if (workflow.status === "rejected") return "Bằng chứng này không được chấp nhận. Tin vẫn nhận bằng chứng khác đến hết hạn.";
  if (workflow.status === "rejection_pending") return "Chủ đồ muốn từ chối. Bạn còn thời gian nhắn tin hoặc mở tranh chấp nếu không đồng ý.";
  if (workflow.status === "disputed") return "Đang chờ người phân xử xem xét. Phần thưởng vẫn bị khóa.";
  if (workflow.status === "finder_delivered") return workflow.role === "owner" ? "Người tìm thấy đã xác nhận giao đồ. Kiểm tra món đồ rồi trả thưởng." : "Đã báo giao đồ. Chờ chủ đồ kiểm tra và trả thưởng.";
  if (workflow.status === "handover_scheduled") return "Hẹn gặp nơi công cộng. Chỉ xác nhận giao/nhận sau khi đã trao đồ thật.";
  if (workflow.status === "handover_proposed") return workflow.handover?.proposedByMe ? "Đang chờ bên kia xác nhận lịch hẹn." : "Xem lịch hẹn rồi xác nhận hoặc đề xuất lại.";
  if (workflow.status === "awaiting_review") return workflow.role === "owner" ? "Đối chiếu bằng chứng → nhắn tin/hẹn gặp → nhận đồ rồi trả thưởng." : "Chờ chủ đồ xem bằng chứng. Hãy trả lời nếu được hỏi thêm.";
  if (workflow.status === "more_info_requested") return workflow.role === "finder" ? "Chủ đồ cần thêm thông tin — trả lời trong tin nhắn riêng." : "Đang chờ người tìm thấy bổ sung thông tin.";
  return workflow.role === "owner" ? "Đối chiếu → hẹn giao → nhận đồ → trả thưởng." : "Chờ chủ đồ phản hồi và hẹn giao đồ.";
}

function formatDeadline(value?: number | null) {
  if (!value || !Number.isFinite(value)) return "chưa xác định";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}


function chainActiveStatus(bountyStatus: string) {
  const raw = (bountyStatus || "").trim();
  // Unknown/empty status: treat as inactive to avoid pay/chat after settle desync.
  if (!raw) return false;
  const lower = raw.toLowerCase().replace(/[\s-]+/g, "_");
  return !["released", "refunded", "cancelled", "canceled", "draft"].includes(lower);
}

function confirmTitle(action: Exclude<ConfirmAction, null>, rewardUi: number) {
  if (action === "reward") return `Trả ${rewardUi} FIND cho người tìm thấy?`;
  if (action === "reject") return "Từ chối bằng chứng này?";
  return "Mở tranh chấp?";
}

function confirmCopy(action: Exclude<ConfirmAction, null>) {
  if (action === "reward") return "Ví Phantom sẽ hỏi chữ ký để chuyển phần thưởng đang tạm giữ sang ví người tìm thấy. Sau khi ký không hoàn lại được. Chỉ làm khi bạn đã tin đúng đồ (tốt nhất là đã nhận tay).";
  if (action === "reject") return "Bằng chứng này sẽ đóng. Tin của bạn vẫn nhận bằng chứng từ người khác.";
  return "Chỉ dùng khi hai bên không thể tự thống nhất. Trọng tài sẽ được quyền xem bằng chứng riêng tư.";
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(date)
    : "Thời gian chưa hợp lệ";
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date)
    : "";
}
