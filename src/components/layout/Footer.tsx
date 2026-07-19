"use client";

import Link from "next/link";
import { QrCode } from "@phosphor-icons/react";
import { useT } from "@/lib/i18n";

export function Footer() {
  const t = useT();

  return (
    <footer className="border-t border-line bg-bg-deep text-white">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 md:grid-cols-[1.4fr_1fr_1fr] md:px-8">
        <div>
          <div className="mb-5 flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-mint text-forest-deep">
              <QrCode size={20} weight="bold" />
            </span>
            <span className="font-display text-lg font-bold">SafeReturn</span>
          </div>
          <p className="max-w-sm text-[15px] leading-relaxed text-white/60">
            {t("footer.blurb")}
          </p>
        </div>

        <div>
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
            {t("footer.product")}
          </p>
          <ul className="space-y-3 text-sm text-white/70">
            <li>
              <Link href="/#how" className="hover:text-white">
                {t("nav.how")}
              </Link>
            </li>
            <li>
              <Link href="/#ai" className="hover:text-white">
                {t("nav.ai")}
              </Link>
            </li>
            <li>
              <Link href="/app" className="hover:text-white">
                {t("nav.mvp")}
              </Link>
            </li>
            <li>
              <Link href="/app/demo" className="hover:text-white">
                {t("footer.live")}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
            {t("footer.stack")}
          </p>
          <ul className="space-y-3 text-sm text-white/70">
            <li>Solana Devnet</li>
            <li>Mock USDC (SPL)</li>
            <li>AI Vision Matching</li>
            <li>SafePoint Handover</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 px-5 py-6 md:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between">
          <p>{t("footer.copy")}</p>
          <p className="font-mono">{t("footer.proof")}</p>
        </div>
      </div>
    </footer>
  );
}
