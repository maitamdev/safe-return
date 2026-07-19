"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { List, X } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  // App / auth shells have their own chrome
  const hide =
    pathname?.startsWith("/app") ||
    pathname?.startsWith("/bounties") ||
    pathname?.startsWith("/login") ||
    pathname?.startsWith("/signup") ||
    pathname?.startsWith("/auth") ||
    pathname?.startsWith("/setup");

  const links = [
    { href: "/#how", label: "Cách dùng" },
    { href: "/#why", label: "Vì sao tin" },
    { href: "/bounties", label: "Mở app" },
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (hide) return null;

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 border-b transition-all duration-300",
          scrolled
            ? "border-white/10 bg-[#06080f]/85 backdrop-blur-xl"
            : "border-transparent bg-transparent"
        )}
      >
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 md:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#9945FF] to-[#14F195] text-sm font-bold text-black">
              FB
            </span>
            <div className="leading-none">
              <span className="text-[15px] font-bold tracking-tight text-white">
                FindBack AI
              </span>
              <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-white/40">
                Lost & found · Solana
              </p>
            </div>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-full px-3.5 py-1.5 text-sm text-white/60 transition hover:bg-white/5 hover:text-white"
              >
                {l.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden rounded-full px-3.5 py-2 text-sm font-semibold text-white/70 transition hover:text-white sm:inline-flex"
            >
              Đăng nhập
            </Link>
            <Link
              href="/signup"
              className="inline-flex rounded-full bg-white px-4 py-2 text-sm font-bold text-black transition hover:bg-white/90"
            >
              Bắt đầu
            </Link>
            <button
              type="button"
              aria-label="Menu"
              onClick={() => setOpen((v) => !v)}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white md:hidden"
            >
              {open ? <X size={18} /> : <List size={18} />}
            </button>
          </div>
        </nav>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 bg-[#06080f] pt-20 md:hidden">
          <div className="flex flex-col gap-1 px-5">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-2xl px-4 py-4 text-lg font-medium text-white hover:bg-white/5"
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="mt-4 rounded-2xl border border-white/15 px-4 py-4 text-center font-semibold"
            >
              Đăng nhập
            </Link>
            <Link
              href="/signup"
              onClick={() => setOpen(false)}
              className="mt-2 rounded-2xl bg-white px-4 py-4 text-center font-bold text-black"
            >
              Bắt đầu miễn phí
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
