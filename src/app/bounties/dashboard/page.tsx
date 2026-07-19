"use client";

import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useFindBack } from "@/lib/findback/provider";
import { FIND_SYMBOL } from "@/lib/findback/config";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { statusBadge } from "@/components/findback/BountyCard";

export default function DashboardPage() {
  const { publicKey, connected } = useWallet();
  const { bounties, lastTxUrl, lastIx, txState } = useFindBack();
  const mine = publicKey
    ? bounties.filter((b) => b.ownerWallet === publicKey.toBase58())
    : [];
  const claimed = publicKey
    ? bounties.filter((b) => b.claim?.finderWallet === publicKey.toBase58())
    : [];

  const locked = mine.reduce((s, b) => s + (b.claim || b.aiReport ? 0 : b.rewardUi), 0);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9945FF]">
          Owner dashboard
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold">Your bounties</h1>
        <p className="mt-2 text-sm text-white/55">
          AI recommends. You sign. Escrow only releases after your approval.
        </p>
      </div>

      {!connected && (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="mb-3 text-sm text-white/60">Connect Phantom to manage bounties.</p>
          <ConnectWalletButton size="md" />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Owned bounties" value={String(mine.length)} />
        <Stat label={`Listed ${FIND_SYMBOL}`} value={String(locked || "—")} />
        <Stat
          label="Last tx"
          value={
            lastTxUrl ? (
              <a href={lastTxUrl} className="text-[#14F195] hover:underline" target="_blank" rel="noreferrer">
                {txState} · {lastIx}
              </a>
            ) : (
              "—"
            )
          }
        />
      </div>

      <section>
        <h2 className="text-sm font-bold uppercase tracking-wider text-white/45">
          Created by you
        </h2>
        <div className="mt-3 space-y-2">
          {mine.length === 0 && (
            <p className="text-sm text-white/40">
              No on-chain bounties yet.{" "}
              <Link href="/bounties/create" className="text-[#14F195] underline">
                Create one
              </Link>
            </p>
          )}
          {mine.map((b) => (
            <Link
              key={b.id}
              href={`/bounties/${b.id}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition hover:border-[#9945FF]/40"
            >
              <div>
                <p className="font-semibold">{b.title}</p>
                <p className="text-xs text-white/40">
                  {b.rewardUi} {FIND_SYMBOL} · {b.location}
                </p>
                {b.aiReport && (
                  <p className="mt-1 text-xs text-[#9945FF]">
                    AI {b.aiReport.score} · {b.aiReport.decision}
                  </p>
                )}
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${statusBadge(
                  b.aiReport ? "AiReviewed" : b.claim ? "ClaimSubmitted" : "Funded"
                )}`}
              >
                {b.aiReport ? "AI reviewed" : b.claim ? "Claim" : "Open"}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold uppercase tracking-wider text-white/45">
          Claims you submitted
        </h2>
        <div className="mt-3 space-y-2">
          {claimed.length === 0 && (
            <p className="text-sm text-white/40">No claims yet.</p>
          )}
          {claimed.map((b) => (
            <Link
              key={b.id}
              href={`/bounties/${b.id}`}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
            >
              <span className="font-semibold">{b.title}</span>
              <span className="text-xs text-white/45">
                {b.aiReport ? `AI ${b.aiReport.score}` : "pending AI"}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">
        {label}
      </p>
      <div className="mt-2 text-xl font-bold">{value}</div>
    </div>
  );
}
