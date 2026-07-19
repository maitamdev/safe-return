"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MagnifyingGlass, Plus, Tray } from "@phosphor-icons/react";
import { useFindBack } from "@/lib/findback/provider";
import { BountyCard, statusLabel } from "@/components/findback/BountyCard";
import { GetStarted } from "@/components/findback/GetStarted";

export default function BrowseBountiesPage() {
  const { bounties, loadingBounties } = useFindBack();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("newest");

  const categories = useMemo(() => ["all", ...Array.from(new Set(bounties.map((b) => b.category).filter(Boolean)))], [bounties]);
  const statuses = useMemo(
    () => ["all", ...Array.from(new Set(bounties.map((b) => b.status).filter((value): value is string => Boolean(value))))],
    [bounties]
  );
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("vi");
    return bounties
      .filter((bounty) => {
        if (category !== "all" && bounty.category !== category) return false;
        if (status !== "all" && bounty.status !== status) return false;
        if (!normalized) return true;
        return `${bounty.title} ${bounty.description} ${bounty.location}`
          .toLocaleLowerCase("vi")
          .includes(normalized);
      })
      .sort((left, right) => {
        if (sort === "reward") return right.rewardUi - left.rewardUi;
        if (sort === "deadline") return left.deadlineUnix - right.deadlineUnix;
        return right.createdAt - left.createdAt;
      });
  }, [bounties, category, query, sort, status]);

  return (
    <div>
      <GetStarted />
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Tin thất lạc</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">
            Chỉ hiển thị dữ liệu do người dùng tạo. Trạng thái giao dịch được đối chiếu với Solana Devnet khi mở từng tin.
          </p>
        </div>
        <Link href="/bounties/create" className="app-button-primary shrink-0"><Plus size={17} weight="bold" />Tạo tin mất đồ</Link>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_13rem_13rem_13rem]">
        <label>
          <span className="sr-only">Tìm tin thất lạc</span>
          <span className="relative block">
            <MagnifyingGlass size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên đồ, mô tả hoặc địa điểm" className="app-input pl-11" />
          </span>
        </label>
        <label>
          <span className="sr-only">Lọc theo loại đồ</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="app-input">
            {categories.map((item) => <option key={item} value={item}>{item === "all" ? "Tất cả loại đồ" : item}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">Lọc theo trạng thái</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="app-input">
            {statuses.map((item) => <option key={item} value={item}>{item === "all" ? "Tất cả trạng thái" : statusLabel(item)}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">Sắp xếp danh sách</span>
          <select value={sort} onChange={(event) => setSort(event.target.value)} className="app-input">
            <option value="newest">Mới đăng trước</option>
            <option value="reward">Thưởng cao trước</option>
            <option value="deadline">Sắp hết hạn trước</option>
          </select>
        </label>
      </div>

      {!loadingBounties && (
        <p className="mt-4 text-xs font-semibold text-ink-muted" aria-live="polite">
          Hiển thị {filtered.length} trong {bounties.length} tin
        </p>
      )}

      {loadingBounties ? (
        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3" aria-label="Đang tải danh sách">
          {[0, 1, 2].map((item) => <div key={item} className="app-card overflow-hidden"><div className="skeleton aspect-[16/9] rounded-none" /><div className="space-y-3 p-5"><div className="skeleton h-5 w-2/3" /><div className="skeleton h-4 w-full" /><div className="skeleton h-4 w-1/2" /></div></div>)}
        </div>
      ) : filtered.length > 0 ? (
        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((bounty) => <BountyCard key={bounty.id} b={bounty} status={bounty.status || (bounty.aiReport ? "AiReviewed" : bounty.claim ? "ClaimSubmitted" : "Draft")} />)}
        </div>
      ) : (
        <div className="app-card mt-8 flex flex-col items-center px-5 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-bg-deep text-forest"><Tray size={30} /></span>
          <h2 className="mt-4 text-lg font-bold">{bounties.length === 0 ? "Chưa có tin thất lạc" : "Không tìm thấy kết quả"}</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-ink-soft">{bounties.length === 0 ? "Danh sách bắt đầu trống vì hệ thống không chèn dữ liệu mẫu. Hãy tạo tin đầu tiên bằng giao dịch Devnet thật." : "Hãy đổi từ khóa hoặc chọn lại loại đồ."}</p>
          {bounties.length === 0 && <Link href="/bounties/create" className="app-button-primary mt-5"><Plus size={17} />Tạo tin đầu tiên</Link>}
        </div>
      )}
    </div>
  );
}
