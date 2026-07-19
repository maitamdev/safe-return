"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useFindBack } from "@/lib/findback/provider";
import { BountyCard } from "@/components/findback/BountyCard";
import { GetStarted } from "@/components/findback/GetStarted";
import { MagnifyingGlass, Plus, FunnelSimple } from "@phosphor-icons/react";

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

  const realCount = bounties.filter((b) => !b.seed).length;
  const seedCount = bounties.filter((b) => b.seed).length;

  return (
    <div>
      <GetStarted />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9945FF]">
            Danh sách
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">
            Tin thất lạc
          </h1>
          <p className="mt-2 max-w-lg text-sm text-white/50">
            {realCount > 0 ? (
              <>
                <strong className="text-white/80">{realCount}</strong> tin on-chain
                {seedCount > 0 && (
                  <>
                    {" "}
                    · {seedCount} mẫu xem UI
                  </>
                )}
              </>
            ) : (
              <>
                Card ghi <strong className="text-white/70">Mẫu</strong> chỉ để
                xem giao diện. Muốn giao dịch thật →{" "}
                <strong className="text-white/70">Tạo tin</strong>.
              </>
            )}
          </p>
        </div>
        <Link
          href="/bounties/create"
          className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-black shadow-[0_0_40px_-10px_rgba(20,241,149,0.5)] transition hover:bg-white/90"
        >
          <Plus size={16} weight="bold" /> Tạo tin mất đồ
        </Link>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <MagnifyingGlass
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo tên đồ, nơi mất…"
            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3.5 pl-11 pr-4 text-sm outline-none ring-[#9945FF]/30 placeholder:text-white/30 focus:ring-2"
          />
        </label>
        <label className="relative sm:w-52">
          <FunnelSimple
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35"
          />
          <select
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            className="w-full appearance-none rounded-2xl border border-white/10 bg-white/[0.04] py-3.5 pl-11 pr-4 text-sm outline-none"
          >
            {cats.map((c) => (
              <option key={c} value={c} className="bg-[#0b1224]">
                {c === "all" ? "Tất cả loại" : c}
              </option>
            ))}
          </select>
        </label>
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
        <div className="mt-16 rounded-3xl border border-dashed border-white/15 px-6 py-16 text-center">
          <p className="text-sm text-white/45">
            Không có tin khớp. Thử xóa bộ lọc hoặc tạo tin mới.
          </p>
          <Link
            href="/bounties/create"
            className="mt-4 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black"
          >
            Tạo tin mất đồ
          </Link>
        </div>
      )}
    </div>
  );
}
