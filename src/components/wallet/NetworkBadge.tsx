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
            ? "bg-amber-400/15 text-amber-200 ring-1 ring-amber-400/30"
            : "bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-400/30"
        }`}
        title={isDevnet ? "Mạng test — SOL miễn phí" : "Mainnet thật"}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            isDevnet ? "bg-amber-400" : "bg-emerald-400"
          }`}
        />
        {isDevnet ? "DEVNET" : SOLANA_CLUSTER}
      </span>
      {showBalance && publicKey && sol !== null && (
        <a
          href={explorerAddressUrl(publicKey.toBase58())}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 font-mono text-[10px] font-semibold text-white/80 transition hover:border-[#14F195]/40 hover:text-[#14F195]"
          title="Xem trên Explorer"
        >
          {sol < 0.001 ? sol.toFixed(4) : sol.toFixed(3)} SOL
        </a>
      )}
    </div>
  );
}
