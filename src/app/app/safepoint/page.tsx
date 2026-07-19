"use client";

import { useState } from "react";
import {
  Buildings,
  Package,
  Clock,
  CheckCircle,
} from "@phosphor-icons/react";
import { safePoints } from "@/lib/data";
import { useApp } from "@/lib/store";
import { StatusPill } from "@/components/app/StatusPill";
import { Button } from "@/components/ui/Button";
import { useT } from "@/lib/i18n";

export default function SafePointPage() {
  const t = useT();
  const { cases, setRole, confirmHandover, otp, startHandover } = useApp();
  const holding = cases.filter((c) => c.status === "HANDOVER_PENDING");
  const [scanCode, setScanCode] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function receiveDropoff() {
    setRole("safepoint");
    const target =
      cases.find(
        (c) =>
          c.status === "MATCH_ACCEPTED" ||
          (c.escrow === "FUNDED" && c.status !== "RETURNED")
      ) ?? cases.find((c) => c.id === "CASE-2026-0142");
    if (!target) {
      setMessage(t("sp.msgNoDrop"));
      return;
    }
    if (target.status !== "HANDOVER_PENDING") {
      await startHandover(target.id, safePoints[0].name);
    }
    setScanCode(target.id);
    setMessage(t("sp.msgRecv", { name: target.itemName, id: target.id }));
  }

  async function releaseItem() {
    setRole("safepoint");
    const target =
      holding.find((c) => c.id === scanCode) ?? holding[0] ?? null;
    if (!target) {
      setMessage(t("sp.msgNoHold"));
      return;
    }
    const ok = await confirmHandover(target.id, otpInput.trim() || otp || "");
    setMessage(
      ok ? t("sp.msgOk", { name: target.itemName }) : t("sp.msgBad")
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
          {t("sp.kicker")}
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
          {t("sp.title")}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-ink-soft">{t("sp.sub")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {safePoints.map((sp) => (
          <div key={sp.id} className="double-bezel">
            <div className="double-bezel-inner p-4">
              <div className="flex items-center gap-2">
                <Buildings size={18} className="text-forest" />
                <span className="rounded-full bg-mint px-2 py-0.5 text-[10px] font-bold uppercase text-forest-deep">
                  {sp.status}
                </span>
              </div>
              <p className="mt-3 font-display text-sm font-bold leading-snug">
                {sp.name}
              </p>
              <p className="mt-2 flex items-center gap-1 text-xs text-ink-muted">
                <Clock size={12} />
                {sp.hours}
              </p>
              <p className="mt-3 font-mono text-lg font-bold">{sp.holding}</p>
              <p className="text-[11px] text-ink-muted">{t("sp.holdingDemo")}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="double-bezel">
          <div className="double-bezel-inner space-y-4 p-5 md:p-6">
            <h2 className="font-display text-lg font-bold">{t("sp.console")}</h2>
            <p className="text-sm text-ink-soft">{t("sp.consoleD")}</p>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
                {t("sp.code")}
              </span>
              <input
                value={scanCode}
                onChange={(e) => setScanCode(e.target.value)}
                className="field font-mono"
                placeholder="CASE-2026-0142"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
                {t("sp.otp")}
              </span>
              <input
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value)}
                className="field font-mono tracking-widest"
                placeholder={otp ?? t("case.otpPh")}
                maxLength={6}
              />
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                className="flex-1"
                onClick={() => void receiveDropoff()}
              >
                {t("sp.receive")}
              </Button>
              <Button
                className="flex-1"
                variant="secondary"
                onClick={() => void releaseItem()}
              >
                {t("sp.release")}
              </Button>
            </div>
            {message && (
              <p className="flex items-start gap-2 rounded-2xl bg-mint-soft/80 px-4 py-3 text-sm text-forest-deep">
                <CheckCircle size={16} weight="fill" className="mt-0.5 shrink-0" />
                {message}
              </p>
            )}
            {otp && (
              <p className="font-mono text-xs text-ink-muted">
                {t("sp.activeOtp")}{" "}
                <strong className="text-forest">{otp}</strong>
              </p>
            )}
          </div>
        </section>

        <section className="double-bezel">
          <div className="double-bezel-inner p-5 md:p-6">
            <div className="mb-4 flex items-center gap-2">
              <Package size={18} className="text-forest" />
              <h2 className="font-display text-lg font-bold">
                {t("sp.holding")}
              </h2>
            </div>
            <div className="space-y-3">
              {holding.length === 0 && (
                <p className="text-sm text-ink-muted">{t("sp.holdingEmpty")}</p>
              )}
              {holding.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-white/50 p-3"
                >
                  <div
                    className={`h-12 w-12 shrink-0 rounded-xl bg-gradient-to-br ${c.imageGradient}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {c.itemName}
                    </p>
                    <p className="font-mono text-[11px] text-ink-muted">
                      {c.id}
                    </p>
                    <p className="mt-1 text-xs text-ink-soft">
                      {c.safePoint ?? t("sp.unassigned")}
                    </p>
                  </div>
                  <StatusPill status={c.status} />
                </div>
              ))}
            </div>
            <Button
              href="/app/cases"
              variant="outline"
              size="sm"
              className="mt-5 w-full"
            >
              {t("sp.openCases")}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
