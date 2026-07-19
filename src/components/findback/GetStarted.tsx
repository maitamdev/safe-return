"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  Coins,
  CheckCircle,
  CircleNotch,
  Warning,
  Copy,
  ArrowRight,
  ArrowSquareOut,
} from "@phosphor-icons/react";
import {
  FIND_MINT,
  FIND_SYMBOL,
  explorerTokensUrl,
  explorerTxUrl,
} from "@/lib/findback/config";
import Link from "next/link";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { TokenBalances } from "@/components/wallet/TokenBalances";

type FundResult = {
  ok?: boolean;
  error?: string;
  message?: string;
  find?: {
    amount?: number;
    skipped?: boolean;
    note?: string;
    signature?: string;
    explorerUrl?: string;
    mint?: string;
  };
  sol?: {
    before?: number;
    after?: number;
    claimed?: boolean;
    signature?: string | null;
    explorerUrl?: string | null;
    note?: string;
  };
};

/**
 * Vietnamese onboarding — what confused users actually need.
 */
export function GetStarted() {
  const { publicKey, connected } = useWallet();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [txUrl, setTxUrl] = useState<string | null>(null);
  const [walletUrl, setWalletUrl] = useState<string | null>(null);

  const address = publicKey?.toBase58() ?? "";

  const copyMint = async () => {
    try {
      await navigator.clipboard.writeText(FIND_MINT);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const fund = async () => {
    setErr(null);
    setMsg(null);
    setTxUrl(null);
    setWalletUrl(null);
    if (!address) {
      setErr("Bấm «Kết nối ví» trước (nút trắng bên dưới).");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/devnet/fund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, amount: 100 }),
      });
      const j = (await r.json()) as FundResult;
      if (!r.ok || !j.ok) {
        throw new Error(j.error || "Nạp thất bại");
      }

      setWalletUrl(explorerTokensUrl(address));

      if (j.find && "skipped" in j.find && j.find.skipped) {
        setMsg(
          `${j.message || ""} ${j.find.note || ""} — Cần key deployer trên server.`
        );
      } else {
        const sig = j.find?.signature;
        if (sig) {
          setTxUrl(j.find?.explorerUrl || explorerTxUrl(sig));
        }
        setMsg(
          `Đã gửi ${j.find?.amount ?? 100} ${FIND_SYMBOL} test. Bấm link Explorer bên dưới để kiểm tra (cluster = Devnet). Phantom có thể chưa hiện token — import mint.`
        );
        // refresh balance pills
        window.dispatchEvent(new Event("findback:funded"));
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-8 overflow-hidden rounded-3xl border border-[#9945FF]/35 bg-gradient-to-br from-[#9945FF]/15 via-black/40 to-[#14F195]/10">
      <div className="border-b border-white/10 px-5 py-4 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#14F195]">
              Bắt đầu tại đây (3 bước)
            </p>
            <h2 className="mt-1 font-display text-xl font-bold md:text-2xl">
              Dùng app không cần hiểu blockchain
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-white/55">
              Tiền trên đây là{" "}
              <strong className="text-white/80">test Devnet</strong> — 0 đồng
              thật. Sau khi nạp, xem số dư{" "}
              <strong className="text-[#14F195]">SOL + FIND</strong> góc trên /
              link Explorer.
            </p>
          </div>
          {connected && (
            <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
              <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-white/40">
                Số dư ví (Devnet)
              </p>
              <TokenBalances dark />
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-0 md:grid-cols-3">
        <Step n={1} title="Kết nối Phantom (Devnet)">
          <p className="text-xs text-white/50">
            Phantom → Settings → Developer → bật Testnet → chọn{" "}
            <strong className="text-white">Devnet</strong>.
          </p>
          {!connected ? (
            <div className="mt-3">
              <ConnectWalletButton dark size="md" />
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#14F195]">
                <CheckCircle size={14} weight="fill" /> Đã nối ·{" "}
                {address.slice(0, 4)}…{address.slice(-4)}
              </p>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(address);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  } catch {
                    /* ignore */
                  }
                }}
                className="flex w-full items-start gap-1.5 rounded-xl border border-white/10 bg-black/30 px-2.5 py-2 text-left font-mono text-[10px] leading-snug text-white/70 hover:border-[#14F195]/40 hover:text-white"
                title="Copy địa chỉ đúng (từ Phantom) — đừng gõ tay"
              >
                <Copy size={12} className="mt-0.5 shrink-0" />
                <span className="break-all">
                  {copied ? "Đã copy địa chỉ ví!" : address}
                </span>
              </button>
              <a
                href={explorerTokensUrl(address)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#14F195] hover:underline"
              >
                Mở Explorer đúng link <ArrowSquareOut size={12} />
              </a>
            </div>
          )}
        </Step>

        <Step n={2} title={`Nhận ${FIND_SYMBOL} test (free)`}>
          <p className="text-xs text-white/50">
            Token thưởng ảo để khóa escrow. Không phải USDC thật.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void fund()}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#14F195] px-4 py-2 text-xs font-bold text-black disabled:opacity-50"
          >
            {busy ? (
              <CircleNotch size={14} className="animate-spin" />
            ) : (
              <Coins size={14} weight="bold" />
            )}
            {busy ? "Đang nạp…" : `Nhận 100 ${FIND_SYMBOL}`}
          </button>
          <button
            type="button"
            onClick={() => void copyMint()}
            className="mt-2 flex w-full items-center gap-1 truncate font-mono text-[10px] text-white/40 hover:text-white/70"
            title="Copy mint để Import trong Phantom"
          >
            <Copy size={10} />
            {copied ? "Đã copy mint!" : `${FIND_MINT.slice(0, 12)}…`}
          </button>
        </Step>

        <Step n={3} title="Tạo bounty thật">
          <p className="text-xs text-white/50">
            Các card «Seed» chỉ là mẫu xem UI. Muốn tx Explorer thật → Create.
          </p>
          <Link
            href="/bounties/create"
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#9945FF] to-[#14F195] px-4 py-2 text-xs font-bold text-black"
          >
            Tạo bounty <ArrowRight size={14} />
          </Link>
        </Step>
      </div>

      {(msg || err || txUrl || walletUrl) && (
        <div className="space-y-2 border-t border-white/10 px-5 py-4 md:px-6">
          {msg && (
            <p className="flex gap-2 text-xs text-[#14F195]">
              <CheckCircle size={14} className="mt-0.5 shrink-0" weight="fill" />
              {msg}
            </p>
          )}
          {err && (
            <p className="flex gap-2 text-xs text-rose-300">
              <Warning size={14} className="mt-0.5 shrink-0" />
              {err}
            </p>
          )}

          {(txUrl || walletUrl) && (
            <div className="flex flex-wrap gap-2 pt-1">
              {txUrl && (
                <a
                  href={txUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-black hover:bg-white/90"
                >
                  Xem giao dịch trên Explorer <ArrowSquareOut size={12} />
                </a>
              )}
              {walletUrl && (
                <a
                  href={walletUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-white/10"
                >
                  Xem token FIND trong ví <ArrowSquareOut size={12} />
                </a>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-white/10 bg-black/25 p-3 text-[11px] leading-relaxed text-white/55">
            <p className="font-bold text-white/80">Cách kiểm tra (3 chỗ):</p>
            <ol className="mt-1.5 list-decimal space-y-1 pl-4">
              <li>
                Trong app: số dư <strong className="text-white">FIND</strong> góc
                trên / box «Số dư ví» (tăng ~100).
              </li>
              <li>
                Bấm <strong className="text-white">Xem giao dịch trên Explorer</strong>{" "}
                — góc trên Explorer phải ghi <strong>Devnet</strong>, status Success.
              </li>
              <li>
                Phantom (Devnet): Manage token list → Import → dán mint{" "}
                <code className="text-[#14F195]">{FIND_MINT.slice(0, 8)}…</code>{" "}
                (nút copy ở bước 2). Phantom Mainnet sẽ không thấy token test.
              </li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-white/10 p-5 md:border-r md:p-6 md:last:border-r-0">
      <p className="font-mono text-[11px] font-bold text-[#9945FF]">0{n}</p>
      <h3 className="mt-1 text-sm font-bold">{title}</h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}
