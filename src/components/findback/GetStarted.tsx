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
} from "@phosphor-icons/react";
import { FIND_MINT, FIND_SYMBOL } from "@/lib/findback/config";
import Link from "next/link";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";

/**
 * Vietnamese onboarding — what confused users actually need.
 */
export function GetStarted() {
  const { publicKey, connected } = useWallet();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
      const j = (await r.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
        find?: { amount?: number; skipped?: boolean; note?: string };
      };
      if (!r.ok || !j.ok) {
        throw new Error(j.error || "Nạp thất bại");
      }
      if (j.find && "skipped" in j.find && j.find.skipped) {
        setMsg(
          `${j.message || ""} ${j.find.note || ""} — Import mint FIND trong Phantom rồi thử lại / chạy local.`
        );
      } else {
        setMsg(
          j.message ||
            `Đã nạp ${FIND_SYMBOL}. Mở Phantom → refresh. Import token nếu chưa thấy.`
        );
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
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#14F195]">
          Bắt đầu tại đây (3 bước)
        </p>
        <h2 className="mt-1 font-display text-xl font-bold md:text-2xl">
          Dùng app không cần hiểu blockchain
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-white/55">
          Tiền trên đây là <strong className="text-white/80">test Devnet</strong>{" "}
          — 0 đồng thật. Phantom có thể hiện cảnh báo đỏ vì site mới: bấm{" "}
          <strong className="text-amber-200">«Vẫn tiếp tục»</strong>.
        </p>
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
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#14F195]">
              <CheckCircle size={14} weight="fill" /> Đã nối ·{" "}
              {address.slice(0, 4)}…{address.slice(-4)}
            </p>
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

      {(msg || err) && (
        <div className="border-t border-white/10 px-5 py-3 md:px-6">
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
