"use client";

import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { getAssociatedTokenAddressSync, getAccount } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import {
  FIND_MINT,
  FIND_SYMBOL,
  FIND_DECIMALS,
  explorerAddressUrl,
  explorerTokensUrl,
} from "@/lib/findback/config";

/** Live SOL + FIND balances with Explorer links (Devnet). */
export function TokenBalances({ dark = false }: { dark?: boolean }) {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [sol, setSol] = useState<number | null>(null);
  const [find, setFind] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(async () => {
    if (!publicKey) {
      setSol(null);
      setFind(null);
      return;
    }
    try {
      const lamports = await connection.getBalance(publicKey, "confirmed");
      setSol(lamports / 1e9);
    } catch {
      setSol(null);
    }
    try {
      const mint = new PublicKey(FIND_MINT);
      const ata = getAssociatedTokenAddressSync(mint, publicKey);
      const acct = await getAccount(connection, ata, "confirmed");
      setFind(Number(acct.amount) / 10 ** FIND_DECIMALS);
    } catch {
      // ATA not created yet = 0 FIND
      setFind(0);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    void refresh();
    if (!publicKey) return;
    const id = setInterval(() => void refresh(), 12_000);
    return () => clearInterval(id);
  }, [publicKey, refresh, tick]);

  // Allow parent to force refresh via custom event
  useEffect(() => {
    const onFunded = () => setTick((t) => t + 1);
    window.addEventListener("findback:funded", onFunded);
    return () => window.removeEventListener("findback:funded", onFunded);
  }, []);

  if (!publicKey) return null;

  const addr = publicKey.toBase58();
  const pill = dark
    ? "rounded-full border border-white/15 bg-white/5 px-2.5 py-1 font-mono text-[10px] font-semibold text-white/80 transition hover:border-[#14F195]/40 hover:text-[#14F195]"
    : "rounded-full border border-line bg-white/80 px-2.5 py-1 font-mono text-[10px] font-semibold text-ink-soft transition hover:border-forest/30 hover:text-forest";

  return (
    <div className="inline-flex flex-wrap items-center gap-1.5">
      {sol !== null && (
        <a
          href={explorerAddressUrl(addr)}
          target="_blank"
          rel="noreferrer"
          className={pill}
          title="Xem ví trên Solana Explorer (Devnet)"
        >
          {sol < 0.001 ? sol.toFixed(4) : sol.toFixed(3)} SOL
        </a>
      )}
      {find !== null && (
        <a
          href={explorerTokensUrl(addr)}
          target="_blank"
          rel="noreferrer"
          className={pill}
          title={`${FIND_SYMBOL} test token · click mở Explorer`}
        >
          {find.toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
          {FIND_SYMBOL}
        </a>
      )}
    </div>
  );
}
