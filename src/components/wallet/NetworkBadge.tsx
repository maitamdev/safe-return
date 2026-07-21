"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useCallback, useEffect, useState } from "react";
import { SOLANA_CLUSTER, explorerAddressUrl } from "@/lib/findback/config";
import { Flask } from "@phosphor-icons/react";

/** Devnet/Mainnet badge with an optional live SOL balance. */
export function NetworkBadge({ showBalance = true }: { showBalance?: boolean }) {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [sol, setSol] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (!publicKey) {
      setSol(null);
      return;
    }
    try {
      const lamports = await connection.getBalance(publicKey, "confirmed");
      setSol(lamports / 1e9);
    } catch {
      setSol(null);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    const first = window.setTimeout(() => void refresh(), 0);
    if (!publicKey) return () => window.clearTimeout(first);
    const id = setInterval(() => void refresh(), 15_000);
    return () => {
      window.clearTimeout(first);
      clearInterval(id);
    };
  }, [publicKey, refresh]);

  const isDevnet = SOLANA_CLUSTER === "devnet";

  return (
    <div className="inline-flex items-center gap-1.5">
      <span
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-bold ${
          isDevnet ? "badge-devnet border-transparent" : "status-pill-ok"
        }`}
        title={isDevnet ? "Mạng test, SOL miễn phí" : "Mainnet thật"}
      >
        <Flask size={13} weight="duotone" />
        {isDevnet ? "DEVNET" : SOLANA_CLUSTER}
      </span>
      {showBalance && publicKey && sol !== null && (
        <a
          href={explorerAddressUrl(publicKey.toBase58())}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-line bg-bg-elevated px-2.5 py-1 font-mono text-[10px] font-semibold text-ink-soft transition hover:border-forest/40 hover:text-forest"
          title="Xem trên Explorer"
        >
          {sol < 0.001 ? sol.toFixed(4) : sol.toFixed(3)} SOL
        </a>
      )}
    </div>
  );
}
