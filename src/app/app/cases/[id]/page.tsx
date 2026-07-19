"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle,
  CurrencyCircleDollar,
  Key,
  Lock,
  SealCheck,
  Sparkle,
  Warning,
} from "@phosphor-icons/react";
import { useApp } from "@/lib/store";
import { safePoints } from "@/lib/data";
import { StatusPill } from "@/components/app/StatusPill";
import { Button } from "@/components/ui/Button";
import { useT } from "@/lib/i18n";

export default function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = useT();
  const { id } = use(params);
  const {
    cases,
    items,
    role,
    fundEscrow,
    acceptMatch,
    startHandover,
    confirmHandover,
    lastTx,
    lastTxUrl,
    lastIx,
    otp,
    programId,
    chainMode,
    getEscrowPda,
  } = useApp();

  const c = cases.find((x) => x.id === id);
  const item = items.find((i) => i.id === c?.itemId);
  const [secretOk, setSecretOk] = useState(false);
  const [safePoint, setSafePoint] = useState(safePoints[0].name);
  const [otpInput, setOtpInput] = useState("");
  const [otpError, setOtpError] = useState(false);
  const [issuedOtp, setIssuedOtp] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const steps = useMemo(() => {
    if (!c) return [];
    const order = [
      "OPEN",
      "CLAIMED",
      "MATCH_SUGGESTED",
      "MATCH_ACCEPTED",
      "HANDOVER_PENDING",
      "RETURNED",
    ];
    const idx = Math.max(0, order.indexOf(c.status));
    return [
      { label: t("case.t1"), done: idx >= 0 },
      { label: t("case.t2"), done: idx >= 1 || !!c.finder },
      { label: t("case.t3"), done: idx >= 2 || (c.matchScore ?? 0) > 0 },
      {
        label: t("case.t4"),
        done: ["FUNDED", "LOCKED", "RELEASED"].includes(c.escrow),
      },
      { label: t("case.t5"), done: idx >= 4 },
      { label: t("case.t6"), done: c.status === "RETURNED" },
    ];
  }, [c, t]);

  if (!c) {
    return (
      <div className="mx-auto max-w-lg py-20 text-center">
        <p className="font-display text-xl font-bold">{t("case.notFound")}</p>
        <Button href="/app/cases" className="mt-6">
          {t("case.backBtn")}
        </Button>
      </div>
    );
  }

  async function onStartHandover() {
    setBusy(true);
    try {
      const code = await startHandover(c!.id, safePoint);
      setIssuedOtp(code);
    } finally {
      setBusy(false);
    }
  }

  async function onConfirm() {
    setBusy(true);
    try {
      const ok = await confirmHandover(
        c!.id,
        otpInput.trim() || issuedOtp || otp || ""
      );
      setOtpError(!ok);
    } finally {
      setBusy(false);
    }
  }

  async function onFund() {
    setBusy(true);
    try {
      await fundEscrow(c!.id);
    } finally {
      setBusy(false);
    }
  }

  async function onAccept() {
    setBusy(true);
    try {
      await acceptMatch(c!.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/app/cases"
        className="inline-flex items-center gap-2 text-sm font-medium text-ink-soft hover:text-ink"
      >
        <ArrowLeft size={16} />
        {t("case.back")}
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <section className="double-bezel">
            <div className="double-bezel-inner overflow-hidden">
              <div
                className={`h-40 bg-gradient-to-br md:h-48 ${c.imageGradient}`}
              />
              <div className="p-5 md:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={c.status} />
                  <StatusPill status={c.escrow} />
                  <span className="font-mono text-[11px] text-ink-muted">
                    {c.id}
                  </span>
                </div>
                <h1 className="mt-3 font-display text-2xl font-bold md:text-3xl">
                  {c.itemName}
                </h1>
                <p className="mt-2 text-sm text-ink-soft">
                  {c.location} · {t("case.reported")} {c.lostAt}
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <Meta label={t("case.owner")} value={c.owner} />
                  <Meta label={t("case.finder")} value={c.finder ?? "—"} />
                  <Meta
                    label={t("case.reward")}
                    value={`${c.reward} ${t("mockUsdc")}`}
                    icon
                  />
                </div>
                {c.safePoint && (
                  <p className="mt-4 rounded-2xl bg-mint-soft/70 px-4 py-3 text-sm">
                    {t("case.safepoint")} <strong>{c.safePoint}</strong>
                  </p>
                )}
              </div>
            </div>
          </section>

          {c.matchScore != null && (
            <section className="double-bezel">
              <div className="double-bezel-inner p-5 md:p-6">
                <div className="flex items-center gap-2">
                  <Sparkle size={20} weight="fill" className="text-forest" />
                  <h2 className="font-display text-lg font-bold">
                    {t("case.ai")} · {c.matchScore}%
                  </h2>
                </div>
                <p className="mt-2 text-xs text-ink-muted">{t("case.aiNote")}</p>
                <ul className="mt-4 space-y-2">
                  {(c.matchReasons ?? []).map((r) => (
                    <li
                      key={r}
                      className="flex items-start gap-2 text-sm text-ink-soft"
                    >
                      <CheckCircle
                        size={16}
                        weight="fill"
                        className="mt-0.5 shrink-0 text-forest"
                      />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {item && (
            <section className="double-bezel">
              <div className="double-bezel-inner p-5 md:p-6">
                <div className="flex items-center gap-2">
                  <Key size={18} className="text-gold" />
                  <h2 className="font-display text-lg font-bold">
                    {t("case.secret")}
                  </h2>
                </div>
                <p className="mt-2 text-sm text-ink-soft">
                  {t("case.secretOwner")}{" "}
                  <em className="text-ink">{item.secretHint}</em>
                </p>
                <Button
                  className="mt-4"
                  variant={secretOk ? "secondary" : "primary"}
                  size="sm"
                  onClick={() => setSecretOk(true)}
                  disabled={secretOk}
                >
                  {secretOk ? t("case.secretOk") : t("case.secretAsk")}
                </Button>
              </div>
            </section>
          )}
        </div>

        <div className="space-y-6">
          <section className="double-bezel">
            <div className="double-bezel-inner p-5 md:p-6">
              <h2 className="font-display text-lg font-bold">
                {t("case.timeline")}
              </h2>
              <ol className="mt-4 space-y-3">
                {steps.map((s, i) => (
                  <li key={s.label} className="flex items-center gap-3">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ${
                        s.done
                          ? "bg-forest text-white"
                          : "bg-black/5 text-ink-muted"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span
                      className={`text-sm ${
                        s.done ? "font-semibold text-ink" : "text-ink-muted"
                      }`}
                    >
                      {s.label}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section className="double-bezel">
            <div className="double-bezel-inner space-y-4 p-5 md:p-6">
              <div className="flex items-center gap-2">
                <Lock size={18} className="text-solana" />
                <h2 className="font-display text-lg font-bold">
                  {t("case.actions")}
                </h2>
              </div>
              <p className="text-xs text-ink-muted">
                {t("case.acting")}{" "}
                <strong className="text-ink">{t(`app.role.${role}`)}</strong>{" "}
                {t("case.switch")}
              </p>

              {c.status === "MATCH_SUGGESTED" && (
                <div className="space-y-2">
                  {(role === "owner" || role === "finder") && (
                    <Button
                      className="w-full"
                      onClick={() => void onAccept()}
                      disabled={busy || (!secretOk && !!item)}
                    >
                      {t("case.accept")}
                    </Button>
                  )}
                  {role === "owner" && c.escrow === "UNFUNDED" && (
                    <Button
                      className="w-full"
                      variant="dark"
                      onClick={() => void onFund()}
                      disabled={busy}
                    >
                      <span className="inline-flex items-center gap-2">
                        <CurrencyCircleDollar size={16} />
                        {t("case.fund")} ({c.reward} {t("usdc")})
                      </span>
                    </Button>
                  )}
                  {!secretOk && item && (
                    <p className="flex items-start gap-1.5 text-xs text-amber-800">
                      <Warning size={14} className="mt-0.5 shrink-0" />
                      {t("case.secretWarn")}
                    </p>
                  )}
                </div>
              )}

              {(c.status === "MATCH_ACCEPTED" ||
                (c.status === "OPEN" && c.escrow === "FUNDED")) && (
                <div className="space-y-3">
                  {role === "owner" && c.escrow === "UNFUNDED" && (
                    <Button
                      className="w-full"
                      variant="dark"
                      onClick={() => void onFund()}
                      disabled={busy}
                    >
                      {t("case.fund")} ({c.reward} {t("usdc")})
                    </Button>
                  )}
                  {(role === "finder" || role === "safepoint") && (
                    <>
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
                          {t("case.dropoff")}
                        </span>
                        <select
                          value={safePoint}
                          onChange={(e) => setSafePoint(e.target.value)}
                          className="field"
                        >
                          {safePoints.map((sp) => (
                            <option key={sp.id}>{sp.name}</option>
                          ))}
                        </select>
                      </label>
                      <Button
                        className="w-full"
                        onClick={() => void onStartHandover()}
                        disabled={busy}
                      >
                        {t("case.startHandover")}
                      </Button>
                    </>
                  )}
                </div>
              )}

              {c.status === "HANDOVER_PENDING" && (
                <div className="space-y-3">
                  {(issuedOtp || otp) && (
                    <div className="rounded-2xl border border-forest/15 bg-mint-soft/70 px-4 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                        {t("case.otpDemo")}
                      </p>
                      <p className="mt-1 font-mono text-2xl font-bold tracking-[0.2em] text-forest">
                        {issuedOtp || otp}
                      </p>
                    </div>
                  )}
                  {(role === "owner" || role === "safepoint") && (
                    <>
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
                          {t("case.otpEnter")}
                        </span>
                        <input
                          value={otpInput}
                          onChange={(e) => {
                            setOtpInput(e.target.value);
                            setOtpError(false);
                          }}
                          className="field font-mono tracking-widest"
                          placeholder={t("case.otpPh")}
                          maxLength={6}
                        />
                      </label>
                      {otpError && (
                        <p className="text-xs text-coral">{t("case.otpBad")}</p>
                      )}
                      <Button
                        className="w-full"
                        onClick={() => void onConfirm()}
                        disabled={busy}
                      >
                        {t("case.confirm")}
                      </Button>
                    </>
                  )}
                  {role === "finder" && (
                    <p className="text-sm text-ink-soft">{t("case.waitingOtp")}</p>
                  )}
                </div>
              )}

              {c.status === "RETURNED" && (
                <div className="rounded-2xl border border-forest/20 bg-mint-soft/80 px-4 py-4">
                  <p className="flex items-center gap-2 font-display font-bold text-forest">
                    <SealCheck size={20} weight="fill" />
                    {t("case.done")}
                  </p>
                  <p className="mt-2 text-sm text-ink-soft">
                    {c.reward} {t("case.doneD")}
                  </p>
                  {lastTx && (
                    <div className="mt-3 space-y-1">
                      {lastIx && (
                        <p className="font-mono text-[10px] uppercase tracking-wider text-solana">
                          ix · {lastIx}
                        </p>
                      )}
                      {lastTxUrl ? (
                        <a
                          href={lastTxUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="block break-all font-mono text-[11px] text-solana hover:underline"
                        >
                          tx {lastTx.slice(0, 20)}…
                        </a>
                      ) : (
                        <p className="break-all font-mono text-[11px] text-ink-muted">
                          tx {lastTx}
                        </p>
                      )}
                    </div>
                  )}
                  <Button
                    href="/app/demo"
                    variant="secondary"
                    size="sm"
                    className="mt-4"
                  >
                    {t("case.viewDemo")}
                  </Button>
                </div>
              )}

              <div className="rounded-2xl border border-black/5 bg-bg-deep px-4 py-3 text-white">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
                  Solana · {chainMode}
                </p>
                <p className="mt-1 break-all font-mono text-[11px] text-white/80">
                  program {programId}
                </p>
                {c && getEscrowPda(c.id) && (
                  <p className="mt-1 font-mono text-[11px] text-white/55">
                    escrow PDA {getEscrowPda(c.id)}
                  </p>
                )}
                {lastIx && (
                  <p className="mt-2 font-mono text-[11px] text-solana">
                    last ix · {lastIx}
                  </p>
                )}
              </div>

              {c.status === "OPEN" && !c.finder && (
                <p className="text-sm text-ink-soft">
                  {t("case.waitFinder")}{" "}
                  <Link href="/app/found" className="font-semibold text-forest">
                    {t("case.reportFoundLink")}
                  </Link>{" "}
                  {t("case.asMai")}{" "}
                  <Link href="/app/demo" className="font-semibold text-forest">
                    {t("case.liveDemo")}
                  </Link>
                  .
                </p>
              )}

              {c.status === "CLAIMED" && (
                <p className="text-sm text-ink-soft">{t("case.claimedNote")}</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Meta({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white/50 px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
        {label}
      </p>
      <p className="mt-1 flex items-center gap-1 text-sm font-semibold">
        {icon && <CurrencyCircleDollar size={14} className="text-gold" />}
        {value}
      </p>
    </div>
  );
}
