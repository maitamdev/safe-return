"use client";

import { QrCode, Image, Buildings, SealCheck } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/Badge";
import { Reveal } from "@/components/ui/Reveal";
import { useT } from "@/lib/i18n";

export function HowItWorks() {
  const t = useT();
  const paths = [
    {
      icon: QrCode,
      tag: t("how.m1tag"),
      title: t("how.m1t"),
      steps: [t("how.m1s1"), t("how.m1s2"), t("how.m1s3"), t("how.m1s4")],
      accent: "bg-forest text-white",
    },
    {
      icon: Image,
      tag: t("how.m2tag"),
      title: t("how.m2t"),
      steps: [t("how.m2s1"), t("how.m2s2"), t("how.m2s3"), t("how.m2s4")],
      accent: "bg-gold-soft text-amber-900",
    },
  ];
  const handover = [
    { icon: SealCheck, title: t("how.h1t"), body: t("how.h1d") },
    { icon: Buildings, title: t("how.h2t"), body: t("how.h2d") },
  ];

  return (
    <section id="how" className="scroll-mt-28 bg-bg-deep py-24 text-white md:py-32">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <Reveal>
          <Badge tone="mint">{t("how.badge")}</Badge>
          <h2 className="mt-5 max-w-2xl font-display text-3xl font-bold tracking-tight md:text-5xl">
            {t("how.title2")}
          </h2>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/60 md:text-lg">
            {t("how.sub2")}
          </p>
        </Reveal>

        <div className="mt-14 grid gap-5 lg:grid-cols-2">
          {paths.map((path, i) => (
            <Reveal key={path.title} delay={i * 0.08}>
              <div className="h-full rounded-[2rem] border border-white/10 bg-white/[0.04] p-1.5">
                <div className="h-full rounded-[calc(2rem-0.375rem)] border border-white/10 bg-white/[0.03] p-7 md:p-8">
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl ${path.accent}`}
                    >
                      <path.icon size={24} weight="duotone" />
                    </span>
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/40">
                        {path.tag}
                      </p>
                      <h3 className="font-display text-xl font-bold">
                        {path.title}
                      </h3>
                    </div>
                  </div>
                  <ol className="mt-8 space-y-4">
                    {path.steps.map((step, idx) => (
                      <li key={step} className="flex gap-3 text-sm text-white/70">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 font-mono text-[11px] font-bold text-mint">
                          {idx + 1}
                        </span>
                        <span className="leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {handover.map((h, i) => (
            <Reveal key={h.title} delay={0.12 + i * 0.06}>
              <div className="flex gap-4 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-mint text-forest-deep">
                  <h.icon size={22} weight="duotone" />
                </span>
                <div>
                  <h3 className="font-display text-lg font-bold">{h.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/55">
                    {h.body}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
