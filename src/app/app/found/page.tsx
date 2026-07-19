"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, HandHeart, Sparkle } from "@phosphor-icons/react";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/Button";
import { useT } from "@/lib/i18n";

const gradients = [
  "from-zinc-800 via-zinc-700 to-zinc-900",
  "from-stone-200 via-neutral-100 to-stone-300",
  "from-sky-700 via-blue-600 to-indigo-800",
  "from-amber-200 via-yellow-100 to-stone-300",
];

export default function FoundPage() {
  const t = useT();
  const router = useRouter();
  const { reportFound, setRole } = useApp();
  const [itemName, setItemName] = useState("Black Campus Backpack");
  const [location, setLocation] = useState("University Library, Floor 2");
  const [imageGradient, setImageGradient] = useState(gradients[0]);
  const [photoReady, setPhotoReady] = useState(false);
  const [matching, setMatching] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setRole("finder");
    setMatching(true);
    await new Promise((r) => setTimeout(r, 900));
    const c = reportFound({ itemName, location, imageGradient });
    setMatching(false);
    router.push(`/app/cases/${c.id}`);
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
          {t("found.kicker")}
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
          {t("found.title")}
        </h1>
        <p className="mt-2 text-sm text-ink-soft">{t("found.sub")}</p>
      </div>

      <form onSubmit={submit} className="double-bezel">
        <div className="double-bezel-inner space-y-5 p-5 md:p-6">
          <button
            type="button"
            onClick={() => setPhotoReady(true)}
            className={`relative flex h-44 w-full flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition ${
              photoReady
                ? `border-transparent bg-gradient-to-br ${imageGradient}`
                : "border-line bg-white/50 hover:border-forest/30 hover:bg-mint-soft/40"
            }`}
          >
            {photoReady ? (
              <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-ink">
                {t("found.photo")}
              </span>
            ) : (
              <>
                <Camera size={28} className="text-ink-muted" />
                <p className="mt-2 text-sm font-semibold">{t("found.tap")}</p>
                <p className="mt-1 text-xs text-ink-muted">{t("found.tapD")}</p>
              </>
            )}
          </button>

          {photoReady && (
            <div className="flex flex-wrap gap-2">
              {gradients.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setImageGradient(g)}
                  className={`h-9 w-9 rounded-lg bg-gradient-to-br ${g} ${
                    imageGradient === g ? "ring-2 ring-forest ring-offset-2" : ""
                  }`}
                />
              ))}
            </div>
          )}

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
              {t("found.what")}
            </span>
            <input
              required
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className="field"
              placeholder={t("found.whatPh")}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
              {t("found.where")}
            </span>
            <input
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="field"
              placeholder={t("found.wherePh")}
            />
          </label>

          <div className="rounded-2xl border border-forest/15 bg-mint-soft/60 px-4 py-3 text-xs text-forest-deep">
            <p className="flex items-center gap-1.5 font-semibold">
              <Sparkle size={14} weight="fill" />
              {t("found.aiTitle")}
            </p>
            <p className="mt-1 text-ink-soft">{t("found.aiD")}</p>
          </div>

          <Button type="submit" className="w-full" disabled={matching}>
            <span className="inline-flex items-center gap-2">
              <HandHeart size={16} weight="fill" />
              {matching ? t("found.matching") : t("found.submit")}
            </span>
          </Button>
        </div>
      </form>
    </div>
  );
}
