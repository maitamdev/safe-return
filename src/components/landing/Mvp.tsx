"use client";

import { CheckCircle, CircleDashed } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { useT } from "@/lib/i18n";

export function Mvp() {
  const t = useT();
  const must = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => t(`mvp.m${n}`));
  const later = [1, 2, 3, 4, 5].map((n) => t(`mvp.l${n}`));

  return (
    <section className="bg-bg-deep py-24 text-white md:py-32">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <Reveal>
            <Badge tone="mint">{t("mvp.badge2")}</Badge>
            <h2 className="mt-5 font-display text-3xl font-bold tracking-tight md:text-5xl">
              {t("mvp.title2")}
            </h2>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-white/60 md:text-lg">
              {t("mvp.sub2a")}{" "}
              <span className="text-mint">{t("mvp.sub2b")}</span>
              {t("mvp.sub2c")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button href="/app" size="lg" icon>
                {t("mvp.cta1")}
              </Button>
              <Button href="/app/demo" variant="secondary" size="lg">
                {t("mvp.cta2")}
              </Button>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-mint">
                  {t("mvp.must")}
                </p>
                <ul className="mt-5 space-y-3">
                  {must.map((m) => (
                    <li
                      key={m}
                      className="flex items-start gap-2.5 text-sm text-white/75"
                    >
                      <CheckCircle
                        size={16}
                        className="mt-0.5 shrink-0 text-mint"
                        weight="fill"
                      />
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
                  {t("mvp.later")}
                </p>
                <ul className="mt-5 space-y-3">
                  {later.map((m) => (
                    <li
                      key={m}
                      className="flex items-start gap-2.5 text-sm text-white/45"
                    >
                      <CircleDashed
                        size={16}
                        className="mt-0.5 shrink-0 text-white/30"
                      />
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
