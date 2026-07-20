"use client";

import { useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import type { AiClaimReport } from "@/lib/ai/types";
import {
  aiModelIdentityPayload,
  aiReportProvenancePayload,
} from "@/lib/ai/provenance";
import { fetchClaimV2 } from "@/lib/findback/program";
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

type ProvenanceVerification = "idle" | "legacy" | "checking" | "verified" | "mismatch" | "unavailable";

type VerificationResult = {
  key: string;
  status: Extract<ProvenanceVerification, "verified" | "mismatch" | "unavailable">;
};

export function AiReviewPanel({ report, provenance, bountyId, finderWallet, onAccept, onReject, onDispute, busy, canDecide, titleId = "review-title" }: { report: AiClaimReport; provenance?: AiProvenance; bountyId?: string; finderWallet?: string; onAccept?: () => void; onReject?: () => void; onDispute?: () => void; busy?: boolean; canDecide?: boolean; titleId?: string }) {
  const Icon = report.decision === "ACCEPT" ? CheckCircle : report.decision === "REJECT" ? XCircle : Warning;
  const tone = report.decision === "ACCEPT" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : report.decision === "REJECT" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-amber-200 bg-amber-50 text-amber-800";
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const inputHash = provenance?.inputHash?.toLowerCase();
  const reportHash = provenance?.reportHash?.toLowerCase();
  const modelHash = provenance?.modelHash?.toLowerCase();
  const promptVersion = provenance?.promptVersion;
  const hasCompleteProvenance = Boolean(
    bountyId &&
    finderWallet &&
    inputHash &&
    reportHash &&
    modelHash &&
    promptVersion,
  );
  const reportPayload = report.generated_at
    ? aiReportProvenancePayload(report)
    : "";
  const modelPayload = promptVersion
    ? aiModelIdentityPayload({
        provider: report.provider,
        model: report.model,
        promptVersion,
      })
    : "";
  const verificationKey = hasCompleteProvenance && report.generated_at
    ? JSON.stringify([
        bountyId,
        finderWallet,
        inputHash,
        reportHash,
        modelHash,
        reportPayload,
        modelPayload,
      ])
    : "";
  const verification: ProvenanceVerification = !hasCompleteProvenance
    ? "idle"
    : !report.generated_at
      ? "legacy"
      : verificationResult?.key === verificationKey
        ? verificationResult.status
        : "checking";

  useEffect(() => {
    if (!verificationKey || !bountyId || !finderWallet || !inputHash || !reportHash || !modelHash) return;

    let cancelled = false;
    void (async () => {
      try {
        const [computedReportHash, computedModelHash, chainClaim] = await Promise.all([
          sha256Hex(reportPayload),
          sha256Hex(modelPayload),
          fetchClaimV2(bountyId, new PublicKey(finderWallet)),
        ]);
        if (cancelled) return;
        if (!chainClaim) {
          setVerificationResult({ key: verificationKey, status: "unavailable" });
          return;
        }
        const verified =
          computedReportHash === reportHash &&
          computedModelHash === modelHash &&
          bytesToHex(chainClaim.aiInputHash) === inputHash &&
          bytesToHex(chainClaim.aiReportHash) === reportHash &&
          bytesToHex(chainClaim.aiModelHash) === modelHash;
        setVerificationResult({
          key: verificationKey,
          status: verified ? "verified" : "mismatch",
        });
      } catch {
        if (!cancelled) {
          setVerificationResult({ key: verificationKey, status: "unavailable" });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bountyId, finderWallet, inputHash, modelHash, modelPayload, reportHash, reportPayload, verificationKey]);

  return (
    <section className="app-card p-5 sm:p-7" aria-labelledby={titleId}>
      <div className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-start">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold text-forest"><Brain size={19} weight="duotone" />Đánh giá bằng chứng</p>
          <h2 id={titleId} className="mt-2 text-2xl font-bold">Kết quả so khớp claim</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">Kết quả này không tự chuyển tiền. Chủ bounty phải tự kiểm tra và ký quyết định on-chain.</p>
          <p className="mt-4 inline-flex rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">
            {report.provider === "groq" ? "Groq Vision" : "AI trực tuyến"}: {report.model || "đã cấu hình"}
          </p>
          {report.generated_at ? (
            <p className="mt-2 text-xs text-ink-muted">
              Tạo lúc {new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(report.generated_at))}
            </p>
          ) : null}
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
            {verification === "verified"
              ? "Provenance AI đã khớp Claim PDA"
              : verification === "mismatch"
                ? "Cảnh báo: provenance không khớp"
                : verification === "legacy"
                  ? "Provenance thuộc định dạng cũ"
                : verification === "checking"
                  ? "Đang đối chiếu provenance với Devnet"
                  : "Provenance AI đã ghi lên Claim PDA"}
          </summary>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-emerald-800">
            Ba hash dưới đây khóa đúng dữ liệu đầu vào, báo cáo đầu ra và model đã dùng. AI không có quyền tự chuyển phần thưởng.
          </p>
          {verification === "mismatch" ? (
            <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-900" role="alert">
              Báo cáo hoặc model hiện tại không khớp commitment trên Claim PDA. Không nên dùng kết quả này để quyết định.
            </p>
          ) : verification === "legacy" ? (
            <p className="mt-3 text-xs text-ink-muted" role="status">
              Báo cáo này được tạo trước định dạng hash canonical mới nên chỉ hiển thị commitment gốc, không gắn nhãn đã xác minh lại.
            </p>
          ) : verification === "unavailable" ? (
            <p className="mt-3 text-xs text-amber-800" role="status">
              Chưa đọc được Claim PDA từ Devnet; hãy thử lại khi RPC ổn định.
            </p>
          ) : null}
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

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return bytesToHex(new Uint8Array(digest));
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
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
