"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  ArrowSquareOut,
  CheckCircle,
  CircleNotch,
  Coins,
  Copy,
  ShieldCheck,
  Warning,
} from "@phosphor-icons/react";
import { FIND_MINT, FIND_SYMBOL, explorerTokensUrl, explorerTxUrl } from "@/lib/findback/config";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { TokenBalances } from "@/components/wallet/TokenBalances";

type FundResult = {
  ok?: boolean;
  error?: string;
  message?: string;
  sol?: { claimed?: boolean; explorerUrl?: string | null; note?: string };
  find?: { amount?: number; skipped?: boolean; note?: string; signature?: string; explorerUrl?: string };
};

export function GetStarted() {
  const { publicKey, connected } = useWallet();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txUrl, setTxUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const address = publicKey?.toBase58() ?? "";

  const prepareWallet = async () => {
    if (!address) {
      setError("Hãy kết nối ví trước khi nhận tài sản Devnet.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    setTxUrl(null);
    try {
      const response = await fetch("/api/devnet/fund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, amount: 100 }),
      });
      const result = (await response.json()) as FundResult;
      if (!response.ok || !result.ok) throw new Error(result.error || "Không chuẩn bị được ví Devnet.");

      if (result.find?.skipped) {
        setMessage(`${result.sol?.note || "Đã kiểm tra SOL Devnet."} ${result.find.note || ""}`.trim());
      } else {
        setMessage(`Ví đã sẵn sàng. ${result.find?.amount ?? 100} ${FIND_SYMBOL} Devnet đã được cấp và SOL phí mạng đã được kiểm tra.`);
        const signature = result.find?.signature;
        if (signature) setTxUrl(result.find?.explorerUrl || explorerTxUrl(signature));
      }
      window.dispatchEvent(new Event("safereturn:funded"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const copyMint = async () => {
    await navigator.clipboard.writeText(FIND_MINT);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className="app-card mb-10 overflow-hidden" aria-labelledby="wallet-setup-title">
      <div className="grid lg:grid-cols-[1fr_0.85fr]">
        <div className="p-5 sm:p-6 lg:p-7">
          <div className="flex items-center gap-2 text-forest">
            <ShieldCheck size={19} weight="fill" />
            <p className="text-sm font-bold">Chỉ sử dụng Devnet</p>
          </div>
          <h2 id="wallet-setup-title" className="mt-3 text-2xl font-bold tracking-tight">Chuẩn bị ví trước khi giao dịch</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
            SOL Devnet trả phí mạng và được lấy miễn phí từ faucet. FIND là SPL token Devnet mà smart contract dùng để khóa phần thưởng. Cả hai không có giá trị tiền tệ.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {!connected ? (
              <ConnectWalletButton size="md" />
            ) : (
              <button type="button" onClick={() => void prepareWallet()} disabled={busy} className="app-button-primary">
                {busy ? <CircleNotch size={17} className="animate-spin" /> : <Coins size={17} weight="bold" />}
                {busy ? "Đang kiểm tra faucet" : "Chuẩn bị ví Devnet"}
              </button>
            )}
            <a href="https://faucet.solana.com" target="_blank" rel="noreferrer" className="app-button-secondary">
              Mở faucet SOL <ArrowSquareOut size={16} />
            </a>
          </div>
        </div>

        <div className="border-t border-line bg-bg-deep p-5 sm:p-6 lg:border-l lg:border-t-0 lg:p-7">
          <p className="text-sm font-semibold text-ink-soft">Trạng thái ví</p>
          {connected ? (
            <>
              <div className="mt-3"><TokenBalances /></div>
              <p className="mt-4 break-all font-mono text-xs leading-5 text-ink-muted">{address}</p>
              <button type="button" onClick={() => void copyMint()} className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-ink-soft hover:text-forest">
                <Copy size={14} /> {copied ? "Đã sao chép mint FIND" : "Sao chép mint FIND"}
              </button>
            </>
          ) : (
            <p className="mt-3 text-sm text-ink-muted">Chưa kết nối Phantom. Hãy chọn Devnet trong phần Developer Settings của ví.</p>
          )}
        </div>
      </div>

      {(message || error || txUrl) && (
        <div className="border-t border-line px-5 py-4 sm:px-6" role={error ? "alert" : "status"}>
          {message && <p className="flex items-start gap-2 text-sm text-emerald-800"><CheckCircle size={17} className="mt-0.5 shrink-0" weight="fill" />{message}</p>}
          {error && <p className="flex items-start gap-2 text-sm text-rose-800"><Warning size={17} className="mt-0.5 shrink-0" />{error}</p>}
          <div className="mt-3 flex flex-wrap gap-3">
            {txUrl && <a href={txUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-forest hover:underline">Xem giao dịch cấp FIND</a>}
            {connected && <a href={explorerTokensUrl(address)} target="_blank" rel="noreferrer" className="text-xs font-bold text-forest hover:underline">Xem tài sản trong ví</a>}
          </div>
        </div>
      )}
    </section>
  );
}
