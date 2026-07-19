"use client";

import {
  ChatCircleDots,
  EyeSlash,
  MapPinLine,
  Warning,
  Phone,
  Handshake,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/Badge";
import { Reveal } from "@/components/ui/Reveal";
import { useT } from "@/lib/i18n";

export function Problem() {
  const t = useT();
  const pains = [
    { icon: MapPinLine, title: t("problem.p1t"), body: t("problem.p1d") },
    { icon: Phone, title: t("problem.p2t"), body: t("problem.p2d") },
    { icon: Handshake, title: t("problem.p3t"), body: t("problem.p3d") },
    { icon: Warning, title: t("problem.p4t"), body: t("problem.p4d") },
    { icon: EyeSlash, title: t("problem.p5t"), body: t("problem.p5d") },
    { icon: ChatCircleDots, title: t("problem.p6t"), body: t("problem.p6d") },
  ];

  return (
    <section id="problem" className="scroll-mt-28 py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <Reveal>
          <div className="max-w-2xl">
            <Badge tone="gold">{t("problem.badge")}</Badge>
            <h2 className="mt-5 font-display text-3xl font-bold tracking-tight md:text-5xl">
              {t("problem.title2")}
            </h2>
            <p className="mt-5 text-base leading-relaxed text-ink-soft md:text-lg">
              {t("problem.sub2")}
            </p>
          </div>
        </Reveal>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pains.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.05}>
              <div className="double-bezel h-full">
                <div className="double-bezel-inner flex h-full flex-col p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold-soft text-amber-900">
                    <p.icon size={22} weight="duotone" />
                  </span>
                  <h3 className="mt-5 font-display text-lg font-bold tracking-tight">
                    {p.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                    {p.body}
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
