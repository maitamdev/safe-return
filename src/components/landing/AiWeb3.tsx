"use client";

import {
  Brain,
  Link as LinkIcon,
  ShieldWarning,
  Scales,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/Badge";
import { Reveal } from "@/components/ui/Reveal";
import { useT } from "@/lib/i18n";

export function AiWeb3() {
  const t = useT();
  const weights = [
    { label: t("ai.w1"), pct: 40, value: "88%" },
    { label: t("ai.w2"), pct: 20, value: "—" },
    { label: t("ai.w3"), pct: 15, value: "90%" },
    { label: t("ai.w4"), pct: 15, value: "95%" },
    { label: t("ai.w5"), pct: 10, value: "100%" },
  ];
  const principles = [
    { icon: Brain, title: t("ai.p1t"), body: t("ai.p1d") },
    { icon: LinkIcon, title: t("ai.p2t"), body: t("ai.p2d") },
    { icon: ShieldWarning, title: t("ai.p3t"), body: t("ai.p3d") },
    { icon: Scales, title: t("ai.p4t"), body: t("ai.p4d") },
  ];

  return (
    <section id="ai" className="scroll-mt-28 py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
          <Reveal>
            <Badge tone="forest">{t("ai.badge")}</Badge>
            <h2 className="mt-5 font-display text-3xl font-bold tracking-tight md:text-5xl">
              {t("ai.title2")}
            </h2>
            <p className="mt-5 text-base leading-relaxed text-ink-soft md:text-lg">
              {t("ai.sub2")}
            </p>

            <div className="mt-10 space-y-4">
              {principles.map((p) => (
                <div key={p.title} className="flex gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mint text-forest-deep">
                    <p.icon size={20} weight="duotone" />
                  </span>
                  <div>
                    <h3 className="font-display text-base font-bold">
                      {p.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                      {p.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="double-bezel">
              <div className="double-bezel-inner overflow-hidden p-6 md:p-8">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
                      {t("ai.score")}
                    </p>
                    <p className="mt-2 font-display text-6xl font-bold tracking-tight text-forest">
                      91%
                    </p>
                  </div>
                  <span className="rounded-full bg-mint px-3 py-1.5 font-mono text-[11px] font-bold text-forest-deep">
                    {t("ai.explainable")}
                  </span>
                </div>

                <div className="mt-8 space-y-4">
                  {weights.map((w) => (
                    <div key={w.label}>
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span className="text-ink-soft">
                          {w.label}{" "}
                          <span className="text-ink-muted">· {w.pct}%</span>
                        </span>
                        <span className="font-mono text-xs font-semibold text-forest">
                          {w.value}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-forest to-emerald-500"
                          style={{
                            width:
                              w.value === "—"
                                ? `${w.pct * 2}%`
                                : w.value,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-bg-deep p-4 text-white">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">
                      {t("ai.pda")}
                    </p>
                    <p className="mt-2 font-mono text-xs text-mint">
                      {t("ai.pdaV")}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-line bg-mint-soft p-4">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-ink-muted">
                      {t("ai.risk")}
                    </p>
                    <p className="mt-2 font-mono text-xs font-semibold text-forest">
                      {t("ai.riskV")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
