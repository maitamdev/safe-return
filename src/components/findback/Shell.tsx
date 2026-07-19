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
} from "@phosphor-icons/react";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { NetworkBadge } from "@/components/wallet/NetworkBadge";
import { useFindBack } from "@/lib/findback/provider";
import { cn } from "@/lib/cn";
import { FIND_SYMBOL } from "@/lib/findback/config";

const nav = [
  { href: "/bounties", label: "Browse", icon: MagnifyingGlass },
  { href: "/bounties/create", label: "Create", icon: PlusCircle },
  { href: "/bounties/dashboard", label: "Dashboard", icon: SquaresFour },
  { href: "/", label: "Home", icon: House },
];

export function FindBackShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { error, clearError, lastTx, lastTxUrl, lastIx, txState, chainReady, programId } =
    useFindBack();

  return (
    <div className="min-h-dvh bg-[#070b14] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(153,69,255,0.18),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(20,241,149,0.1),_transparent_45%)]" />
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#070b14]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <Link href="/bounties" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#9945FF] to-[#14F195] text-sm font-bold text-black">
              FB
            </span>
            <div>
              <p className="font-display text-sm font-bold leading-none">
                FindBack AI
              </p>
              <p className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-white/45">
                Solana · AI claims
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((item) => {
              const active =
                item.href === "/bounties"
                  ? pathname === "/bounties"
                  : pathname?.startsWith(item.href) && item.href !== "/";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                    active
                      ? "bg-white/10 text-white"
                      : "text-white/55 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <item.icon size={14} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <NetworkBadge />
            </div>
            <ConnectWalletButton dark />
          </div>
        </div>
      </header>

      {(error || txState === "pending" || lastTx) && (
        <div className="border-b border-white/10 bg-black/40">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-2 text-xs md:px-6">
            {txState === "pending" && (
              <span className="inline-flex items-center gap-1.5 text-[#14F195]">
                <Sparkle size={12} className="animate-pulse" />
                Pending · {lastIx}
              </span>
            )}
            {txState === "confirmed" && lastTxUrl && (
              <a
                href={lastTxUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[#14F195] underline-offset-2 hover:underline"
              >
                Confirmed · Explorer ↗
              </a>
            )}
            {txState === "failed" && error && (
              <span className="inline-flex items-start gap-1.5 text-rose-300">
                <WarningCircle size={14} className="mt-0.5 shrink-0" />
                <span className="break-all">{error}</span>
                <button
                  type="button"
                  className="ml-2 shrink-0 underline"
                  onClick={clearError}
                >
                  dismiss
                </button>
              </span>
            )}
            <span className="ml-auto font-mono text-[10px] text-white/35">
              {chainReady ? "ready" : "setup mint"} · {FIND_SYMBOL} ·{" "}
              {programId.slice(0, 6)}…
            </span>
          </div>
        </div>
      )}

      <main className="relative mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
        {children}
      </main>

      <nav className="sticky bottom-0 z-30 grid grid-cols-4 border-t border-white/10 bg-[#070b14]/95 px-2 py-2 backdrop-blur-xl md:hidden">
        {nav.map((item) => {
          const active =
            item.href === "/bounties"
              ? pathname === "/bounties"
              : pathname?.startsWith(item.href) && item.href !== "/";
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-medium",
                active ? "text-[#14F195]" : "text-white/45"
              )}
            >
              <item.icon size={18} weight={active ? "fill" : "regular"} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
