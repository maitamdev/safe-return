"use client";

import Link from "next/link";
import {
  Play,
  ArrowClockwise,
  CaretRight,
  SealCheck,
} from "@phosphor-icons/react";
import { useApp } from "@/lib/store";
import { StatusPill } from "@/components/app/StatusPill";
import { Button } from "@/components/ui/Button";
import { useT } from "@/lib/i18n";
import { WalletOnboarding } from "@/components/wallet/WalletOnboarding";
import { useWallet } from "@solana/wallet-adapter-react";

export default function DemoPage() {
  const t = useT();
  const { connected } = useWallet();
  const {
    demoStep,
    runDemoAdvance,
    setDemoStep,
    cases,
    lastTx,
    lastTxUrl,
    lastIx,
    otp,
    setRole,
    programId,
    chainMode,
  } = useApp();

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

  const main =
    cases.find((c) => c.id === "CASE-2026-0142") ?? cases[0] ?? null;
  const active = Math.min(Math.max(demoStep, 0), demoSteps.length);
  const current = demoSteps[Math.max(active - 1, 0)];

  function reset() {
    setDemoStep(0);
    setRole("owner");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
            {t("demoPage.kicker")}
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">
            {t("demoPage.title")}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-ink-soft">
            {t("demoPage.sub")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              if (demoStep === 0) setRole("owner");
              runDemoAdvance();
            }}
            icon
          >
            {demoStep === 0 ? t("demoPage.start") : t("demoPage.next")}
          </Button>
          <Button variant="secondary" onClick={reset}>
            <span className="inline-flex items-center gap-2">
              <ArrowClockwise size={16} />
              {t("demoPage.reset")}
            </span>
          </Button>
        </div>
      </div>

      {!connected && <WalletOnboarding compact />}

      <div className="rounded-2xl border border-forest/15 bg-mint-soft/50 px-4 py-3 text-sm text-ink-soft">
        <strong className="text-forest-deep">Cách demo cho giám khảo:</strong>{" "}
        Connect Phantom (Devnet) → nạp tiền ảo ở trang{" "}
        <a href="/app/setup" className="font-semibold text-forest underline">
          Bắt đầu
        </a>{" "}
        → bấm <em>Start / Next</em>. Khi app yêu cầu ký tx, Approve trên
        Phantom. Mọi chữ ký đều lên Explorer (tiền ảo).
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="double-bezel">
          <div className="double-bezel-inner p-4 md:p-5">
            <div className="mb-3 flex items-center justify-between px-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                {t("demoPage.steps")}
              </p>
              <p className="font-mono text-xs text-forest">
                {active}/{demoSteps.length}
              </p>
            </div>
            <div className="space-y-1.5">
              {demoSteps.map((s) => {
                const done = active >= s.id;
                const currentStep = active === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setDemoStep(s.id)}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                      currentStep
                        ? "bg-forest text-white"
                        : done
                          ? "bg-mint-soft/80 text-ink"
                          : "bg-transparent text-ink-muted hover:bg-black/[0.03]"
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold ${
                        currentStep
                          ? "bg-white/20"
                          : done
                            ? "bg-forest text-white"
                            : "bg-black/5"
                      }`}
                    >
                      {s.id}
                    </span>
                    <span className="flex-1 text-sm font-medium leading-snug">
                      {s.title}
                    </span>
                    <CaretRight size={14} className="opacity-50" />
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <div className="space-y-6">
          <section className="double-bezel">
            <div className="double-bezel-inner p-6 md:p-8">
              {active === 0 ? (
                <div className="py-8 text-center">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-mint text-forest">
                    <Play size={24} weight="fill" />
                  </span>
                  <h2 className="mt-5 font-display text-2xl font-bold">
                    {t("demoPage.ready")}
                  </h2>
                  <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
                    {t("demoPage.readyD")}
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-forest px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
                      {t("demoPage.step")} {current.id}
                    </span>
                    <span className="rounded-full bg-black/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
                      {current.role}
                    </span>
                  </div>
                  <h2 className="mt-4 font-display text-2xl font-bold tracking-tight">
                    {current.title}
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                    {current.detail}
                  </p>

                  {active >= 6 && otp && (
                    <div className="mt-6 rounded-2xl border border-forest/15 bg-mint-soft/70 px-4 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                        {t("demoPage.otp")}
                      </p>
                      <p className="mt-1 font-mono text-2xl font-bold tracking-[0.25em] text-forest">
                        {otp}
                      </p>
                    </div>
                  )}

                  {active >= 8 && lastTx && (
                    <div className="mt-6 rounded-2xl border border-forest/20 bg-white/70 px-4 py-4">
                      <p className="flex items-center gap-2 font-semibold text-forest">
                        <SealCheck size={18} weight="fill" />
                        {t("demoPage.released")}
                      </p>
                      {lastIx && (
                        <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-solana">
                          {lastIx} · {chainMode}
                        </p>
                      )}
                      <p className="mt-1 break-all font-mono text-[11px] text-ink-muted">
                        {lastTx}
                      </p>
                      <p className="mt-1 break-all font-mono text-[10px] text-ink-muted/70">
                        program {programId}
                      </p>
                      <a
                        href={lastTxUrl || "https://explorer.solana.com/?cluster=devnet"}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-xs font-semibold text-solana hover:underline"
                      >
                        {t("demoPage.explorer")}
                      </a>
                    </div>
                  )}

                  <div className="mt-8 flex flex-wrap gap-2">
                    {active < demoSteps.length && (
                      <Button onClick={runDemoAdvance}>
                        {t("demoPage.continue")}
                      </Button>
                    )}
                    {main && (
                      <Button
                        href={`/app/cases/${main.id}`}
                        variant="secondary"
                      >
                        {t("demoPage.board")}
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          </section>

          {main && (
            <section className="double-bezel">
              <div className="double-bezel-inner flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                <div
                  className={`h-16 w-16 shrink-0 rounded-2xl bg-gradient-to-br ${main.imageGradient}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-2">
                    <StatusPill status={main.status} />
                    <StatusPill status={main.escrow} />
                  </div>
                  <p className="mt-2 font-display font-bold">{main.itemName}</p>
                  <p className="font-mono text-[11px] text-ink-muted">
                    {main.id}
                    {main.matchScore != null
                      ? ` · AI ${main.matchScore}%`
                      : ""}
                  </p>
                </div>
                <Link
                  href={`/app/cases/${main.id}`}
                  className="text-sm font-semibold text-forest hover:underline"
                >
                  {t("demoPage.inspect")}
                </Link>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
