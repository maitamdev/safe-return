"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  ArrowSquareOut,
  CheckCircle,
  CircleNotch,
  Coins,
  ShieldCheck,
  Warning,
} from "@phosphor-icons/react";
import { FIND_SYMBOL, explorerTokensUrl, explorerTxUrl } from "@/lib/findback/config";
import {
  formatFundingSuccess,
  type DevnetFundResult,
} from "@/lib/findback/funding";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { TokenBalances } from "@/components/wallet/TokenBalances";

export function GetStarted() {
  const { publicKey, connected } = useWallet();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txUrl, setTxUrl] = useState<string | null>(null);
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
      const result = (await response.json()) as DevnetFundResult;
      if (!response.ok || !result.ok) throw new Error(result.error || "Không chuẩn bị được ví Devnet.");

      setMessage(formatFundingSuccess(result, FIND_SYMBOL));
      if (!result.find?.skipped && (result.find?.amount ?? 0) > 0) {
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

  return (
    <section className="app-card overflow-hidden" aria-labelledby="wallet-setup-title">
      <div className="flex flex-col gap-4 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bg-deep text-forest">
            <ShieldCheck size={21} weight="fill" />
          </span>
          <div className="min-w-0">
            <h2 id="wallet-setup-title" className="text-sm font-bold text-ink">
              {connected ? "Ví giao dịch đã sẵn sàng" : "Kết nối ví để bắt đầu"}
            </h2>
            <p className="mt-1 text-xs leading-5 text-ink-muted">
              {connected
                ? "SOL và FIND thử nghiệm trên Solana Devnet."
                : "Ví dùng để đăng tin, gửi bằng chứng và nhận thưởng FIND."}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {connected ? (
            <div className="flex flex-wrap items-center gap-3">
              <TokenBalances />
              <button type="button" onClick={() => void prepareWallet()} disabled={busy} className="app-button-secondary whitespace-nowrap">
                {busy ? <CircleNotch size={17} className="animate-spin" /> : <Coins size={17} weight="bold" />}
                {busy ? "Đang kiểm tra" : "Bổ sung tài sản"}
              </button>
              <a href="https://faucet.solana.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-bold text-forest hover:underline">
                Faucet SOL <ArrowSquareOut size={14} />
              </a>
            </div>
          ) : (
            <ConnectWalletButton size="md" />
          )}
        </div>
      </div>

      {(message || error || txUrl) && (
        <div className="border-t border-line bg-bg-deep/55 px-4 py-3 sm:px-5" role={error ? "alert" : "status"}>
          {message && <p className="flex items-start gap-2 text-sm text-emerald-800"><CheckCircle size={17} className="mt-0.5 shrink-0" weight="fill" />{message}</p>}
          {error && <p className="flex items-start gap-2 text-sm text-rose-800"><Warning size={17} className="mt-0.5 shrink-0" />{error}</p>}
          <div className="mt-2 flex flex-wrap gap-3">
            {txUrl && <a href={txUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-forest hover:underline">Xem giao dịch cấp FIND</a>}
            {connected && <a href={explorerTokensUrl(address)} target="_blank" rel="noreferrer" className="text-xs font-bold text-forest hover:underline">Xem ví trên Solana Explorer</a>}
          </div>
        </div>
      )}
    </section>
  );
}
