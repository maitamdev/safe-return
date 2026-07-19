"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle, EnvelopeSimple, MapPin, Plus, ShieldCheck, Tag } from "@phosphor-icons/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { SafeTagQr } from "@/components/findback/SafeTagQr";
import type { SafeTag, SafeTagReportStatus, SafeTagStatus } from "@/lib/tags/types";

export default function SafeTagsPage() {
  const { connected } = useWallet();
  const [tags, setTags] = useState<SafeTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [publicNote, setPublicNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/tags", { cache: "no-store" });
      const json = (await response.json().catch(() => ({}))) as { tags?: SafeTag[]; error?: string };
      if (!response.ok) throw new Error(json.error || "Không đọc được SafeTag.");
      setTags(json.tags || []);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không đọc được SafeTag.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const first = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(first);
  }, [load]);

  const createTag = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, publicNote }),
      });
      const json = (await response.json().catch(() => ({}))) as { tag?: SafeTag; error?: string };
      if (!response.ok || !json.tag) throw new Error(json.error || "Chưa tạo được SafeTag.");
      setTags((current) => [json.tag!, ...current]);
      setLabel("");
      setPublicNote("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Chưa tạo được SafeTag.");
    } finally {
      setBusy(false);
    }
  };

  const update = async (body: Record<string, string>) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/tags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Chưa cập nhật được SafeTag.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Chưa cập nhật được SafeTag.");
    } finally {
      setBusy(false);
    }
  };

  const unread = tags.reduce((total, safeTag) => total + safeTag.reports.filter((report) => report.status === "unread").length, 0);

  return (
    <div>
      <Link href="/bounties/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-ink-soft hover:text-forest"><ArrowLeft size={16} /> Hoạt động của tôi</Link>
      <div className="mt-6 grid gap-8 xl:grid-cols-[0.82fr_1.18fr]">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.13em] text-forest"><Tag size={17} weight="duotone" /> SafeTag QR</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Gắn đường về nhà cho đồ vật</h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-ink-soft">Tạo mã QR, in và dán lên đồ vật. Người quét chỉ thấy tên món đồ và biểu mẫu liên hệ, không thấy ví hay danh tính của bạn.</p>

          <form onSubmit={createTag} className="app-card mt-7 p-5 sm:p-6">
            <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-mint-soft text-forest"><Plus size={20} weight="bold" /></span><div><h2 className="font-bold">Tạo SafeTag mới</h2><p className="mt-0.5 text-xs text-ink-muted">Mỗi mã dùng cho một món đồ.</p></div></div>
            <label className="mt-5 block text-sm font-semibold">Tên đồ vật<input className="app-input mt-2" value={label} onChange={(event) => setLabel(event.target.value)} maxLength={80} required placeholder="Ví dụ: Balo xanh của Mai" /></label>
            <label className="mt-4 block text-sm font-semibold">Lời nhắn công khai<textarea className="app-input mt-2 min-h-24 resize-y" value={publicNote} onChange={(event) => setPublicNote(event.target.value)} maxLength={240} placeholder="Ví dụ: Cảm ơn bạn đã nhặt được. Xin hãy để lại lời nhắn bên dưới." /></label>
            <button type="submit" disabled={busy || !connected} className="app-button-primary mt-5 w-full"><Plus size={17} /> {busy ? "Đang tạo" : "Tạo mã QR riêng"}</button>
            {!connected ? <div className="mt-4"><p className="mb-3 text-xs leading-5 text-ink-muted">Xác minh ví để chứng minh quyền sở hữu SafeTag.</p><ConnectWalletButton size="md" /></div> : null}
          </form>
        </div>

        <div>
          <div className="flex items-end justify-between gap-4"><div><h2 className="text-xl font-bold">SafeTag của bạn</h2><p className="mt-1 text-sm text-ink-soft">{tags.length} mã, {unread} lời nhắn chưa đọc</p></div><button type="button" onClick={() => void load()} disabled={loading} className="text-xs font-bold text-forest hover:underline">{loading ? "Đang tải" : "Làm mới"}</button></div>
          {error ? <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900" role="alert">{error}</p> : null}
          {loading && tags.length === 0 ? <div className="app-card mt-5 p-6"><div className="skeleton h-64 w-full" /></div> : null}
          {!loading && tags.length === 0 ? <div className="app-card mt-5 p-8 text-center"><ShieldCheck size={34} className="mx-auto text-forest" /><h3 className="mt-4 font-bold">Chưa có SafeTag</h3><p className="mt-2 text-sm text-ink-soft">Tạo mã đầu tiên ở biểu mẫu bên trái.</p></div> : null}
          <div className="mt-5 grid gap-5">{tags.map((safeTag) => <TagCard key={safeTag.id} safeTag={safeTag} busy={busy} update={update} />)}</div>
        </div>
      </div>
    </div>
  );
}

function TagCard({ safeTag, busy, update }: { safeTag: SafeTag; busy: boolean; update: (body: Record<string, string>) => Promise<void> }) {
  const unread = safeTag.reports.filter((report) => report.status === "unread").length;
  return (
    <article className="app-card overflow-hidden">
      <div className="grid md:grid-cols-[260px_1fr]">
        <div className="border-b border-line p-5 md:border-b-0 md:border-r"><SafeTagQr code={safeTag.publicCode} label={safeTag.label} /></div>
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-bold">{safeTag.label}</h3><p className="mt-1 font-mono text-[10px] text-ink-muted">{safeTag.publicCode}</p></div><StatusBadge status={safeTag.status} /></div>
          {safeTag.publicNote ? <p className="mt-4 text-sm leading-6 text-ink-soft">{safeTag.publicNote}</p> : null}
          <div className="mt-5 flex flex-wrap gap-2">
            {safeTag.status !== "active" ? <button type="button" disabled={busy} onClick={() => void update({ tagId: safeTag.id, status: "active" })} className="app-button-secondary min-h-10 py-2">Kích hoạt lại</button> : null}
            {safeTag.status === "active" ? <button type="button" disabled={busy} onClick={() => void update({ tagId: safeTag.id, status: "recovered" })} className="app-button-secondary min-h-10 py-2"><CheckCircle size={16} /> Đã nhận lại đồ</button> : null}
            {safeTag.status !== "disabled" ? <button type="button" disabled={busy} onClick={() => void update({ tagId: safeTag.id, status: "disabled" })} className="min-h-10 rounded-xl px-3 text-xs font-bold text-coral hover:bg-rose-50">Tắt mã</button> : null}
          </div>
        </div>
      </div>
      <div className="border-t border-line bg-[#fbfcfb] p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3"><h4 className="font-bold">Lời nhắn từ người tìm thấy</h4>{unread > 0 ? <span className="rounded-lg bg-forest px-2.5 py-1 text-xs font-bold text-white">{unread} mới</span> : null}</div>
        {safeTag.reports.length === 0 ? <p className="mt-3 text-sm text-ink-muted">Chưa có lời nhắn nào.</p> : <div className="mt-4 grid gap-3">{safeTag.reports.map((report) => <div key={report.id} className="rounded-xl border border-line bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold">{report.reporterName || "Người tìm thấy"}</p><time className="text-xs text-ink-muted">{new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(report.createdAt))}</time></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink">{report.message}</p><div className="mt-3 flex flex-col gap-2 text-xs text-ink-soft sm:flex-row sm:gap-5"><span className="inline-flex items-center gap-1.5"><EnvelopeSimple size={15} className="text-forest" />{report.contact}</span>{report.location ? <span className="inline-flex items-center gap-1.5"><MapPin size={15} className="text-forest" />{report.location}</span> : null}</div>{report.status !== "resolved" ? <button type="button" disabled={busy} onClick={() => void update({ reportId: report.id, reportStatus: "resolved" satisfies SafeTagReportStatus })} className="mt-4 text-xs font-bold text-forest hover:underline">Đánh dấu đã xử lý</button> : <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700"><CheckCircle size={15} weight="fill" /> Đã xử lý</p>}</div>)}</div>}
      </div>
    </article>
  );
}

function StatusBadge({ status }: { status: SafeTagStatus }) {
  const labels: Record<SafeTagStatus, string> = { active: "Đang hoạt động", recovered: "Đã nhận lại", disabled: "Đã tắt" };
  return <span className={`rounded-lg border px-2.5 py-1 text-xs font-bold ${status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : status === "recovered" ? "border-sky-200 bg-sky-50 text-sky-800" : "border-line bg-bg-deep text-ink-muted"}`}>{labels[status]}</span>;
}
