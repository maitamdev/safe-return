"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
  Wallet,
  Lightning,
  CheckCircle,
  CircleNotch,
  Copy,
  ArrowSquareOut,
  WarningCircle,
  X,
  Sparkle,
} from "@phosphor-icons/react";
import {
  MOCK_USDC_MINT,
  PROGRAM_ID,
  explorerAddressUrl,
} from "@/lib/solana/config";
import { ConnectWalletButton } from "./ConnectWalletButton";

type FundResult = {
  ok: boolean;
  error?: string;
  message?: string;
  sol?: {
    before: number;
    after: number;
    claimed: boolean;
    note?: string;
    explorerUrl?: string | null;
  };
  usdc?: {
    amount: number;
    mint: string;
    explorerUrl: string;
  };
  tips?: string[];
};

const STORAGE_KEY = "safereturn_onboarding_dismissed_v1";

export function WalletOnboarding({
  compact = false,
  forceOpen = false,
}: {
  compact?: boolean;
  forceOpen?: boolean;
}) {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();
  const [dismissed, setDismissed] = useState(true);
  const [solBal, setSolBal] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<FundResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (forceOpen) {
      setDismissed(false);
      return;
    }
    try {
      setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, [forceOpen]);

  const refreshBal = useCallback(async () => {
    if (!publicKey) {
      setSolBal(null);
      return;
    }
    try {
      const lamports = await connection.getBalance(publicKey, "confirmed");
      setSolBal(lamports / 1e9);
    } catch {
      setSolBal(null);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    void refreshBal();
    if (!publicKey) return;
    const t = setInterval(() => void refreshBal(), 12_000);
    return () => clearInterval(t);
  }, [publicKey, refreshBal]);

  const needsFund = solBal !== null && solBal < 0.02;
  const showBanner = forceOpen || !dismissed || !connected || needsFund;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  async function fundMe() {
    if (!publicKey) {
      setVisible(true);
      return;
    }
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const r = await fetch("/api/devnet/fund", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: publicKey.toBase58(), usdc: 100 }),
      });
      const j = (await r.json()) as FundResult;
      if (!r.ok || !j.ok) {
        throw new Error(j.error || "Nạp tiền ảo thất bại");
      }
      setResult(j);
      await refreshBal();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function copyAddr() {
    if (!publicKey) return;
    await navigator.clipboard.writeText(publicKey.toBase58());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!showBanner && compact) return null;

  const steps = [
    {
      n: "1",
      title: "Cài Phantom (miễn phí)",
      body: "Tiện ích ví trên Chrome/Edge. Không cần thẻ ngân hàng.",
      href: "https://phantom.app/download",
    },
    {
      n: "2",
      title: "Bật chế độ Devnet",
      body: "Phantom → Settings → Developer Settings → Testnet Mode ON → chọn Devnet.",
    },
    {
      n: "3",
      title: "Connect ví trong SafeReturn",
      body: "Bấm Connect Phantom → Approve. Đây là ví test, không phải mainnet.",
    },
    {
      n: "4",
      title: "Nạp tiền ảo 1 chạm",
      body: "Bấm nút bên dưới → nhận SOL Devnet + 100 mock USDC. Giá trị = 0 đồng thật.",
    },
  ];

  return (
    <section
      className={`relative overflow-hidden rounded-3xl border border-forest/15 bg-gradient-to-br from-mint-soft via-white to-gold-soft/40 shadow-[0_20px_50px_-28px_rgba(15,118,110,0.35)] ${
        compact ? "p-4 md:p-5" : "p-5 md:p-7"
      }`}
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-forest/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-solana/10 blur-3xl" />

      <div className="relative flex flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-forest/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-forest-deep">
              <Sparkle size={12} weight="fill" />
              Devnet · tiền ảo · 0đ thật
            </p>
            <h2 className="mt-2 font-display text-xl font-bold tracking-tight text-ink md:text-2xl">
              {connected
                ? "Ví đã nối — nạp tiền test để ký giao dịch"
                : "Chưa biết blockchain? Làm 4 bước này là xong"}
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-soft">
              SafeReturn chạy trên <strong>Solana Devnet</strong> (mạng thử
              nghiệm). SOL và mock USDC chỉ để demo hackathon —{" "}
              <strong>không mua, không bán, không mất tiền thật</strong>.
            </p>
          </div>
          {!forceOpen && (
            <button
              type="button"
              onClick={dismiss}
              className="rounded-full p-2 text-ink-muted transition hover:bg-black/5 hover:text-ink"
              aria-label="Đóng"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {!compact && (
          <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s) => (
              <li
                key={s.n}
                className="rounded-2xl border border-white/80 bg-white/70 p-3.5 shadow-sm backdrop-blur"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-forest text-[11px] font-bold text-white">
                  {s.n}
                </span>
                <p className="mt-2 text-sm font-semibold text-ink">{s.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                  {s.body}
                </p>
                {s.href && (
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-forest hover:underline"
                  >
                    Tải Phantom <ArrowSquareOut size={12} />
                  </a>
                )}
              </li>
            ))}
          </ol>
        )}

        <div className="flex flex-col gap-3 rounded-2xl border border-line/80 bg-white/80 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1">
            {connected && publicKey ? (
              <>
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                  <CheckCircle
                    size={16}
                    weight="fill"
                    className="text-emerald-600"
                  />
                  Đã connect
                  <button
                    type="button"
                    onClick={() => void copyAddr()}
                    className="inline-flex items-center gap-1 rounded-full bg-mint-soft px-2 py-0.5 font-mono text-[11px] font-medium text-forest-deep"
                  >
                    {publicKey.toBase58().slice(0, 4)}…
                    {publicKey.toBase58().slice(-4)}
                    <Copy size={11} />
                    {copied ? "copied" : ""}
                  </button>
                </p>
                <p className="text-xs text-ink-soft">
                  Số dư SOL Devnet:{" "}
                  <span className="font-mono font-semibold text-ink">
                    {solBal === null ? "…" : `${solBal.toFixed(4)} SOL`}
                  </span>
                  {needsFund && (
                    <span className="ml-2 text-amber-700">
                      (cần nạp để trả phí gas ảo)
                    </span>
                  )}
                </p>
              </>
            ) : (
              <p className="text-sm text-ink-soft">
                Bấm <strong>Connect Phantom</strong> trước, rồi nạp tiền ảo.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!connected ? (
              <ConnectWalletButton className="!rounded-2xl !px-4 !py-2.5 !text-sm" />
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void fundMe()}
                className="inline-flex items-center gap-2 rounded-2xl bg-forest px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_28px_-12px_rgba(15,118,110,0.7)] transition hover:bg-forest-deep disabled:opacity-60"
              >
                {busy ? (
                  <CircleNotch size={16} className="animate-spin" />
                ) : (
                  <Lightning size={16} weight="fill" />
                )}
                {busy ? "Đang nạp…" : "Nạp tiền ảo miễn phí"}
              </button>
            )}
            <a
              href={explorerAddressUrl(PROGRAM_ID)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-2xl border border-line bg-white px-3 py-2.5 text-xs font-semibold text-ink-soft transition hover:border-forest/30 hover:text-forest"
            >
              <Wallet size={14} />
              Xem program on-chain
            </a>
          </div>
        </div>

        {err && (
          <div className="flex items-start gap-2 rounded-2xl border border-coral/25 bg-coral/10 px-3.5 py-3 text-sm text-coral">
            <WarningCircle size={18} className="mt-0.5 shrink-0" />
            <p>{err}</p>
          </div>
        )}

        {result?.ok && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900">
            <p className="font-semibold">{result.message}</p>
            <ul className="mt-2 space-y-1 text-xs text-emerald-800/90">
              <li>
                SOL: {result.sol?.before?.toFixed(4)} →{" "}
                {result.sol?.after?.toFixed(4)} · {result.sol?.note}
              </li>
              <li>
                Mock USDC: +{result.usdc?.amount} · mint{" "}
                <span className="font-mono">
                  {(result.usdc?.mint || MOCK_USDC_MINT).slice(0, 8)}…
                </span>
              </li>
            </ul>
            {result.usdc?.explorerUrl && (
              <a
                href={result.usdc.explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-forest underline"
              >
                Xem giao dịch mint trên Explorer <ArrowSquareOut size={12} />
              </a>
            )}
            <p className="mt-2 text-xs text-emerald-800/80">
              Tip: Trong Phantom → Manage token list → dán mint mock USDC nếu
              chưa thấy số dư token.
            </p>
          </div>
        )}

        <p className="font-mono text-[10px] leading-relaxed text-ink-muted">
          Program {PROGRAM_ID.slice(0, 8)}… · Mint{" "}
          {MOCK_USDC_MINT ? `${MOCK_USDC_MINT.slice(0, 8)}…` : "(chưa setup)"} ·
          cluster devnet
        </p>
      </div>
    </section>
  );
}
