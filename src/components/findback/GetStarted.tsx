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
  NumberCircleOne,
  NumberCircleTwo,
  NumberCircleThree,
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
import { cn } from "@/lib/cn";

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
  };
};

export function GetStarted() {
  const { publicKey, connected } = useWallet();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<"addr" | "mint" | null>(null);
  const [txUrl, setTxUrl] = useState<string | null>(null);
  const [walletUrl, setWalletUrl] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const address = publicKey?.toBase58() ?? "";
  const step1Done = connected;
  const step2Done = Boolean(txUrl) || collapsed;

  const copy = async (text: string, kind: "addr" | "mint") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
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
      setErr("Làm bước 1 trước: kết nối ví Phantom.");
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
      if (!r.ok || !j.ok) throw new Error(j.error || "Nạp thất bại");

      setWalletUrl(explorerTokensUrl(address));
      if (j.find && "skipped" in j.find && j.find.skipped) {
        setMsg(j.find.note || j.message || "Chưa mint được FIND trên server.");
      } else {
        const sig = j.find?.signature;
        if (sig) setTxUrl(j.find?.explorerUrl || explorerTxUrl(sig));
        setMsg(
          `Đã nhận ${j.find?.amount ?? 100} ${FIND_SYMBOL} test. Số dư góc trên sẽ cập nhật.`
        );
        window.dispatchEvent(new Event("findback:funded"));
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (collapsed && connected) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="mb-6 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm text-white/60 hover:bg-white/[0.05]"
      >
        <span className="inline-flex items-center gap-2">
          <CheckCircle size={16} className="text-[#14F195]" weight="fill" />
          Hướng dẫn 3 bước (đã ẩn)
        </span>
        <span className="text-xs font-semibold text-[#14F195]">Hiện lại</span>
      </button>
    );
  }

  return (
    <div className="mb-8 overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-[#9945FF]/15 via-[#0b1224] to-[#14F195]/10">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 px-5 py-5 md:px-7">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#14F195]">
            Làm theo 3 bước
          </p>
          <h2 className="mt-1 text-xl font-bold md:text-2xl">
            Dùng app không cần hiểu blockchain
          </h2>
          <p className="mt-1 max-w-xl text-sm text-white/50">
            Toàn bộ là <strong className="text-white/75">Devnet test</strong> —
            0 đồng thật. Phantom cảnh báo đỏ vì site mới → bấm{" "}
            <strong className="text-amber-200">«Vẫn tiếp tục»</strong>.
          </p>
        </div>
        {connected && (
          <div className="rounded-2xl border border-white/10 bg-black/35 px-3 py-2">
            <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-white/35">
              Số dư ví
            </p>
            <TokenBalances dark />
          </div>
        )}
      </div>

      <div className="grid gap-0 md:grid-cols-3">
        {/* Step 1 */}
        <div className="border-white/10 p-5 md:border-r md:p-6">
          <div className="flex items-center gap-2">
            <NumberCircleOne
              size={28}
              weight="fill"
              className={step1Done ? "text-[#14F195]" : "text-[#9945FF]"}
            />
            <h3 className="text-sm font-bold">Kết nối ví Phantom</h3>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-white/45">
            Phantom → Settings → Developer → bật Testnet → chọn{" "}
            <strong className="text-white/80">Devnet</strong>.
          </p>
          {!connected ? (
            <div className="mt-4">
              <ConnectWalletButton dark size="md" />
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#14F195]">
                <CheckCircle size={14} weight="fill" /> Đã nối
              </p>
              <button
                type="button"
                onClick={() => void copy(address, "addr")}
                className="flex w-full items-start gap-1.5 rounded-xl border border-white/10 bg-black/30 px-2.5 py-2 text-left font-mono text-[10px] text-white/65 hover:border-[#14F195]/40"
              >
                <Copy size={12} className="mt-0.5 shrink-0" />
                <span className="break-all">
                  {copied === "addr" ? "Đã copy địa chỉ!" : address}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Step 2 */}
        <div className="border-white/10 p-5 md:border-r md:p-6">
          <div className="flex items-center gap-2">
            <NumberCircleTwo
              size={28}
              weight="fill"
              className={step2Done ? "text-[#14F195]" : "text-[#9945FF]"}
            />
            <h3 className="text-sm font-bold">Nhận {FIND_SYMBOL} test (free)</h3>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-white/45">
            Token thưởng ảo để khóa escrow. Không phải USDC / tiền thật.
          </p>
          <button
            type="button"
            disabled={busy || !connected}
            onClick={() => void fund()}
            className={cn(
              "mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold disabled:opacity-40",
              connected
                ? "bg-[#14F195] text-black"
                : "bg-white/10 text-white/50"
            )}
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
            onClick={() => void copy(FIND_MINT, "mint")}
            className="mt-2 flex w-full items-center gap-1 font-mono text-[10px] text-white/35 hover:text-white/60"
          >
            <Copy size={10} />
            {copied === "mint" ? "Đã copy mint!" : `Mint: ${FIND_MINT.slice(0, 10)}…`}
          </button>
        </div>

        {/* Step 3 */}
        <div className="p-5 md:p-6">
          <div className="flex items-center gap-2">
            <NumberCircleThree size={28} weight="fill" className="text-[#9945FF]" />
            <h3 className="text-sm font-bold">Tạo tin mất đồ</h3>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-white/45">
            Card ghi «Mẫu» chỉ xem UI. Muốn giao dịch Explorer thật → Tạo tin.
          </p>
          <Link
            href="/bounties/create"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-xs font-bold text-black hover:bg-white/90"
          >
            Tạo tin ngay <ArrowRight size={14} weight="bold" />
          </Link>
          {connected && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="mt-3 block text-[11px] text-white/35 hover:text-white/60"
            >
              Ẩn hướng dẫn
            </button>
          )}
        </div>
      </div>

      {(msg || err || txUrl) && (
        <div className="space-y-2 border-t border-white/10 px-5 py-4 md:px-7">
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
          <div className="flex flex-wrap gap-2">
            {txUrl && (
              <a
                href={txUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-black"
              >
                Xem giao dịch Explorer <ArrowSquareOut size={12} />
              </a>
            )}
            {walletUrl && (
              <a
                href={walletUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-[11px] font-bold"
              >
                Xem token trong ví <ArrowSquareOut size={12} />
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
