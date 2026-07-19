"use client";

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
  const endpoint = SOLANA_RPC;
  // Empty list also works (Wallet Standard auto-detects Phantom).
  // Keep legacy adapter as explicit fallback for older Phantom builds.
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  const onError = useCallback((error: Error) => {
    // Avoid uncaught adapter noise; UI surfaces message via connect button.
    if (process.env.NODE_ENV === "development") {
      console.warn("[wallet]", error.message);
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
