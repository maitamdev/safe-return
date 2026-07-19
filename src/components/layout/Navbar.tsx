"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { List, X, QrCode } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n";

export function Navbar() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const isApp =
    pathname?.startsWith("/app") ||
    pathname?.startsWith("/bounties") ||
    pathname?.startsWith("/login") ||
    pathname?.startsWith("/signup") ||
    pathname?.startsWith("/auth");

  const links = [
    { href: "/#problem", label: t("nav.problem") },
    { href: "/#how", label: t("nav.how") },
    { href: "/#ai", label: t("nav.ai") },
    { href: "/login", label: "Đăng nhập" },
    { href: "/bounties", label: "FindBack AI" },
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (isApp) return null;

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 border-b transition-colors duration-200",
          scrolled
            ? "border-line bg-white/90 backdrop-blur-md"
            : "border-transparent bg-white/70 backdrop-blur-sm"
        )}
      >
        <nav className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-5 md:h-16 md:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-forest text-white">
              <QrCode size={16} weight="bold" />
            </span>
            <span className="text-[15px] font-semibold tracking-tight">
              FindBack AI
            </span>
          </Link>

          <div className="hidden items-center gap-0.5 md:flex">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-md px-3 py-1.5 text-sm text-ink-soft transition-colors hover:bg-black/[0.04] hover:text-ink"
              >
                {l.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <LanguageToggle size="sm" />
            <Button href="/login" size="sm" className="hidden sm:inline-flex">
              Đăng nhập
            </Button>
            <button
              type="button"
              aria-label={t("nav.menu")}
              onClick={() => setOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-black/[0.04] md:hidden"
            >
              {open ? <X size={18} /> : <List size={18} />}
            </button>
          </div>
        </nav>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 bg-white pt-16 md:hidden">
          <div className="flex flex-col px-5 py-4">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="border-b border-line py-4 text-lg font-medium text-ink"
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-6 space-y-3">
              <LanguageToggle />
              <Button href="/login" size="lg" className="w-full" icon>
                Đăng nhập
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
