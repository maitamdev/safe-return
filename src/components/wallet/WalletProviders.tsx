"use client";

import { useMemo, type ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { Buffer } from "buffer";
import { SOLANA_RPC } from "@/lib/solana/config";

import "@solana/wallet-adapter-react-ui/styles.css";

if (typeof window !== "undefined") {
  (window as unknown as { Buffer: typeof Buffer }).Buffer =
    (window as unknown as { Buffer?: typeof Buffer }).Buffer || Buffer;
}

export function WalletProviders({ children }: { children: ReactNode }) {
  const endpoint = SOLANA_RPC;
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
