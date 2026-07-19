/**
 * Holds the latest wallet adapter handle for non-React modules (store).
 * Set by WalletBridge component inside WalletProvider.
 */

import type { PublicKey, Transaction } from "@solana/web3.js";

export type AppWallet = {
  publicKey: PublicKey;
  signTransaction: <T extends Transaction>(tx: T) => Promise<T>;
} | null;

let current: AppWallet = null;

export function setAppWallet(w: AppWallet) {
  current = w;
}

export function getAppWallet(): AppWallet {
  return current;
}
