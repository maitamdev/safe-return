"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, QrCode } from "@phosphor-icons/react";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/Button";
import { useT } from "@/lib/i18n";

const gradients = [
  "from-zinc-800 via-zinc-700 to-zinc-900",
  "from-sky-700 via-blue-600 to-indigo-800",
  "from-stone-200 via-neutral-100 to-stone-300",
  "from-amber-200 via-yellow-100 to-stone-300",
  "from-rose-300 via-pink-200 to-fuchsia-300",
  "from-emerald-700 via-teal-600 to-cyan-800",
];

const types = [
  "Backpack",
  "ID Card",
  "Electronics",
  "Keys",
  "Wallet",
  "Laptop",
  "Other",
];

export default function NewItemPage() {
  const t = useT();
  const router = useRouter();
  const { addItem } = useApp();
  const [done, setDone] = useState<{ id: string; hash: string } | null>(null);
  const [form, setForm] = useState({
    name: "",
    type: "Backpack",
    brand: "",
    color: "",
    area: "Campus North",
    secretHint: "",
    hasQr: true,
    imageGradient: gradients[0],
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    const item = addItem({
      name: form.name.trim(),
      type: form.type,
      brand: form.brand.trim() || "Generic",
      color: form.color.trim() || "Unspecified",
      area: form.area.trim(),
      secretHint: form.secretHint.trim() || "No secret hint set",
      hasQr: form.hasQr,
      imageGradient: form.imageGradient,
    });
    setDone({ id: item.id, hash: item.chainHash });
  }

  if (done) {
    return (
      <div className="mx-auto max-w-lg">
        <div className="double-bezel">
          <div className="double-bezel-inner px-6 py-10 text-center md:px-10">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-mint text-forest">
              <CheckCircle size={28} weight="fill" />
            </span>
            <h1 className="mt-5 font-display text-2xl font-bold">
              {t("newItem.done")}
            </h1>
            <p className="mt-2 text-sm text-ink-soft">{t("newItem.doneD")}</p>
            <div className="mt-6 space-y-2 rounded-2xl border border-line bg-mint-soft/50 px-4 py-4 text-left">
              <p className="font-mono text-xs text-ink-muted">
                {t("newItem.id")}
              </p>
              <p className="font-mono text-sm font-semibold">{done.id}</p>
              <p className="mt-3 font-mono text-xs text-ink-muted">
                {t("newItem.hash")}
              </p>
              <p className="font-mono text-sm font-semibold text-forest">
                {done.hash}
              </p>
            </div>
            {form.hasQr && (
              <div className="mt-6 flex flex-col items-center gap-2">
                <div className="flex h-28 w-28 items-center justify-center rounded-2xl border-2 border-dashed border-forest/30 bg-white">
                  <QrCode size={64} weight="duotone" className="text-forest" />
                </div>
                <p className="text-xs text-ink-muted">{t("newItem.sticker")}</p>
              </div>
            )}
            <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button href="/app/items">{t("newItem.back")}</Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setDone(null);
                  setForm((f) => ({ ...f, name: "", secretHint: "" }));
                }}
              >
                {t("newItem.more")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
          {t("newItem.kicker")}
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
          {t("newItem.title")}
        </h1>
        <p className="mt-2 text-sm text-ink-soft">{t("newItem.sub")}</p>
      </div>

      <form onSubmit={submit} className="double-bezel">
        <div className="double-bezel-inner space-y-5 p-5 md:p-6">
          <Field label={t("newItem.name")}>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t("newItem.namePh")}
              className="field"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("newItem.type")}>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="field"
              >
                {types.map((ty) => (
                  <option key={ty}>{ty}</option>
                ))}
              </select>
            </Field>
            <Field label={t("newItem.brand")}>
              <input
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                placeholder={t("newItem.brand")}
                className="field"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("newItem.color")}>
              <input
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                placeholder={t("newItem.colorPh")}
                className="field"
              />
            </Field>
            <Field label={t("newItem.area")}>
              <input
                value={form.area}
                onChange={(e) => setForm({ ...form, area: e.target.value })}
                placeholder={t("newItem.areaPh")}
                className="field"
              />
            </Field>
          </div>

          <Field label={t("newItem.secret")}>
            <textarea
              value={form.secretHint}
              onChange={(e) => setForm({ ...form, secretHint: e.target.value })}
              placeholder={t("newItem.secretPh")}
              rows={3}
              className="field resize-none"
            />
          </Field>

          <Field label={t("newItem.cardColor")}>
            <div className="flex flex-wrap gap-2">
              {gradients.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setForm({ ...form, imageGradient: g })}
                  className={`h-10 w-10 rounded-xl bg-gradient-to-br ${g} ring-offset-2 ${
                    form.imageGradient === g
                      ? "ring-2 ring-forest"
                      : "ring-1 ring-black/10"
                  }`}
                  aria-label="Pick gradient"
                />
              ))}
            </div>
          </Field>

          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-line bg-white/50 px-4 py-3">
            <input
              type="checkbox"
              checked={form.hasQr}
              onChange={(e) => setForm({ ...form, hasQr: e.target.checked })}
              className="h-4 w-4 accent-forest"
            />
            <div>
              <p className="text-sm font-semibold">{t("newItem.qr")}</p>
              <p className="text-xs text-ink-muted">{t("newItem.qrD")}</p>
            </div>
          </label>

          <div className="flex flex-col gap-2 pt-2 sm:flex-row">
            <Button type="submit" className="flex-1">
              {t("newItem.submit")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push("/app/items")}
            >
              {t("newItem.cancel")}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
