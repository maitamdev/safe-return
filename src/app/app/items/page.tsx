"use client";

import Link from "next/link";
import { Plus, QrCode, Hash } from "@phosphor-icons/react";
import { useApp } from "@/lib/store";
import { StatusPill } from "@/components/app/StatusPill";
import { Button } from "@/components/ui/Button";
import { useT } from "@/lib/i18n";

export default function ItemsPage() {
  const t = useT();
  const { items } = useApp();

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
            {t("items.kicker")}
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
            {t("items.title")}
          </h1>
          <p className="mt-2 max-w-lg text-sm text-ink-soft">{t("items.sub")}</p>
        </div>
        <Button href="/app/items/new" icon>
          {t("items.add")}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <article key={item.id} className="double-bezel">
            <div className="double-bezel-inner overflow-hidden">
              <div
                className={`relative h-36 bg-gradient-to-br ${item.imageGradient}`}
              >
                <div className="absolute left-4 top-4">
                  <StatusPill status={item.status} />
                </div>
                {item.hasQr && (
                  <div className="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white/90 text-ink shadow-sm">
                    <QrCode size={20} weight="bold" />
                  </div>
                )}
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-bold">
                      {item.name}
                    </h2>
                    <p className="mt-1 text-xs text-ink-muted">
                      {item.type} · {item.brand} · {item.color}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-ink-soft">
                  {t("items.usual")} {item.area}
                </p>
                <p className="mt-2 text-xs text-ink-muted">
                  {t("items.secret")} {item.secretHint}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
                  <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-muted">
                    <Hash size={12} />
                    {item.id}
                  </span>
                  <span className="font-mono text-[11px] text-forest">
                    {t("items.chain")} {item.chainHash}
                  </span>
                  <span className="ml-auto text-[11px] text-ink-muted">
                    {item.registeredAt}
                  </span>
                </div>
                {item.status === "ACTIVE" && (
                  <div className="mt-4">
                    <Button
                      href={`/app/lost?item=${item.id}`}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      {t("items.reportLost")}
                    </Button>
                  </div>
                )}
                {(item.status === "LOST" ||
                  item.status === "FOUND_CANDIDATE" ||
                  item.status === "RETURN_IN_PROGRESS") && (
                  <div className="mt-4">
                    <Button
                      href="/app/cases"
                      variant="secondary"
                      size="sm"
                      className="w-full"
                    >
                      {t("items.viewCase")}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      {items.length === 0 && (
        <div className="double-bezel">
          <div className="double-bezel-inner flex flex-col items-center px-6 py-16 text-center">
            <Plus size={28} className="text-ink-muted" />
            <p className="mt-4 font-display text-lg font-bold">
              {t("items.empty")}
            </p>
            <p className="mt-2 max-w-sm text-sm text-ink-soft">
              {t("items.emptyD")}
            </p>
            <Button href="/app/items/new" className="mt-6" icon>
              {t("items.first")}
            </Button>
          </div>
        </div>
      )}

      <p className="text-center text-xs text-ink-muted">
        {t("items.tip")}{" "}
        <Link href="/app/items/new" className="font-semibold text-forest">
          {t("items.another")}
        </Link>
      </p>
    </div>
  );
}
