"use client";

import Link from "next/link";
import { CurrencyCircleDollar, ArrowRight } from "@phosphor-icons/react";
import { useApp } from "@/lib/store";
import { StatusPill } from "@/components/app/StatusPill";
import { Button } from "@/components/ui/Button";
import { useT } from "@/lib/i18n";

export default function CasesPage() {
  const t = useT();
  const { cases } = useApp();

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
            {t("cases.kicker")}
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
            {t("cases.title")}
          </h1>
          <p className="mt-2 max-w-lg text-sm text-ink-soft">{t("cases.sub")}</p>
        </div>
        <div className="flex gap-2">
          <Button href="/app/lost" variant="secondary" size="sm">
            {t("cases.reportLost")}
          </Button>
          <Button href="/app/found" size="sm">
            {t("cases.reportFound")}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {cases.map((c) => (
          <Link
            key={c.id}
            href={`/app/cases/${c.id}`}
            className="group double-bezel block transition-transform duration-500 hover:-translate-y-0.5"
          >
            <div className="double-bezel-inner flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
              <div
                className={`h-20 w-full shrink-0 rounded-2xl bg-gradient-to-br sm:h-16 sm:w-16 ${c.imageGradient}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-base font-bold">
                    {c.itemName}
                  </h2>
                  <StatusPill status={c.status} />
                  <StatusPill status={c.escrow} />
                </div>
                <p className="mt-1 font-mono text-[11px] text-ink-muted">
                  {c.id}
                </p>
                <p className="mt-2 truncate text-sm text-ink-soft">
                  {c.location} · {c.lostAt}
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  {t("cases.owner")} {c.owner}
                  {c.finder ? ` · ${t("cases.finder")} ${c.finder}` : ""}
                  {c.matchScore != null ? ` · AI ${c.matchScore}%` : ""}
                </p>
              </div>
              <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                <div className="text-right">
                  <p className="flex items-center gap-1 font-mono text-sm font-bold">
                    <CurrencyCircleDollar size={16} className="text-gold" />
                    {c.reward} {t("usdc")}
                  </p>
                  <p className="mt-1 text-[10px] uppercase tracking-wider text-ink-muted">
                    {c.visibility}
                  </p>
                </div>
                <ArrowRight
                  size={18}
                  className="text-forest transition-transform group-hover:translate-x-1"
                />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {cases.length === 0 && (
        <div className="double-bezel">
          <div className="double-bezel-inner py-16 text-center">
            <p className="font-display text-lg font-bold">{t("cases.empty")}</p>
            <p className="mt-2 text-sm text-ink-soft">{t("cases.emptyD")}</p>
          </div>
        </div>
      )}
    </div>
  );
}
