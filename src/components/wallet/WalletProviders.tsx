"use client";

/**
 * Standard Solana dApp provider stack
 * (same pattern as Solana Cookbook / create-solana-dapp):
 * ConnectionProvider → WalletProvider → WalletModalProvider
 *
 * wallets={[]} = Wallet Standard auto-discovery (Phantom, Solflare, …)
 * without the heavy legacy adapter bundle.
 */

import { useMemo, useCallback, type ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { Buffer } from "buffer";
import { SOLANA_RPC } from "@/lib/solana/config";

import "@solana/wallet-adapter-react-ui/styles.css";

function ensureBrowserPolyfills() {
  if (typeof window === "undefined") return;
  const w = window as unknown as {
    Buffer?: typeof Buffer;
    global?: typeof globalThis;
  };
  if (!w.Buffer) w.Buffer = Buffer;
  if (!w.global) w.global = globalThis;
}

ensureBrowserPolyfills();

export function WalletProviders({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => SOLANA_RPC, []);
  // Wallet Standard: empty list → browser discovers installed wallets
  const wallets = useMemo(() => [], []);

  const onError = useCallback((error: Error) => {
    if (process.env.NODE_ENV === "development") {
      console.warn("[wallet]", error.name, error.message);
    }
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint} config={{ commitment: "confirmed" }}>
      <WalletProvider
        wallets={wallets}
        autoConnect
        onError={onError}
        localStorageKey="safereturn-wallet"
      >
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
