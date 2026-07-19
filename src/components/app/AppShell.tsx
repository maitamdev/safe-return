"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  Package,
  MagnifyingGlass,
  HandHeart,
  Buildings,
  UserCircle,
  Bell,
  QrCode,
  PlayCircle,
  ArrowLeft,
} from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { currentUser } from "@/lib/data";
import { useApp } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { useWallet } from "@solana/wallet-adapter-react";
import { programMeta } from "@/lib/solana/escrow";

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useT();
  const pathname = usePathname();
  const { notifications, role, setRole, chainError, clearChainError, chainReady } =
    useApp();
  const { publicKey } = useWallet();
  const unread = notifications.filter((n) => n.unread).length;

  const nav = [
    { href: "/app", label: t("app.nav.home"), icon: House },
    { href: "/app/items", label: t("app.nav.items"), icon: Package },
    { href: "/app/lost", label: t("app.nav.lost"), icon: MagnifyingGlass },
    { href: "/app/found", label: t("app.nav.found"), icon: HandHeart },
    { href: "/app/cases", label: t("app.nav.cases"), icon: Package },
    { href: "/app/safepoint", label: t("app.nav.safepoint"), icon: Buildings },
    { href: "/app/demo", label: t("app.nav.demo"), icon: PlayCircle },
    { href: "/app/profile", label: t("app.nav.profile"), icon: UserCircle },
  ];

  return (
    <div className="min-h-dvh bg-bg">
      <div className="mx-auto flex min-h-dvh max-w-[1400px]">
        <aside className="sticky top-0 hidden h-dvh w-[260px] shrink-0 flex-col border-r border-line bg-bg-elevated/80 p-5 backdrop-blur-xl lg:flex">
          <Link href="/" className="mb-8 flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-forest text-white">
              <QrCode size={20} weight="bold" />
            </span>
            <div>
              <p className="font-display text-base font-bold leading-none">
                SafeReturn
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-ink-muted">
                {t("app.mvp")}
              </p>
            </div>
          </Link>

          <nav className="flex flex-1 flex-col gap-1">
            {nav.map((item) => {
              const active =
                item.href === "/app"
                  ? pathname === "/app"
                  : pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium transition-all duration-300",
                    active
                      ? "bg-forest text-white shadow-[0_12px_28px_-14px_rgba(12,61,46,0.55)]"
                      : "text-ink-soft hover:bg-black/[0.04] hover:text-ink"
                  )}
                >
                  <item.icon size={18} weight={active ? "fill" : "regular"} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-2xl border border-line bg-white/50 px-3 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                {t("lang.switch")}
              </span>
              <LanguageToggle size="sm" />
            </div>

            <div className="rounded-2xl border border-line bg-mint-soft/60 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
                {t("app.actAs")}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(["owner", "finder", "safepoint"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
                      role === r
                        ? "bg-forest text-white"
                        : "bg-white/70 text-ink-soft hover:bg-white"
                    )}
                  >
                    {t(`app.role.${r}`)}
                  </button>
                ))}
              </div>
              <div className="mt-3 space-y-2 border-t border-line pt-3">
                <ConnectWalletButton className="w-full" />
                <p className="font-mono text-[10px] leading-relaxed text-ink-muted">
                  Devnet · {chainReady ? "ready" : "…"}
                  <br />
                  {programMeta.programId.slice(0, 8)}…
                  {publicKey && (
                    <>
                      <br />
                      {publicKey.toBase58().slice(0, 4)}…
                      {publicKey.toBase58().slice(-4)}
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {chainError && (
            <div className="flex items-start justify-between gap-3 border-b border-coral/30 bg-coral/10 px-4 py-2 text-xs text-coral md:px-6">
              <p className="min-w-0 flex-1 break-words">
                <strong>Solana:</strong> {chainError}
              </p>
              <button
                type="button"
                className="shrink-0 font-semibold underline"
                onClick={clearChainError}
              >
                dismiss
              </button>
            </div>
          )}

          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-bg/80 px-4 py-3 backdrop-blur-xl md:px-6">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-black/[0.04] text-ink-soft transition hover:bg-black/[0.07] lg:hidden"
              >
                <ArrowLeft size={16} />
              </Link>
              <div className="lg:hidden">
                <p className="font-display text-sm font-bold">SafeReturn</p>
              </div>
              <div className="hidden lg:block">
                <p className="text-sm text-ink-soft">
                  {t("app.signedIn")}{" "}
                  <span className="font-semibold text-ink">
                    {currentUser.name}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ConnectWalletButton />
              <LanguageToggle size="sm" className="lg:hidden" />
              <Link
                href="/app/profile"
                className="relative flex h-10 w-10 items-center justify-center rounded-full bg-black/[0.04] transition hover:bg-black/[0.07]"
              >
                <Bell size={18} />
                {unread > 0 && (
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-coral" />
                )}
              </Link>
              <div className="flex h-10 items-center gap-2 rounded-full border border-line bg-bg-elevated pl-1.5 pr-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-forest text-[11px] font-bold text-white">
                  Q
                </span>
                <span className="hidden text-sm font-medium sm:inline">
                  {currentUser.nickname}
                </span>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 md:px-6 md:py-8">{children}</main>

          <nav className="sticky bottom-0 z-30 grid grid-cols-5 border-t border-line bg-bg-elevated/95 px-1 py-2 backdrop-blur-xl lg:hidden">
            {[
              nav[0],
              nav[1],
              nav[2],
              nav[3],
              nav[7],
            ].map((item) => {
              const active =
                item.href === "/app"
                  ? pathname === "/app"
                  : pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-medium",
                    active ? "text-forest" : "text-ink-muted"
                  )}
                >
                  <item.icon size={20} weight={active ? "fill" : "regular"} />
                  <span className="max-w-[4.5rem] truncate text-center">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}
