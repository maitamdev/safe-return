"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  MagnifyingGlass,
  PlusCircle,
  SquaresFour,
  Sparkle,
  WarningCircle,
  CheckCircle,
  X,
} from "@phosphor-icons/react";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { NetworkBadge } from "@/components/wallet/NetworkBadge";
import { TokenBalances } from "@/components/wallet/TokenBalances";
import { UserMenu } from "@/components/auth/UserMenu";
import { useFindBack } from "@/lib/findback/provider";
import { cn } from "@/lib/cn";

const nav = [
  { href: "/bounties", label: "Tìm đồ", icon: MagnifyingGlass },
  { href: "/bounties/create", label: "Tạo tin", icon: PlusCircle },
  { href: "/bounties/dashboard", label: "Của tôi", icon: SquaresFour },
  { href: "/", label: "Giới thiệu", icon: House },
];

export function FindBackShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    error,
    clearError,
    lastTxUrl,
    lastIx,
    txState,
  } = useFindBack();

  return (
    <div className="min-h-dvh bg-[#06080f] text-white">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(153,69,255,0.16),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(20,241,149,0.08),_transparent_45%)]"
      />

      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#06080f]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <Link href="/bounties" className="flex shrink-0 items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#9945FF] to-[#14F195] text-sm font-bold text-black">
              FB
            </span>
            <div className="hidden min-[400px]:block">
              <p className="text-sm font-bold leading-none">FindBack</p>
              <p className="mt-0.5 text-[10px] text-white/40">AI · Solana Devnet</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((item) => {
              const active =
                item.href === "/bounties"
                  ? pathname === "/bounties"
                  : item.href === "/"
                    ? false
                    : pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition",
                    active
                      ? "bg-white text-black"
                      : "text-white/55 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <item.icon size={14} weight={active ? "fill" : "regular"} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            <div className="hidden items-center gap-1.5 lg:flex">
              <NetworkBadge showBalance={false} />
              <TokenBalances dark />
            </div>
            <UserMenu dark />
            <ConnectWalletButton dark />
          </div>
        </div>

        {/* mobile balances */}
        <div className="flex items-center justify-between gap-2 border-t border-white/5 px-4 py-2 lg:hidden">
          <NetworkBadge showBalance={false} />
          <TokenBalances dark />
        </div>
      </header>

      {/* tx toast bar — plain Vietnamese */}
      {(error || txState === "pending" || (txState === "confirmed" && lastTxUrl)) && (
        <div
          className={cn(
            "border-b",
            txState === "failed"
              ? "border-rose-500/20 bg-rose-500/10"
              : txState === "confirmed"
                ? "border-emerald-500/20 bg-emerald-500/10"
                : "border-white/10 bg-black/40"
          )}
        >
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-2.5 text-xs md:px-6">
            {txState === "pending" && (
              <span className="inline-flex items-center gap-1.5 font-medium text-[#14F195]">
                <Sparkle size={14} className="animate-pulse" weight="fill" />
                Đang gửi giao dịch… {lastIx ? `(${lastIx})` : ""} Mở Phantom để ký
                nếu được hỏi.
              </span>
            )}
            {txState === "confirmed" && lastTxUrl && (
              <a
                href={lastTxUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-semibold text-[#14F195] hover:underline"
              >
                <CheckCircle size={14} weight="fill" />
                Thành công — xem trên Solana Explorer ↗
              </a>
            )}
            {txState === "failed" && error && (
              <span className="inline-flex max-w-full items-start gap-1.5 text-rose-200">
                <WarningCircle size={14} className="mt-0.5 shrink-0" />
                <span className="min-w-0 break-words">{error}</span>
                <button
                  type="button"
                  className="ml-1 shrink-0 rounded-full p-0.5 hover:bg-white/10"
                  onClick={clearError}
                  aria-label="Đóng"
                >
                  <X size={14} />
                </button>
              </span>
            )}
          </div>
        </div>
      )}

      <main className="relative mx-auto max-w-6xl px-4 py-6 pb-24 md:px-6 md:py-10 md:pb-12">
        {children}
      </main>

      {/* bottom nav mobile — Vietnamese labels */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-white/10 bg-[#06080f]/95 px-1 py-1.5 backdrop-blur-xl md:hidden">
        {nav.map((item) => {
          const active =
            item.href === "/bounties"
              ? pathname === "/bounties"
              : item.href === "/"
                ? pathname === "/"
                : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-xl py-2 text-[10px] font-semibold",
                active ? "text-[#14F195]" : "text-white/40"
              )}
            >
              <item.icon size={20} weight={active ? "fill" : "regular"} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
