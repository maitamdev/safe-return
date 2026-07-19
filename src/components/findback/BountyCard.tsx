"use client";

import Link from "next/link";
import type { BountyMeta } from "@/lib/findback/store";
import { FIND_SYMBOL } from "@/lib/findback/config";
import { MapPin, Timer, Coins } from "@phosphor-icons/react";

export function statusBadge(status?: string) {
  const s = status || "Draft";
  const map: Record<string, string> = {
    Draft: "bg-white/10 text-white/70",
    Funded: "bg-emerald-500/15 text-emerald-300",
    ClaimSubmitted: "bg-sky-500/15 text-sky-300",
    AiReviewed: "bg-violet-500/15 text-violet-300",
    Released: "bg-[#14F195]/20 text-[#14F195]",
    Refunded: "bg-amber-500/15 text-amber-200",
    Disputed: "bg-rose-500/15 text-rose-300",
    Cancelled: "bg-white/10 text-white/40",
  };
  return map[s] || "bg-white/10 text-white/60";
}

export function BountyCard({
  b,
  status,
}: {
  b: BountyMeta;
  status?: string;
}) {
  const left = Math.max(0, b.deadlineUnix * 1000 - Date.now());
  const days = Math.ceil(left / 86400000);

  return (
    <Link
      href={`/bounties/${b.id}`}
      className="group flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] transition hover:border-[#9945FF]/40 hover:bg-white/[0.05]"
    >
      <div
        className="relative h-36 bg-gradient-to-br from-[#9945FF]/40 via-[#0b1224] to-[#14F195]/25"
        style={
          b.imageDataUrl
            ? {
                backgroundImage: `url(${b.imageDataUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        <span
          className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
            b.seed && !status
              ? "bg-amber-500/20 text-amber-200"
              : statusBadge(status)
          }`}
        >
          {b.seed && (!status || status === "Funded" || status === "Seed")
            ? "Mẫu (chưa on-chain)"
            : status || "Draft"}
        </span>
        {b.aiReport && (
          <span className="absolute right-3 top-3 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-bold text-[#14F195] backdrop-blur">
            AI {b.aiReport.score}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-base font-bold leading-snug group-hover:text-[#14F195]">
          {b.title}
        </h3>
        <p className="mt-1 line-clamp-2 text-xs text-white/50">
          {b.description}
        </p>
        <div className="mt-auto flex flex-wrap gap-3 pt-4 text-[11px] text-white/55">
          <span className="inline-flex items-center gap-1">
            <MapPin size={12} /> {b.location}
          </span>
          <span className="inline-flex items-center gap-1">
            <Coins size={12} /> {b.rewardUi} {FIND_SYMBOL}
          </span>
          <span className="inline-flex items-center gap-1">
            <Timer size={12} /> còn {days} ngày
          </span>
        </div>
      </div>
    </Link>
  );
}
