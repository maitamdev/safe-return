"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useFindBack } from "@/lib/findback/provider";
import { getBountyMeta } from "@/lib/findback/store";
import { AiReviewPanel } from "@/components/findback/AiPanel";
import { statusBadge } from "@/components/findback/BountyCard";
import {
  FIND_SYMBOL,
  explorerAddressUrl,
  explorerTxUrl,
  fromAtomic,
} from "@/lib/findback/config";
import type { OnChainBounty } from "@/lib/findback/program";
import {
  MapPin,
  Coins,
  Timer,
  Link as LinkIcon,
  ArrowRight,
} from "@phosphor-icons/react";

export default function BountyDetailPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const { publicKey } = useWallet();
  const {
    bounties,
    fetchOnChain,
    accept,
    reject,
    dispute,
    refund,
    txState,
    lastTxUrl,
    programId,
  } = useFindBack();

  const meta = bounties.find((b) => b.id === id) || getBountyMeta(id);
  const [onchain, setOnchain] = useState<OnChainBounty | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reload = async () => {
    try {
      const b = await fetchOnChain(id);
      setOnchain(b);
    } catch {
      setOnchain(null);
    }
  };

  useEffect(() => {
    void reload();
    const t = setInterval(() => void reload(), 12_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!meta) {
    return (
      <p className="text-white/50">
        Bounty not found.{" "}
        <Link href="/bounties" className="text-[#14F195] underline">
          Browse
        </Link>
      </p>
    );
  }

  const isOwner =
    publicKey &&
    (meta.ownerWallet === publicKey.toBase58() ||
      onchain?.owner === publicKey.toBase58());
  const leftMs = meta.deadlineUnix * 1000 - Date.now();
  const expired = leftMs < 0;
  const status = onchain?.status || (meta.aiReport ? "AiReviewed" : meta.claim ? "ClaimSubmitted" : meta.seed ? "Funded" : "Draft");
  const canDecide =
    Boolean(isOwner) &&
    (status === "AiReviewed" ||
      status === "ClaimSubmitted" ||
      status === "Disputed");

  const run = async (fn: () => Promise<void>) => {
    setErr(null);
    setBusy(true);
    try {
      await fn();
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div
            className="h-52 rounded-3xl border border-white/10 bg-gradient-to-br from-[#9945FF]/35 to-[#14F195]/20 md:h-64"
            style={
              meta.imageDataUrl
                ? {
                    backgroundImage: `url(${meta.imageDataUrl})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : undefined
            }
          />
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase ${statusBadge(status)}`}
            >
              {status}
            </span>
            <span className="text-xs text-white/40">{meta.category}</span>
          </div>
          <h1 className="mt-3 font-display text-3xl font-bold md:text-4xl">
            {meta.title}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-white/65">
            {meta.description}
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-white/50">
            <span className="inline-flex items-center gap-1">
              <MapPin size={14} /> {meta.location}
            </span>
            <span className="inline-flex items-center gap-1">
              <Coins size={14} /> {meta.rewardUi} {FIND_SYMBOL}
            </span>
            <span className="inline-flex items-center gap-1">
              <Timer size={14} />{" "}
              {expired
                ? "Expired"
                : `${Math.ceil(leftMs / 86400000)}d ${Math.floor((leftMs % 86400000) / 3600000)}h left`}
            </span>
          </div>
        </div>

        <div className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white/45">
            On-chain
          </h2>
          <Row
            k="Escrow"
            v={
              onchain
                ? `${fromAtomic(onchain.amountFunded)} / ${fromAtomic(onchain.rewardAmount)} ${FIND_SYMBOL}`
                : meta.seed
                  ? `${meta.rewardUi} ${FIND_SYMBOL} (seed — fund on-chain to go live)`
                  : "Not created yet"
            }
          />
          <Row
            k="Program"
            v={
              <a
                className="text-[#14F195] hover:underline"
                href={explorerAddressUrl(programId)}
                target="_blank"
                rel="noreferrer"
              >
                {programId.slice(0, 8)}…↗
              </a>
            }
          />
          {onchain && (
            <Row
              k="PDA"
              v={
                <a
                  className="text-[#14F195] hover:underline"
                  href={explorerAddressUrl(onchain.address)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {onchain.address.slice(0, 8)}…↗
                </a>
              }
            />
          )}
          {(meta.lastTxUrl || lastTxUrl) && (
            <Row
              k="Last tx"
              v={
                <a
                  className="inline-flex items-center gap-1 text-[#14F195] hover:underline"
                  href={meta.lastTxUrl || lastTxUrl || "#"}
                  target="_blank"
                  rel="noreferrer"
                >
                  Explorer <LinkIcon size={12} />
                </a>
              }
            />
          )}
          {onchain && onchain.aiScore > 0 && (
            <Row k="AI score (chain)" v={`${onchain.aiScore}/100`} />
          )}

          <div className="flex flex-col gap-2 pt-2">
            {meta.seed && !onchain ? (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-100">
                <strong>Đây là bounty mẫu (Seed)</strong> — chỉ để xem giao diện,
                chưa khóa tiền on-chain. Muốn demo tx thật:{" "}
                <Link href="/bounties/create" className="underline">
                  Tạo bounty mới
                </Link>{" "}
                sau khi Kết nối ví + Nhận FIND.
              </div>
            ) : null}
            {!meta.seed &&
            (status === "Funded" ||
              status === "Draft" ||
              (!onchain && !meta.seed)) ? (
              <Link
                href={`/bounties/${id}/claim`}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#9945FF] to-[#14F195] px-4 py-3 text-sm font-bold text-black"
              >
                Gửi claim tìm thấy <ArrowRight size={16} />
              </Link>
            ) : null}
            {onchain && status === "Funded" ? (
              <Link
                href={`/bounties/${id}/claim`}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#9945FF] to-[#14F195] px-4 py-3 text-sm font-bold text-black"
              >
                Gửi claim tìm thấy <ArrowRight size={16} />
              </Link>
            ) : null}
            {isOwner && expired && status !== "Released" && status !== "Refunded" && (
              <button
                type="button"
                disabled={busy || txState === "pending"}
                onClick={() => void run(() => refund(id))}
                className="rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-100 disabled:opacity-50"
              >
                Refund after expiry
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-white/45">
          Timeline
        </h2>
        <ol className="mt-4 grid gap-2 sm:grid-cols-5">
          {[
            "Draft",
            "Funded",
            "ClaimSubmitted",
            "AiReviewed",
            "Released",
          ].map((s) => {
            const order = [
              "Draft",
              "Funded",
              "ClaimSubmitted",
              "AiReviewed",
              "Accepted",
              "Released",
            ];
            const statusRank = order.indexOf(status);
            const stepRank = order.indexOf(s);
            const done =
              statusRank >= 0 && stepRank >= 0 && statusRank >= stepRank;
            return (
              <li
                key={s}
                className={`rounded-2xl border px-3 py-2 text-center text-[11px] font-semibold ${
                  done
                    ? "border-[#14F195]/40 bg-[#14F195]/10 text-[#14F195]"
                    : "border-white/10 text-white/35"
                }`}
              >
                {s}
              </li>
            );
          })}
        </ol>
      </div>

      {meta.claim && (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white/45">
            Latest claim
          </h2>
          <p className="mt-2 text-sm text-white/75">{meta.claim.description}</p>
          <p className="mt-2 text-xs text-white/40">
            {meta.claim.location} · {meta.claim.foundAt}
            {meta.claim.finderWallet &&
              ` · ${meta.claim.finderWallet.slice(0, 4)}…${meta.claim.finderWallet.slice(-4)}`}
          </p>
          {meta.claim.evidenceHashHex && (
            <p className="mt-2 font-mono text-[10px] text-white/35 break-all">
              evidence_hash {meta.claim.evidenceHashHex.slice(0, 24)}…
            </p>
          )}
        </div>
      )}

      {meta.aiReport && (
        <AiReviewPanel
          report={meta.aiReport}
          canDecide={canDecide}
          busy={busy || txState === "pending"}
          onAccept={() => void run(() => accept(id))}
          onReject={() => void run(() => reject(id))}
          onDispute={() => void run(() => dispute(id))}
        />
      )}

      {err && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
          {err}
        </p>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/5 py-2 text-sm">
      <span className="text-white/40">{k}</span>
      <span className="text-right text-white/90">{v}</span>
    </div>
  );
}
