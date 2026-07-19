"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Wallet } from "@phosphor-icons/react";

export function ConnectWalletButton({ className = "" }: { className?: string }) {
  const { publicKey, disconnect, connecting } = useWallet();
  const { setVisible } = useWalletModal();

  if (publicKey) {
    const short = `${publicKey.toBase58().slice(0, 4)}…${publicKey
      .toBase58()
      .slice(-4)}`;
    return (
      <button
        type="button"
        onClick={() => void disconnect()}
        className={`inline-flex items-center gap-2 rounded-full border border-forest/20 bg-mint-soft px-3 py-1.5 text-xs font-semibold text-forest-deep transition hover:bg-mint ${className}`}
        title="Click to disconnect"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        {short}
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={connecting}
      onClick={() => setVisible(true)}
      className={`inline-flex items-center gap-2 rounded-full bg-forest px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-forest-deep disabled:opacity-60 ${className}`}
    >
      <Wallet size={14} weight="bold" />
      {connecting ? "…" : "Connect Phantom"}
    </button>
  );
}
