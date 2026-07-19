"use client";

import Link from "next/link";
import {
  Package,
  MagnifyingGlass,
  HandHeart,
  QrCode,
  ArrowRight,
  Sparkle,
  CurrencyCircleDollar,
} from "@phosphor-icons/react";
import { useApp } from "@/lib/store";
import { StatusPill } from "@/components/app/StatusPill";
import { Button } from "@/components/ui/Button";
import { useT } from "@/lib/i18n";

export default function AppHomePage() {
  const t = useT();
  const { items, cases, notifications } = useApp();
  const activeCases = cases.filter((c) => c.status !== "RETURNED");
  const lostItems = items.filter((i) => i.status === "LOST");

  const actions = [
    {
      href: "/app/demo",
      label: t("home.a4"),
      desc: t("home.a4d"),
      icon: Sparkle,
      tone: "bg-bg-deep text-white",
    },
    {
      href: "/app/lost",
      label: t("home.a2"),
      desc: t("home.a2d"),
      icon: MagnifyingGlass,
      tone: "bg-gold-soft text-amber-900",
    },
    {
      href: "/app/found",
      label: t("home.a3"),
      desc: t("home.a3d"),
      icon: HandHeart,
      tone: "bg-mint text-forest-deep",
    },
    {
      href: "/app/items/new",
      label: t("home.a1"),
      desc: t("home.a1d"),
      icon: QrCode,
      tone: "bg-forest text-white",
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
            {t("home.kicker")}
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">
            {t("home.title")}
          </h1>
          <p className="mt-2 max-w-lg text-sm text-ink-soft">{t("home.sub")}</p>
        </div>
        <Button href="/app/items" variant="secondary" icon>
          {t("home.viewItems")}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: t("home.statItems"), value: items.length },
          { label: t("home.statLost"), value: lostItems.length },
          { label: t("home.statCases"), value: activeCases.length },
          {
            label: t("home.statAlerts"),
            value: notifications.filter((n) => n.unread).length,
          },
        ].map((s) => (
          <div key={s.label} className="double-bezel">
            <div className="double-bezel-inner px-5 py-4">
              <p className="font-display text-2xl font-bold">{s.value}</p>
              <p className="mt-1 text-xs text-ink-muted">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="group double-bezel transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5"
          >
            <div className="double-bezel-inner flex h-full flex-col p-5">
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-2xl ${a.tone}`}
              >
                <a.icon size={22} weight="duotone" />
              </span>
              <p className="mt-4 font-display text-base font-bold">{a.label}</p>
              <p className="mt-1 text-xs text-ink-muted">{a.desc}</p>
              <ArrowRight
                size={16}
                className="mt-4 text-forest transition-transform duration-500 group-hover:translate-x-1"
              />
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="double-bezel">
          <div className="double-bezel-inner p-5 md:p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">
                {t("home.activeCases")}
              </h2>
              <Link
                href="/app/cases"
                className="text-xs font-semibold text-forest hover:underline"
              >
                {t("home.seeAll")}
              </Link>
            </div>
            <div className="space-y-3">
              {cases.slice(0, 3).map((c) => (
                <Link
                  key={c.id}
                  href={`/app/cases/${c.id}`}
                  className="flex items-center gap-4 rounded-2xl border border-line bg-white/50 p-3.5 transition hover:bg-mint-soft/40"
                >
                  <div
                    className={`h-14 w-14 shrink-0 rounded-xl bg-gradient-to-br ${c.imageGradient}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold">
                        {c.itemName}
                      </p>
                      <StatusPill status={c.status} />
                    </div>
                    <p className="mt-1 truncate text-xs text-ink-muted">
                      {c.id} · {c.location}
                    </p>
                    {c.matchScore != null && (
                      <p className="mt-1 font-mono text-[11px] text-forest">
                        {t("home.aiMatch")} {c.matchScore}%
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="flex items-center gap-1 font-mono text-xs font-semibold text-ink">
                      <CurrencyCircleDollar size={14} className="text-gold" />
                      {c.reward}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-wider text-ink-muted">
                      {t("usdc")}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="double-bezel">
          <div className="double-bezel-inner p-5 md:p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">
                {t("home.notifs")}
              </h2>
              <Package size={18} className="text-ink-muted" />
            </div>
            <div className="space-y-3">
              {notifications.slice(0, 4).map((n) => (
                <div
                  key={n.id}
                  className={`rounded-2xl border px-4 py-3 ${
                    n.unread
                      ? "border-forest/15 bg-mint-soft/50"
                      : "border-line bg-white/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold">{n.title}</p>
                    {n.unread && (
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-forest" />
                    )}
                  </div>
                  <p className="mt-1 text-xs text-ink-soft">{n.body}</p>
                  <p className="mt-2 font-mono text-[10px] text-ink-muted">
                    {n.time}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
