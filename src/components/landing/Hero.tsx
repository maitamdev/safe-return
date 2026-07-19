"use client";

import {
  ShieldCheck,
  Sparkle,
  QrCode,
  CurrencyCircleDollar,
  ArrowRight,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useT } from "@/lib/i18n";
import Link from "next/link";

export function Hero() {
  const t = useT();
  const stats = [
    { label: t("stat.items"), value: "1,248" },
    { label: t("stat.returns"), value: "386" },
    { label: t("stat.time"), value: "4.2h" },
    { label: t("stat.dispute"), value: "1.8%" },
  ];
  const chips = [
    { icon: QrCode, label: t("hero.chip1") },
    { icon: Sparkle, label: t("hero.chip2") },
    { icon: CurrencyCircleDollar, label: t("hero.chip3") },
    { icon: ShieldCheck, label: t("hero.chip4") },
  ];

  return (
    <section className="border-b border-line bg-white pt-28 md:pt-32">
      <div className="mx-auto max-w-5xl px-5 pb-16 md:px-8 md:pb-20">
        <Badge tone="mint">{t("hero.badge")}</Badge>

        <h1 className="mt-5 max-w-2xl text-[clamp(2.25rem,5vw,3.5rem)] font-semibold leading-[1.12] tracking-tight text-balance">
          {t("hero.title1")} {t("hero.title2")}{" "}
          <span className="text-forest">{t("hero.title3")}</span>
        </h1>

        <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-soft md:text-lg">
          {t("hero.sub")}
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button href="/bounties" size="lg" icon>
            FindBack AI — Open app
          </Button>
          <Button href="/bounties/create" variant="secondary" size="lg">
            Create bounty
          </Button>
          <Link
            href="/app"
            className="text-sm font-medium text-ink-muted underline-offset-4 hover:text-ink hover:underline"
          >
            Campus MVP
          </Link>
        </div>

        <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-muted">
          {chips.map(({ icon: Icon, label }) => (
            <span key={label} className="inline-flex items-center gap-1.5">
              <Icon size={15} className="text-forest" weight="duotone" />
              {label}
            </span>
          ))}
        </div>

        {/* Real flow strip — not a fake phone mock */}
        <div className="mt-12 overflow-hidden rounded-xl border border-line bg-bg">
          <div className="grid divide-y divide-line sm:grid-cols-4 sm:divide-x sm:divide-y-0">
            {[
              { step: "01", title: t("how.s1t"), desc: t("how.s1d") },
              { step: "02", title: t("how.s2t"), desc: t("how.s2d") },
              { step: "03", title: t("how.s3t"), desc: t("how.s3d") },
              { step: "04", title: t("how.s4t"), desc: t("how.s4d") },
            ].map((s) => (
              <div key={s.step} className="bg-white p-4 md:p-5">
                <p className="font-mono text-[11px] font-medium text-forest">
                  {s.step}
                </p>
                <p className="mt-2 text-sm font-semibold text-ink">{s.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted line-clamp-2">
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-line bg-white px-4 py-3 md:px-5">
            <p className="text-xs text-ink-muted">
              {t("hero.cardMatch")} · {t("hero.cardEscrow")}
            </p>
            <Link
              href="/app"
              className="inline-flex items-center gap-1 text-xs font-semibold text-forest hover:underline"
            >
              {t("hero.ctaApp")}
              <ArrowRight size={12} weight="bold" />
            </Link>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-line bg-white px-4 py-4"
            >
              <p className="text-2xl font-semibold tracking-tight md:text-[1.75rem]">
                {s.value}
              </p>
              <p className="mt-1 text-xs text-ink-muted md:text-sm">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
