"use client";

import type { AiClaimReport } from "@/lib/ai/types";
import { CheckCircle, Warning, XCircle, Sparkle } from "@phosphor-icons/react";

export function AiScoreRing({ score }: { score: number }) {
  const c = 2 * Math.PI * 42;
  const offset = c - (score / 100) * c;
  const color =
    score >= 80 ? "#14F195" : score >= 50 ? "#FBBF24" : "#F43F5E";
  return (
    <div className="relative h-28 w-28">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="8"
        />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums">{score}</span>
        <span className="text-[10px] uppercase tracking-wider text-white/45">
          / 100
        </span>
      </div>
    </div>
  );
}

export function AiReviewPanel({
  report,
  onAccept,
  onReject,
  onDispute,
  busy,
  canDecide,
}: {
  report: AiClaimReport;
  onAccept?: () => void;
  onReject?: () => void;
  onDispute?: () => void;
  busy?: boolean;
  canDecide?: boolean;
}) {
  const Icon =
    report.decision === "ACCEPT"
      ? CheckCircle
      : report.decision === "REJECT"
        ? XCircle
        : Warning;
  const tone =
    report.decision === "ACCEPT"
      ? "text-[#14F195] bg-[#14F195]/10 border-[#14F195]/30"
      : report.decision === "REJECT"
        ? "text-rose-300 bg-rose-500/10 border-rose-500/30"
        : "text-amber-300 bg-amber-500/10 border-amber-500/30";

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#9945FF]">
            <Sparkle size={12} weight="fill" />
            AI Recommendation
          </p>
          <h3 className="mt-2 font-display text-xl font-bold">Claim review</h3>
          <p className="mt-1 max-w-md text-sm text-white/55">
            AI never moves funds. Human approval required on-chain.
          </p>
          {report.mode === "heuristic" && (
            <p className="mt-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-200 inline-block">
              Demo mode · heuristic (add OPENAI_API_KEY for live vision)
            </p>
          )}
          {report.mode === "live" && (
            <p className="mt-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 inline-block">
              Live AI · {report.model}
            </p>
          )}
        </div>
        <AiScoreRing score={report.score} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${tone}`}
        >
          <Icon size={14} weight="fill" />
          {report.decision}
        </span>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
          Confidence {(report.confidence * 100).toFixed(0)}%
        </span>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-white/75">
        {report.explanation}
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <List
          title="Matching"
          items={report.matching_features}
          empty="—"
          tone="good"
        />
        <List
          title="Contradictions"
          items={report.contradictions}
          empty="None"
          tone="warn"
        />
        <List
          title="Fraud signals"
          items={report.fraud_signals}
          empty="None"
          tone="bad"
        />
      </div>

      {canDecide && (
        <div className="mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-5">
          <button
            type="button"
            disabled={busy}
            onClick={onAccept}
            className="rounded-full bg-[#14F195] px-5 py-2.5 text-sm font-bold text-black transition hover:brightness-110 disabled:opacity-50"
          >
            Owner Approve & Release
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onReject}
            className="rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
          >
            Reject claim
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onDispute}
            className="rounded-full border border-amber-500/30 bg-amber-500/10 px-5 py-2.5 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-50"
          >
            Open dispute
          </button>
        </div>
      )}
    </div>
  );
}

function List({
  title,
  items,
  empty,
  tone,
}: {
  title: string;
  items: string[];
  empty: string;
  tone: "good" | "warn" | "bad";
}) {
  const c =
    tone === "good"
      ? "text-[#14F195]"
      : tone === "warn"
        ? "text-amber-300"
        : "text-rose-300";
  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
      <p className={`text-[10px] font-bold uppercase tracking-wider ${c}`}>
        {title}
      </p>
      <ul className="mt-2 space-y-1.5 text-xs text-white/70">
        {items.length === 0 ? (
          <li className="text-white/35">{empty}</li>
        ) : (
          items.map((it) => (
            <li key={it} className="leading-snug">
              · {it}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
