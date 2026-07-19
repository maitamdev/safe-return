"use client";

/**
 * ConnectionProvider → WalletProvider → WalletModalProvider
 * Explicit Phantom adapter + Wallet Standard auto-detect.
 */

import { useMemo, useCallback, type ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
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
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  const onError = useCallback((error: Error) => {
    // Phantom "blocked" / user reject — surface in console only
    console.warn("[wallet]", error.name, error.message);
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint} config={{ commitment: "confirmed" }}>
      <WalletProvider
        wallets={wallets}
        autoConnect={false}
        onError={onError}
        localStorageKey="findback-wallet"
      >
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
