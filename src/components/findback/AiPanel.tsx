"use client";

import type { AiClaimReport } from "@/lib/ai/types";
import { Brain, CheckCircle, Fingerprint, ShieldCheck, Warning, XCircle } from "@phosphor-icons/react";

const decisionCopy = { ACCEPT: "Có thể chấp nhận", REVIEW: "Cần kiểm tra thêm", REJECT: "Nên từ chối" } as const;
const evidenceQualityCopy = {
  "image-backed": "Đã đối chiếu 2 ảnh",
  "partial-image": "Chỉ có 1 ảnh để kiểm tra",
  "text-only": "Chỉ đánh giá từ văn bản",
} as const;

type AiProvenance = {
  inputHash?: string | null;
  reportHash?: string | null;
  modelHash?: string | null;
  promptVersion?: string | null;
};

export function AiReviewPanel({ report, provenance, onAccept, onReject, onDispute, busy, canDecide }: { report: AiClaimReport; provenance?: AiProvenance; onAccept?: () => void; onReject?: () => void; onDispute?: () => void; busy?: boolean; canDecide?: boolean }) {
  const Icon = report.decision === "ACCEPT" ? CheckCircle : report.decision === "REJECT" ? XCircle : Warning;
  const tone = report.decision === "ACCEPT" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : report.decision === "REJECT" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-amber-200 bg-amber-50 text-amber-800";

  return (
    <section className="app-card p-5 sm:p-7" aria-labelledby="review-title">
      <div className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-start">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold text-forest"><Brain size={19} weight="duotone" />Đánh giá bằng chứng</p>
          <h2 id="review-title" className="mt-2 text-2xl font-bold">Kết quả so khớp claim</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">Kết quả này không tự chuyển tiền. Chủ bounty phải tự kiểm tra và ký quyết định on-chain.</p>
          <p className="mt-4 inline-flex rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">
            {report.provider === "groq" ? "Groq Vision" : "AI trực tuyến"}: {report.model || "đã cấu hình"}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-bg-deep px-6 py-4 text-center">
          <p className="text-4xl font-bold tabular-nums text-ink">{report.score}</p>
          <p className="mt-1 text-xs font-semibold text-ink-muted">trên 100 điểm</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <span className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold ${tone}`}><Icon size={17} weight="fill" />{decisionCopy[report.decision]}</span>
        <span className="rounded-xl border border-line bg-bg-deep px-3 py-2 text-sm text-ink">Độ tin cậy {Math.round(report.confidence * 100)}%</span>
      </div>

      <p className="mt-5 text-sm leading-7 text-ink">{report.explanation}</p>

      {provenance?.inputHash && provenance.reportHash && provenance.modelHash && (
        <details className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-bold text-emerald-900">
            <ShieldCheck size={18} weight="fill" aria-hidden />
            Provenance AI đã ghi lên Claim PDA
          </summary>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-emerald-800">
            Ba hash dưới đây khóa đúng dữ liệu đầu vào, báo cáo đầu ra và model đã dùng. AI không có quyền tự chuyển phần thưởng.
          </p>
          <dl className="mt-4 grid gap-3 md:grid-cols-2">
            <HashRow label="Input" value={provenance.inputHash} />
            <HashRow label="Report" value={provenance.reportHash} />
            <HashRow label="Model" value={provenance.modelHash} />
            <div className="rounded-lg border border-emerald-200 bg-bg-elevated p-3">
              <dt className="text-[11px] font-semibold text-emerald-700">Prompt</dt>
              <dd className="mt-1 break-all font-mono text-[11px] text-emerald-950">{provenance.promptVersion || "Không rõ"}</dd>
            </div>
          </dl>
        </details>
      )}

      {report.evidence_quality && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-bold">Mức bằng chứng: {evidenceQualityCopy[report.evidence_quality]}</p>
          {report.evidence_notes && report.evidence_notes.length > 0 && (
            <ul className="mt-2 space-y-1 leading-6">
              {report.evidence_notes.map((note) => <li key={note}>• {note}</li>)}
            </ul>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <EvidenceList title="Điểm trùng khớp" items={report.matching_features} empty="Chưa có điểm trùng khớp rõ ràng." tone="good" />
        <EvidenceList title="Điểm mâu thuẫn" items={report.contradictions} empty="Không phát hiện mâu thuẫn." tone="warn" />
        <EvidenceList title="Tín hiệu rủi ro" items={report.fraud_signals} empty="Không phát hiện tín hiệu rủi ro." tone="bad" />
      </div>

      {canDecide && (
        <div className="mt-7 border-t border-line pt-5">
          <p className="mb-4 text-sm font-semibold text-ink-soft">Quyết định của chủ bounty</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={busy} onClick={onAccept} className="app-button-primary">Chấp nhận và trả thưởng</button>
            <button type="button" disabled={busy} onClick={onReject} className="app-button-secondary">Từ chối claim</button>
            <button type="button" disabled={busy} onClick={onDispute} className="app-button-secondary border-amber-300 text-amber-900">Mở tranh chấp</button>
          </div>
        </div>
      )}
    </section>
  );
}

function HashRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-emerald-200 bg-bg-elevated p-3">
      <dt className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700"><Fingerprint size={14} aria-hidden />{label}</dt>
      <dd className="mt-1 break-all font-mono text-[10px] leading-5 text-emerald-950">{value}</dd>
    </div>
  );
}

function EvidenceList({ title, items, empty, tone }: { title: string; items: string[]; empty: string; tone: "good" | "warn" | "bad" }) {
  const color = tone === "good" ? "text-emerald-800" : tone === "warn" ? "text-amber-800" : "text-rose-800";
  return <div className="rounded-xl border border-line bg-bg-deep p-4"><h3 className={`text-sm font-bold ${color}`}>{title}</h3>{items.length > 0 ? <ul className="mt-3 space-y-2 text-sm leading-6 text-ink-soft">{items.map((item) => <li key={item} className="flex gap-2"><span aria-hidden className="text-ink-muted">•</span><span>{item}</span></li>)}</ul> : <p className="mt-3 text-sm leading-6 text-ink-muted">{empty}</p>}</div>;
}
