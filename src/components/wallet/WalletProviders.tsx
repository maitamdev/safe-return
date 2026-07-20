"use client";

/**
 * ConnectionProvider → WalletProvider → WalletModalProvider
 * autoConnect MUST be true so picking Phantom in the modal actually connects.
 */

import { useMemo, useCallback, type ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { Buffer } from "buffer";
import { SOLANA_RPC } from "@/lib/findback/config";

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
  // Modern wallets such as Phantom are discovered through Wallet Standard.
  // Passing a legacy Phantom adapter as well registers it twice and floods the console.
  const wallets = useMemo(() => [], []);

  const onError = useCallback((error: Error) => {
    console.warn("[wallet]", error.name, error.message);
  }, []);

  return (
    <ConnectionProvider
      endpoint={endpoint}
      config={{
        commitment: "confirmed",
        disableRetryOnRateLimit: false,
        confirmTransactionInitialTimeout: 60_000,
      }}
    >
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
