"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CaretRight, Play } from "@phosphor-icons/react";
import { Reveal } from "@/components/ui/Reveal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useT } from "@/lib/i18n";

export function Demo() {
  const t = useT();
  const [active, setActive] = useState(0);
  const roleKeys = [
    "roles.r1t",
    "roles.r2t",
    "ai.badge",
    "roles.r1t",
    "ai.web3Title",
    "roles.r3t",
    "how.h1t",
    "ai.web3Title",
  ];
  const demoSteps = [1, 2, 3, 4, 5, 6, 7, 8].map((id, i) => ({
    id,
    title: t(`demo.step${id}.t`),
    role: t(roleKeys[i]),
    detail: t(`demo.step${id}.d`),
  }));
  const step = demoSteps[active];

  return (
    <section id="demo" className="scroll-mt-28 bg-mint-soft/60 py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <Reveal>
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <Badge tone="forest">{t("demo.badge")}</Badge>
              <h2 className="mt-5 max-w-xl font-display text-3xl font-bold tracking-tight md:text-5xl">
                {t("demo.title")}
              </h2>
            </div>
            <Button href="/app/demo" icon>
              {t("demo.cta")}
            </Button>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal>
            <div className="space-y-2">
              {demoSteps.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActive(i)}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                    active === i
                      ? "border-forest/20 bg-bg-elevated shadow-[0_12px_28px_-18px_rgba(12,61,46,0.4)]"
                      : "border-transparent bg-transparent hover:bg-white/50"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold ${
                      active === i
                        ? "bg-forest text-white"
                        : "bg-black/5 text-ink-muted"
                    }`}
                  >
                    {s.id}
                  </span>
                  <span className="flex-1 text-sm font-medium text-ink">
                    {s.title}
                  </span>
                  <CaretRight
                    size={14}
                    className={
                      active === i ? "text-forest" : "text-ink-muted/40"
                    }
                  />
                </button>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="double-bezel sticky top-28">
              <div className="double-bezel-inner min-h-[340px] p-7 md:p-9">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-forest text-white">
                        <Play size={16} weight="fill" />
                      </span>
                      <span className="rounded-full bg-mint px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-forest-deep">
                        {step.role}
                      </span>
                    </div>
                    <h3 className="mt-6 font-display text-2xl font-bold tracking-tight md:text-3xl">
                      {t("demo.stepLabel")} {step.id}: {step.title}
                    </h3>
                    <p className="mt-4 max-w-lg text-base leading-relaxed text-ink-soft">
                      {step.detail}
                    </p>

                    {step.id === 3 && (
                      <div className="mt-6 rounded-2xl bg-bg-deep p-5 text-white">
                        <p className="font-mono text-xs text-white/50">
                          {t("demo.matchLabel")}
                        </p>
                        <p className="mt-2 font-display text-4xl font-bold">
                          93%
                        </p>
                        <p className="mt-2 text-sm text-white/60">
                          {t("demo.matchDetail")}
                        </p>
                      </div>
                    )}

                    {step.id === 8 && (
                      <div className="mt-6 rounded-2xl border border-forest/20 bg-mint p-5">
                        <p className="font-display text-lg font-bold text-forest-deep">
                          {t("demo.success")}
                        </p>
                        <p className="mt-1 text-sm text-forest">
                          {t("demo.successD")}
                        </p>
                        <p className="mt-3 font-mono text-[11px] text-forest-deep/70">
                          5xK9…m2Pq · Devnet
                        </p>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>

                <div className="mt-8 flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setActive((a) => Math.max(0, a - 1))}
                    disabled={active === 0}
                  >
                    {t("demo.prev")}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() =>
                      setActive((a) => Math.min(demoSteps.length - 1, a + 1))
                    }
                    disabled={active === demoSteps.length - 1}
                  >
                    {t("demo.next")}
                  </Button>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
