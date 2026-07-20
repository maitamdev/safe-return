"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import {
  ArrowSquareOut,
  CheckCircle,
  Gavel,
  Scales,
  ShieldCheck,
  UsersThree,
} from "@phosphor-icons/react";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { MediaIntegrityBadge } from "@/components/findback/MediaIntegrityBadge";
import { FIND_SYMBOL, explorerAddressUrl } from "@/lib/findback/config";
import {
  fetchArbitrationVote,
  type OnChainArbitrationPanel,
  type OnChainArbitrationVote,
  type OnChainDisputeCase,
} from "@/lib/findback/program";
import { useFindBack } from "@/lib/findback/provider";
import type { AiClaimReport } from "@/lib/ai/types";

type ArbitrationCase = {
  bountyId: string;
  title: string;
  bountyLocation: string;
  rewardUi: number;
  ownerWallet: string;
  finderWallet: string;
  claimId: string;
  description: string;
  foundLocation: string;
  foundAt: string;
  aiReport: AiClaimReport | null;
  imageUrl: string | null;
  mode: "single" | "quorum";
  panel: OnChainArbitrationPanel | null;
  disputeCase: OnChainDisputeCase | null;
  messages: Array<{
    id: string;
    senderRole: "owner" | "finder";
    kind: "message" | "system";
    body: string;
    createdAt: string;
  }>;
  handover: {
    scheduledAt: string;
    meetingLocation: string;
    note: string;
    status: "proposed" | "accepted" | "cancelled";
    acceptedAt: string | null;
    finderDeliveredAt: string | null;
    ownerReceivedAt: string | null;
  } | null;
};

export default function ArbitrationPage() {
  const { publicKey } = useWallet();
  const { txState } = useFindBack();
  const [cases, setCases] = useState<ArbitrationCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const address = publicKey?.toBase58();

  const load = useCallback(async () => {
    if (!address) {
      setCases([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/arbitration/cases", { cache: "no-store" });
      const json = (await response.json().catch(() => ({}))) as {
        cases?: ArbitrationCase[];
        error?: string;
      };
      if (!response.ok) throw new Error(json.error || "Không đọc được hàng chờ phân xử.");
      setCases(json.cases || []);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không đọc được hàng chờ phân xử.");
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    const first = window.setTimeout(() => void load(), 0);
    const interval = window.setInterval(() => void load(), 45_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, [load]);

  return (
    <div>
      <section className="overflow-hidden rounded-2xl border border-emerald-800 bg-[#073f2b] text-white shadow-[0_24px_70px_rgba(7,63,43,0.18)]">
        <div className="grid gap-8 p-6 sm:p-9 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <span className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-bold text-emerald-50">
              <UsersThree size={17} weight="duotone" /> Hội đồng độc lập 2/3
            </span>
            <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">Trung tâm phân xử</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/72">
              Mỗi trọng tài ký một phiếu riêng trên Solana. Chỉ khi hai trong ba ví đồng thuận, giao dịch mới có thể trả thưởng hoặc từ chối claim.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center">
            <HeaderMetric label="Vụ được giao" value={loading ? "..." : String(cases.length)} />
            <HeaderMetric label="Ngưỡng quyết định" value="2 / 3" />
          </div>
        </div>
      </section>

      {!address ? (
        <section className="app-card mt-7 p-6">
          <h2 className="font-bold">Kết nối ví trọng tài</h2>
          <p className="mb-4 mt-2 text-sm leading-6 text-ink-soft">Hệ thống chỉ trả về các vụ mà địa chỉ ví hiện tại nằm trong panel on-chain.</p>
          <ConnectWalletButton size="md" />
        </section>
      ) : null}

      {error ? <p className="mt-7 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900" role="alert">{error}</p> : null}

      <section className="mt-8" aria-labelledby="queue-title">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-forest">Hàng chờ riêng của ví</p>
            <h2 id="queue-title" className="mt-2 text-2xl font-bold">Bằng chứng cần xem xét</h2>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading || txState === "pending"} className="text-xs font-bold text-forest hover:underline">{loading ? "Đang tải" : "Làm mới"}</button>
        </div>

        <div className="mt-5 grid gap-5">
          {cases.map((arbitrationCase) => (
            <CaseCard key={`${arbitrationCase.bountyId}-${arbitrationCase.finderWallet}`} arbitrationCase={arbitrationCase} viewer={address || ""} reload={load} />
          ))}
          {!loading && address && cases.length === 0 ? (
            <div className="app-card p-9 text-center">
              <ShieldCheck size={36} className="mx-auto text-forest" weight="duotone" />
              <h3 className="mt-4 font-bold">Không có vụ nào chờ ví này</h3>
              <p className="mt-2 text-sm text-ink-soft">Đây là dữ liệu thật theo panel và trạng thái claim trên Devnet.</p>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function CaseCard({ arbitrationCase, viewer, reload }: { arbitrationCase: ArbitrationCase; viewer: string; reload: () => Promise<void> }) {
  const { voteArbitration, finalizeArbitration, resolveDispute, txState } = useFindBack();
  const [myVote, setMyVote] = useState<OnChainArbitrationVote | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const quorumCase = arbitrationCase.disputeCase;
  const isQuorum = arbitrationCase.mode === "quorum" && Boolean(arbitrationCase.panel && quorumCase);

  useEffect(() => {
    if (!isQuorum || !viewer) return;
    let cancelled = false;
    fetchArbitrationVote(
      arbitrationCase.bountyId,
      new PublicKey(arbitrationCase.finderWallet),
      new PublicKey(viewer)
    ).then((vote) => {
      if (!cancelled) setMyVote(vote);
    }).catch(() => {
      if (!cancelled) setMyVote(null);
    });
    return () => {
      cancelled = true;
    };
  }, [arbitrationCase.bountyId, arbitrationCase.finderWallet, isQuorum, viewer]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Giao dịch phân xử thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const locked = busy || txState === "pending";
  const report = arbitrationCase.aiReport;
  const decision = quorumCase?.decision ?? 0;

  return (
    <article className="app-card overflow-hidden">
      <div className="grid lg:grid-cols-[300px_1fr]">
        <div className="border-b border-line bg-bg-deep lg:border-b-0 lg:border-r">
          {arbitrationCase.imageUrl ? (
            <Image unoptimized src={arbitrationCase.imageUrl} alt="Ảnh bằng chứng riêng tư của claim" width={720} height={720} className="aspect-square h-full min-h-64 w-full object-cover" />
          ) : (
            <div className="grid min-h-64 place-items-center p-6 text-center text-sm text-ink-muted"><div><Scales size={34} className="mx-auto text-forest" /><p className="mt-3">Claim không gửi ảnh. Chỉ đánh giá từ mô tả văn bản.</p></div></div>
          )}
        </div>
        <div className="p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-rose-700">Đang tranh chấp</p>
              <h3 className="mt-2 text-xl font-bold">{arbitrationCase.title}</h3>
              <p className="mt-1 text-sm text-ink-soft">{arbitrationCase.bountyLocation} | {arbitrationCase.rewardUi} {FIND_SYMBOL}</p>
            </div>
            <span className="rounded-lg border border-line bg-bg-deep px-2.5 py-1 text-xs font-bold text-ink-soft">{isQuorum ? "Panel 2/3" : "Trọng tài đơn"}</span>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Evidence label="Mô tả của người tìm thấy" value={arbitrationCase.description} />
            <Evidence label="Nơi và lúc tìm thấy" value={`${arbitrationCase.foundLocation || "Không cung cấp"}${arbitrationCase.foundAt ? ` | ${arbitrationCase.foundAt}` : ""}`} />
          </div>
          <div className="mt-4"><MediaIntegrityBadge purpose="claim" bountyId={arbitrationCase.bountyId} claimId={arbitrationCase.claimId} /></div>

          {report ? (
            <div className="mt-5 rounded-xl border border-line bg-bg-deep p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-muted">AI tham khảo</p><span className="font-mono text-sm font-bold text-forest">{report.score}/100</span></div>
              <p className="mt-2 text-sm font-semibold text-ink">{report.decision}</p>
              <p className="mt-2 text-xs leading-5 text-ink-soft">AI không có phiếu và không thể chuyển tiền.</p>
            </div>
          ) : null}

          {(arbitrationCase.handover || arbitrationCase.messages.length > 0) ? (
            <details className="mt-5 rounded-xl border border-line bg-bg-elevated">
              <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-ink">Xem lịch giao và trao đổi của hai bên</summary>
              <div className="border-t border-line p-4">
                {arbitrationCase.handover ? (
                  <dl className="grid gap-3 text-xs sm:grid-cols-2">
                    <Evidence label="Thời gian hẹn" value={formatCaseDate(arbitrationCase.handover.scheduledAt)} />
                    <Evidence label="Địa điểm hẹn riêng tư" value={arbitrationCase.handover.meetingLocation} />
                    <Evidence label="Trạng thái lịch" value={arbitrationCase.handover.status === "accepted" ? "Hai bên đã xác nhận" : arbitrationCase.handover.status === "cancelled" ? "Đã hủy" : "Chờ xác nhận"} />
                    <Evidence label="Xác nhận giao đồ" value={arbitrationCase.handover.finderDeliveredAt ? `Finder xác nhận lúc ${formatCaseDate(arbitrationCase.handover.finderDeliveredAt)}` : "Chưa có"} />
                  </dl>
                ) : <p className="text-xs text-ink-muted">Hai bên chưa tạo lịch giao đồ.</p>}
                {arbitrationCase.messages.length > 0 ? (
                  <div className="mt-4 space-y-2 border-t border-line pt-4">
                    {arbitrationCase.messages.map((message) => (
                      <div key={message.id} className={`rounded-lg px-3 py-2 text-xs leading-5 ${message.kind === "system" ? "bg-bg-deep text-center text-ink-muted" : "border border-line bg-bg-elevated text-ink"}`}>
                        {message.kind === "message" ? <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-muted">{message.senderRole === "owner" ? "Chủ đồ" : "Người tìm thấy"}</p> : null}
                        <p>{message.body}</p>
                        <time className="mt-1 block text-[10px] text-ink-muted">{formatCaseDate(message.createdAt)}</time>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </details>
          ) : null}

          {isQuorum && arbitrationCase.panel && quorumCase ? (
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
              <div className="flex items-center justify-between gap-3"><p className="text-sm font-bold text-emerald-950">Tiến độ biểu quyết</p><a href={explorerAddressUrl(quorumCase.address)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 hover:underline">Mở case <ArrowSquareOut size={13} /></a></div>
              <div className="mt-4 grid grid-cols-2 gap-3"><VoteMetric label="Trả thưởng" value={quorumCase.releaseVotes} /><VoteMetric label="Từ chối claim" value={quorumCase.rejectVotes} /></div>
              <div className="mt-4 grid grid-cols-3 gap-2">{arbitrationCase.panel.arbiters.map((arbiter, index) => <div key={arbiter} className={`rounded-lg border px-2 py-2 text-center font-mono text-[10px] ${arbiter === viewer ? "border-forest bg-bg-elevated text-forest" : "border-emerald-200 text-emerald-900"}`}>#{index + 1} {arbiter.slice(0, 4)}...{arbiter.slice(-4)}</div>)}</div>
              {myVote ? <p className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-emerald-800"><CheckCircle size={16} weight="fill" /> Bạn đã bỏ phiếu {myVote.releaseToFinder ? "trả thưởng" : "từ chối claim"}</p> : null}
            </div>
          ) : null}

          <div className="mt-6 border-t border-line pt-5">
            {isQuorum && decision === 0 && !myVote ? (
              <div className="grid gap-2 sm:grid-cols-2"><button type="button" disabled={locked} onClick={() => void run(() => voteArbitration(arbitrationCase.bountyId, arbitrationCase.finderWallet, true))} className="app-button-primary"><CheckCircle size={17} /> Phiếu trả FIND</button><button type="button" disabled={locked} onClick={() => void run(() => voteArbitration(arbitrationCase.bountyId, arbitrationCase.finderWallet, false))} className="app-button-secondary">Phiếu từ chối claim</button></div>
            ) : null}
            {isQuorum && decision !== 0 && !quorumCase?.finalized ? (
              <button type="button" disabled={locked} onClick={() => void run(() => finalizeArbitration(arbitrationCase.bountyId, arbitrationCase.finderWallet, decision === 1))} className="app-button-primary w-full"><Gavel size={17} /> Thi hành quyết định {decision === 1 ? "trả thưởng" : "từ chối claim"}</button>
            ) : null}
            {!isQuorum ? (
              <div className="grid gap-2 sm:grid-cols-2"><button type="button" disabled={locked} onClick={() => void run(() => resolveDispute(arbitrationCase.bountyId, true, arbitrationCase.finderWallet))} className="app-button-primary">Trả FIND cho finder</button><button type="button" disabled={locked} onClick={() => void run(() => resolveDispute(arbitrationCase.bountyId, false, arbitrationCase.finderWallet))} className="app-button-secondary">Từ chối claim</button></div>
            ) : null}
            {error ? <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-900" role="alert">{error}</p> : null}
          </div>
          <Link href={`/bounties/${arbitrationCase.bountyId}`} className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-forest hover:underline">Mở hồ sơ bounty <ArrowSquareOut size={13} /></Link>
        </div>
      </div>
    </article>
  );
}

function formatCaseDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date)
    : "Không rõ";
}

function HeaderMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/15 bg-white/8 px-4 py-3"><p className="text-xl font-bold">{value}</p><p className="mt-1 text-[11px] text-white/65">{label}</p></div>;
}

function Evidence({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-line bg-bg-elevated p-4"><p className="text-xs font-semibold text-ink-muted">{label}</p><p className="mt-2 text-sm leading-6 text-ink">{value}</p></div>;
}

function VoteMetric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-emerald-200 bg-bg-elevated p-3 text-center"><p className="text-2xl font-bold text-emerald-900">{value}<span className="text-sm text-emerald-700">/2</span></p><p className="mt-1 text-[11px] font-semibold text-emerald-800">{label}</p></div>;
}
