"use client";

import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  getAssociatedTokenAddressSync,
  unpackAccount,
} from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { withRpcReadRetry } from "@/lib/solana/rpc-read";
import {
  FIND_MINT,
  FIND_SYMBOL,
  FIND_DECIMALS,
  explorerAddressUrl,
  explorerTokensUrl,
} from "@/lib/findback/config";

type BalanceSnapshot = { sol: number; find: number; fetchedAt: number };
const balanceCache = new Map<string, BalanceSnapshot>();
const balanceRequests = new Map<string, Promise<BalanceSnapshot>>();

async function loadBalances(
  connection: ReturnType<typeof useConnection>["connection"],
  publicKey: PublicKey,
  force = false,
) {
  const key = publicKey.toBase58();
  const cached = balanceCache.get(key);
  if (!force && cached && Date.now() - cached.fetchedAt < 45_000) return cached;
  const pending = balanceRequests.get(key);
  if (pending) return pending;

  const request = withRpcReadRetry(async () => {
    const mint = new PublicKey(FIND_MINT);
    const ata = getAssociatedTokenAddressSync(mint, publicKey);
    const [walletInfo, tokenInfo] = await connection.getMultipleAccountsInfo(
      [publicKey, ata],
      "confirmed",
    );
    const snapshot = {
      sol: (walletInfo?.lamports ?? 0) / 1e9,
      find: tokenInfo
        ? Number(unpackAccount(ata, tokenInfo).amount) / 10 ** FIND_DECIMALS
        : 0,
      fetchedAt: Date.now(),
    };
    balanceCache.set(key, snapshot);
    return snapshot;
  }).finally(() => balanceRequests.delete(key));
  balanceRequests.set(key, request);
  return request;
}

/** Live SOL + FIND balances with Explorer links (Devnet). */
export function TokenBalances({ dark = false }: { dark?: boolean }) {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [sol, setSol] = useState<number | null>(null);
  const [find, setFind] = useState<number | null>(null);

  const refresh = useCallback(async (force = false) => {
    if (!publicKey) {
      setSol(null);
      setFind(null);
      return;
    }
    try {
      const balances = await loadBalances(connection, publicKey, force);
      setSol(balances.sol);
      setFind(balances.find);
    } catch {
      // Preserve the last known values while the public Devnet RPC is busy.
    }
  }, [connection, publicKey]);

  useEffect(() => {
    const first = window.setTimeout(() => void refresh(), 0);
    if (!publicKey) return () => window.clearTimeout(first);
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 60_000);
    return () => {
      window.clearTimeout(first);
      clearInterval(id);
    };
  }, [publicKey, refresh]);

  // Allow parent to force refresh via custom event
  useEffect(() => {
    const onFunded = () => void refresh(true);
    window.addEventListener("safereturn:funded", onFunded);
    return () => window.removeEventListener("safereturn:funded", onFunded);
  }, [refresh]);

  if (!publicKey) return null;

  const addr = publicKey.toBase58();
  const pill = dark
    ? "rounded-full border border-white/15 bg-white/5 px-2.5 py-1 font-mono text-[10px] font-semibold text-white/80 transition hover:border-[#14F195]/40 hover:text-[#14F195]"
    : "rounded-lg border border-line bg-bg-elevated px-2.5 py-1 font-mono text-[10px] font-semibold text-ink-soft transition hover:border-forest/40 hover:text-forest";

  return (
    <div className="inline-flex shrink-0 flex-nowrap items-center gap-1.5 whitespace-nowrap">
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
