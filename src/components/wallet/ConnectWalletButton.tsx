"use client";

/**
 * Connect control — thin wrapper around wallet-adapter modal
 * (same UX as most Solana GitHub dApps: open modal → user picks wallet).
 */

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Wallet, SignOut, CircleNotch } from "@phosphor-icons/react";

export function ConnectWalletButton({
  className = "",
  size = "sm",
}: {
  className?: string;
  size?: "sm" | "md";
}) {
  const { publicKey, disconnect, connecting, connected } = useWallet();
  const { setVisible } = useWalletModal();

  const pad = size === "md" ? "px-4 py-2.5 text-sm" : "px-3 py-1.5 text-xs";

  if (connected && publicKey) {
    const short = `${publicKey.toBase58().slice(0, 4)}…${publicKey
      .toBase58()
      .slice(-4)}`;
    return (
      <button
        type="button"
        onClick={() => void disconnect()}
        className={`inline-flex items-center justify-center gap-2 rounded-full border border-forest/20 bg-mint-soft font-semibold text-forest-deep transition hover:bg-mint ${pad} ${className}`}
        title="Disconnect wallet"
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
        {short}
        <SignOut size={12} className="opacity-60" />
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={connecting}
      onClick={() => setVisible(true)}
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-forest font-semibold text-white transition hover:bg-forest-deep disabled:opacity-60 ${pad} ${className}`}
    >
      {connecting ? (
        <CircleNotch size={14} className="animate-spin" />
      ) : (
        <Wallet size={14} weight="bold" />
      )}
      {connecting ? "Connecting…" : "Connect Wallet"}
    </button>
  );
}
