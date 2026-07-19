"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useCallback, useEffect, useState } from "react";
import { SOLANA_CLUSTER, explorerAddressUrl } from "@/lib/solana/config";

/** Devnet/Mainnet pill + optional SOL balance — standard dApp chrome. */
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
    void refresh();
    if (!publicKey) return;
    const id = setInterval(() => void refresh(), 15_000);
    return () => clearInterval(id);
  }, [publicKey, refresh]);

  const isDevnet = SOLANA_CLUSTER === "devnet";

  return (
    <div className="inline-flex items-center gap-1.5">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
          isDevnet
            ? "bg-amber-100 text-amber-900"
            : "bg-emerald-100 text-emerald-900"
        }`}
        title={isDevnet ? "Test network — free SOL" : "Real mainnet"}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            isDevnet ? "bg-amber-500" : "bg-emerald-500"
          }`}
        />
        {SOLANA_CLUSTER}
      </span>
      {showBalance && publicKey && sol !== null && (
        <a
          href={explorerAddressUrl(publicKey.toBase58())}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-line bg-white/80 px-2.5 py-1 font-mono text-[10px] font-semibold text-ink-soft transition hover:border-forest/30 hover:text-forest"
          title="View on Explorer"
        >
          {sol < 0.001 ? sol.toFixed(4) : sol.toFixed(3)} SOL
        </a>
      )}
    </div>
  );
}
