"use client";

import { useState } from "react";
import {
  SealCheck,
  Bell,
  Trophy,
  Copy,
  Check,
} from "@phosphor-icons/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { badges, currentUser } from "@/lib/data";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/Button";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { useT } from "@/lib/i18n";

const badgeKeys = ["b1", "b2", "b3", "b4", "b5"] as const;

export default function ProfilePage() {
  const t = useT();
  const { publicKey, connected } = useWallet();
  const { notifications, markNotificationsRead, cases } = useApp();
  const [copied, setCopied] = useState(false);

  const returned = cases.filter((c) => c.status === "RETURNED").length;
  const address = publicKey?.toBase58() ?? "";

  async function copyAddr() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
          {t("profile.kicker")}
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
          {t("profile.title")}
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="double-bezel">
          <div className="double-bezel-inner p-6">
            <div className="flex items-center gap-4">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-forest font-display text-2xl font-bold text-white">
                Q
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-xl font-bold">
                    {currentUser.name}
                  </h2>
                  {currentUser.verified && (
                    <SealCheck
                      size={18}
                      weight="fill"
                      className="text-forest"
                    />
                  )}
                </div>
                <p className="text-sm text-ink-muted">@{currentUser.nickname}</p>
                <p className="mt-1 text-xs text-ink-soft">
                  {currentUser.email}
                </p>
              </div>
            </div>

            <dl className="mt-6 space-y-3 border-t border-line pt-5 text-sm">
              <Row label={t("profile.campus")} value={currentUser.campus} />
              <Row label={t("profile.area")} value={currentUser.area} />
              <Row
                label={t("profile.rep")}
                value={`${currentUser.reputation}/100`}
              />
              <Row
                label={t("profile.returns")}
                value={`${Math.max(currentUser.returns, returned)}`}
              />
              <Row
                label={t("profile.disputes")}
                value={`${currentUser.disputes}`}
              />
            </dl>

            <div className="mt-6 rounded-2xl border border-line bg-white/50 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{t("profile.wallet")}</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    connected
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-black/5 text-ink-muted"
                  }`}
                >
                  {connected ? "Connected" : "Offline"}
                </span>
              </div>
              <p className="mt-2 break-all font-mono text-xs text-ink-soft">
                {connected && address ? address : t("app.walletOff")}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <ConnectWalletButton size="md" />
                {connected && address && (
                  <Button size="sm" variant="secondary" onClick={() => void copyAddr()}>
                    <span className="inline-flex items-center gap-1.5">
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? "Copied" : t("profile.copy")}
                    </span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="space-y-6">
          <section className="double-bezel">
            <div className="double-bezel-inner p-5 md:p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy size={18} className="text-gold" />
                  <h2 className="font-display text-lg font-bold">
                    {t("profile.badges")}
                  </h2>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {badges.map((b, i) => {
                  const key = badgeKeys[i] ?? "b1";
                  return (
                    <div
                      key={b.id}
                      className={`rounded-2xl border px-4 py-3 ${
                        b.earned
                          ? "border-forest/15 bg-mint-soft/70"
                          : "border-line bg-white/40 opacity-60"
                      }`}
                    >
                      <p className="text-sm font-bold">{t(`badge.${key}`)}</p>
                      <p className="mt-1 text-xs text-ink-soft">
                        {t(`badge.${key}d`)}
                      </p>
                      <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                        {b.earned ? t("profile.earned") : t("profile.locked")}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="double-bezel">
            <div className="double-bezel-inner p-5 md:p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell size={18} />
                  <h2 className="font-display text-lg font-bold">
                    {t("profile.notifs")}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={markNotificationsRead}
                  className="text-xs font-semibold text-forest hover:underline"
                >
                  {t("profile.markRead")}
                </button>
              </div>
              <div className="space-y-2">
                {notifications.map((n) => (
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
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}
