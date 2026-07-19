"use client";

import { Check, X } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/Badge";
import { Reveal } from "@/components/ui/Reveal";
import { useT } from "@/lib/i18n";

export function Compare() {
  const t = useT();
  const rows = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
    old: t(`compare.r${n}o`),
    neu: t(`compare.r${n}n`),
  }));

  return (
    <section className="py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <Reveal>
          <Badge tone="gold">{t("compare.badge")}</Badge>
          <h2 className="mt-5 max-w-2xl font-display text-3xl font-bold tracking-tight md:text-5xl">
            {t("compare.title2")}
          </h2>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="mt-12 overflow-hidden rounded-[2rem] border border-line bg-bg-elevated shadow-[0_24px_60px_-32px_rgba(12,31,24,0.25)]">
            <div className="grid grid-cols-2 border-b border-line bg-black/[0.02]">
              <div className="px-5 py-4 text-sm font-semibold text-ink-muted md:px-8">
                {t("compare.oldH")}
              </div>
              <div className="border-l border-line bg-mint-soft/60 px-5 py-4 text-sm font-semibold text-forest-deep md:px-8">
                {t("compare.newH")}
              </div>
            </div>
            {rows.map((row, i) => (
              <div
                key={row.old}
                className={`grid grid-cols-2 ${
                  i < rows.length - 1 ? "border-b border-line" : ""
                }`}
              >
                <div className="flex items-start gap-3 px-5 py-4 text-sm text-ink-soft md:px-8">
                  <X
                    size={16}
                    className="mt-0.5 shrink-0 text-coral"
                    weight="bold"
                  />
                  {row.old}
                </div>
                <div className="flex items-start gap-3 border-l border-line bg-mint-soft/30 px-5 py-4 text-sm font-medium text-ink md:px-8">
                  <Check
                    size={16}
                    className="mt-0.5 shrink-0 text-forest"
                    weight="bold"
                  />
                  {row.neu}
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
