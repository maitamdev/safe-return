"use client";

import { useAuth } from "@/lib/auth/AuthProvider";
import { SignOut, User } from "@phosphor-icons/react";
import Link from "next/link";

export function UserMenu() {
  const { user, loading, signOut, configured } = useAuth();

  if (!configured) {
    return (
      <Link
        href="/login"
        className="badge-devnet rounded-full px-3 py-1.5 text-xs font-semibold"
      >
        Thiết lập
      </Link>
    );
  }

  if (loading) {
    return <span className="text-xs text-ink-muted">…</span>;
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 rounded-full bg-forest px-3 py-1.5 text-xs font-bold text-white"
      >
        <User size={12} weight="bold" />
        Đăng nhập
      </Link>
    );
  }

  const label =
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    user.email?.split("@")[0] ||
    "User";

  return (
    <div className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap">
      <span
        className="hidden max-w-[7rem] truncate rounded-full border border-line bg-bg-elevated px-2.5 py-1 text-[11px] font-medium text-ink-soft sm:inline"
        title={user.email || ""}
      >
        {label}
      </span>
      <button
        type="button"
        onClick={() => void signOut()}
        className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[11px] font-semibold text-ink-soft hover:bg-black/[0.04]"
        title="Đăng xuất"
      >
        <SignOut size={12} />
        <span className="hidden sm:inline">Thoát</span>
      </button>
    </div>
  );
}
