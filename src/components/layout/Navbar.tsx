"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flask, List, ShieldCheck } from "@phosphor-icons/react";

const links = [
  { href: "/#how", label: "Cách hoạt động" },
  { href: "/#trust", label: "Tính minh bạch" },
  { href: "/bounties", label: "Xem tin thất lạc" },
];

export function Navbar() {
  const pathname = usePathname();
  const hide =
    pathname?.startsWith("/bounties") ||
    pathname?.startsWith("/login") ||
    pathname?.startsWith("/signup") ||
    pathname?.startsWith("/auth") ||
    pathname?.startsWith("/setup");

  if (hide) return null;

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-line bg-white/92 backdrop-blur-xl">
      <nav className="mx-auto flex h-[4.5rem] max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5" aria-label="SafeReturn trang chủ">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest text-white">
            <ShieldCheck size={20} weight="fill" />
          </span>
          <span className="text-lg font-bold tracking-[-0.03em] text-forest">SafeReturn</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-ink-soft transition hover:bg-bg-deep hover:text-forest"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 lg:inline-flex">
            <Flask size={16} weight="duotone" /> Solana Devnet
          </span>
          <Link href="/login" className="hidden px-3 py-2 text-sm font-semibold text-ink-soft hover:text-forest sm:block">
            Đăng nhập
          </Link>
          <Link href="/signup" className="app-button-primary min-h-10 px-4 py-2">
            Tạo tài khoản
          </Link>
          <details className="relative md:hidden">
            <summary className="flex h-10 w-10 list-none items-center justify-center rounded-xl border border-line-strong bg-white text-ink [&::-webkit-details-marker]:hidden">
              <List size={20} />
              <span className="sr-only">Mở menu</span>
            </summary>
            <div className="absolute right-0 top-12 w-64 rounded-2xl border border-line bg-white p-2 shadow-[0_24px_60px_rgba(30,54,43,0.18)]">
              {links.map((link) => (
                <Link key={link.href} href={link.href} className="block rounded-xl px-4 py-3 text-sm font-semibold text-ink-soft hover:bg-bg-deep hover:text-forest">
                  {link.label}
                </Link>
              ))}
              <Link href="/login" className="mt-1 block rounded-xl border border-line px-4 py-3 text-center text-sm font-semibold text-ink">
                Đăng nhập
              </Link>
            </div>
          </details>
        </div>
      </nav>
    </header>
  );
}
