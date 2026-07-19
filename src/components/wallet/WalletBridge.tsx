"use client";

import { useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { setAppWallet } from "@/lib/wallet-bridge";
import type { Transaction } from "@solana/web3.js";

/** Syncs Phantom adapter → getAppWallet() used by the app store. */
export function WalletBridge() {
  const { publicKey, signTransaction, connected } = useWallet();

  useEffect(() => {
    if (connected && publicKey && signTransaction) {
      setAppWallet({
        publicKey,
        signTransaction: async <T extends Transaction>(tx: T) =>
          signTransaction(tx) as Promise<T>,
      });
    } else {
      setAppWallet(null);
    }
  }, [connected, publicKey, signTransaction]);

  return null;
}
