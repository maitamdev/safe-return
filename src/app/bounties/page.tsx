"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useFindBack } from "@/lib/findback/provider";
import { BountyCard } from "@/components/findback/BountyCard";
import { MagnifyingGlass, Plus } from "@phosphor-icons/react";

export default function BrowseBountiesPage() {
  const { bounties } = useFindBack();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");

  const cats = useMemo(() => {
    const s = new Set(bounties.map((b) => b.category).filter(Boolean));
    return ["all", ...Array.from(s)];
  }, [bounties]);

  const filtered = bounties.filter((b) => {
    if (cat !== "all" && b.category !== cat) return false;
    if (!q.trim()) return true;
    const hay = `${b.title} ${b.description} ${b.location}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9945FF]">
            Browse
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold md:text-4xl">
            Lost-item bounties
          </h1>
          <p className="mt-2 max-w-xl text-sm text-white/55">
            FIND is a test SPL token on Solana Devnet — not real USDC. AI scores
            claims; owners release rewards on-chain.
          </p>
        </div>
        <Link
          href="/bounties/create"
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#9945FF] to-[#14F195] px-5 py-2.5 text-sm font-bold text-black"
        >
          <Plus size={16} weight="bold" /> Create bounty
        </Link>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <MagnifyingGlass
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title, place…"
            className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm outline-none ring-[#9945FF]/40 placeholder:text-white/30 focus:ring-2"
          />
        </label>
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none"
        >
          {cats.map((c) => (
            <option key={c} value={c} className="bg-[#0b1224]">
              {c === "all" ? "All categories" : c}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((b) => (
          <BountyCard
            key={b.id}
            b={b}
            status={
              b.aiReport
                ? "AiReviewed"
                : b.claim
                  ? "ClaimSubmitted"
                  : b.seed
                    ? "Funded"
                    : undefined
            }
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="mt-16 text-center text-sm text-white/40">
          No bounties match. Create one to start the demo.
        </p>
      )}
    </div>
  );
}
