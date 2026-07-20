"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Check, X } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";

type NotificationRow = {
  id: string;
  claim_id: string | null;
  bounty_id: string | null;
  kind: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export function NotificationsButton() {
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/notifications", { cache: "no-store" });
    if (!response.ok) return;
    const json = (await response.json()) as {
      notifications?: NotificationRow[];
      unread?: number;
    };
    setRows(json.notifications || []);
    setUnread(json.unread || 0);
  }, []);

  useEffect(() => {
    const first = window.setTimeout(() => void load(), 0);
    const poll = window.setInterval(() => void load(), 30_000);
    const supabase = createClient();
    const channel = supabase
      ?.channel(`claim-notifications-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "claim_notifications" },
        () => void load(),
      )
      .subscribe();
    return () => {
      window.clearTimeout(first);
      window.clearInterval(poll);
      if (supabase && channel) void supabase.removeChannel(channel);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const markRead = async (id?: string) => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(id ? { id } : { all: true }),
    });
    await load();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-bg-elevated text-ink-soft transition hover:bg-bg-deep hover:text-ink"
        aria-label={unread ? `${unread} thông báo chưa đọc` : "Thông báo"}
        aria-expanded={open}
      >
        <Bell size={18} weight={unread ? "fill" : "regular"} aria-hidden />
        {unread ? (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-rose-600 px-1 text-center text-[10px] font-bold leading-5 text-white">
            {Math.min(unread, 99)}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-50 w-[min(23rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-bg-elevated shadow-[0_20px_60px_rgba(24,52,39,0.18)]">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <p className="text-sm font-bold">Thông báo</p>
              <p className="text-[11px] text-ink-muted">Cập nhật từ trao đổi và Solana Devnet</p>
            </div>
            <div className="flex items-center gap-1">
              {unread ? (
                <button type="button" onClick={() => void markRead()} className="rounded-lg p-2 text-forest hover:bg-mint-soft" aria-label="Đánh dấu tất cả đã đọc"><Check size={16} aria-hidden /></button>
              ) : null}
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-ink-muted hover:bg-bg-deep" aria-label="Đóng"><X size={16} aria-hidden /></button>
            </div>
          </div>
          <div className="max-h-[28rem] overflow-y-auto">
            {rows.length ? rows.map((item) => (
              <Link
                key={item.id}
                href={item.bounty_id ? `/bounties/${item.bounty_id}#claims-title` : "/bounties/dashboard"}
                onClick={() => { setOpen(false); if (!item.read_at) void markRead(item.id); }}
                className={`block border-b border-line px-4 py-3 transition last:border-0 hover:bg-bg-deep ${item.read_at ? "" : "bg-mint-soft/60"}`}
              >
                <div className="flex items-start gap-2">
                  {!item.read_at ? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-forest" aria-label="Chưa đọc" /> : null}
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink">{item.title}</p>
                    {item.body ? <p className="mt-1 text-xs leading-5 text-ink-soft">{item.body}</p> : null}
                    <time className="mt-1 block text-[10px] text-ink-muted">{formatTime(item.created_at)}</time>
                  </div>
                </div>
              </Link>
            )) : (
              <p className="px-4 py-10 text-center text-sm text-ink-muted">Chưa có thông báo mới.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date)
    : "";
}
