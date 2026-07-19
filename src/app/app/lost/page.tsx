"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/Button";
import { useT } from "@/lib/i18n";

function LostForm() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const { items, reportLost } = useApp();
  const activeItems = useMemo(
    () => items.filter((i) => i.status === "ACTIVE" || i.status === "LOST"),
    [items]
  );
  const preselect = params.get("item") ?? activeItems[0]?.id ?? "";

  const [itemId, setItemId] = useState(preselect);
  const [location, setLocation] = useState("University Library, Floor 2");
  const [reward, setReward] = useState(5);
  const [visibility, setVisibility] = useState("campus");
  const [notes, setNotes] = useState("");

  const visLabel = {
    campus: t("lost.vis.campus"),
    public: t("lost.vis.public"),
    trusted: t("lost.vis.trusted"),
  } as const;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!itemId) return;
    const c = reportLost({
      itemId,
      location,
      reward,
      visibility: visLabel[visibility as keyof typeof visLabel] ?? visibility,
    });
    router.push(`/app/cases/${c.id}`);
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
          {t("lost.kicker")}
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
          {t("lost.title")}
        </h1>
        <p className="mt-2 text-sm text-ink-soft">{t("lost.sub")}</p>
      </div>

      <form onSubmit={submit} className="double-bezel">
        <div className="double-bezel-inner space-y-5 p-5 md:p-6">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
              {t("lost.item")}
            </span>
            <select
              required
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              className="field"
            >
              {activeItems.length === 0 && (
                <option value="">{t("lost.noItems")}</option>
              )}
              {activeItems.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({t(`status.${i.status}`)})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
              {t("lost.location")}
            </span>
            <input
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="field"
              placeholder={t("lost.locationPh")}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
                {t("lost.reward")}
              </span>
              <input
                type="number"
                min={0}
                max={100}
                value={reward}
                onChange={(e) => setReward(Number(e.target.value))}
                className="field"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
                {t("lost.visibility")}
              </span>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
                className="field"
              >
                <option value="campus">{t("lost.vis.campus")}</option>
                <option value="public">{t("lost.vis.public")}</option>
                <option value="trusted">{t("lost.vis.trusted")}</option>
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
              {t("lost.notes")}
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="field resize-none"
              placeholder={t("lost.notesPh")}
            />
          </label>

          <div className="rounded-2xl border border-gold/20 bg-gold-soft/40 px-4 py-3 text-xs text-amber-950">
            {t("lost.note")}
          </div>

          <Button type="submit" className="w-full" disabled={!itemId}>
            <span className="inline-flex items-center gap-2">
              <MagnifyingGlass size={16} weight="bold" />
              {t("lost.submit")}
            </span>
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function LostPage() {
  const t = useT();
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-xl py-20 text-center text-sm text-ink-muted">
          {t("loading")}
        </div>
      }
    >
      <LostForm />
    </Suspense>
  );
}
