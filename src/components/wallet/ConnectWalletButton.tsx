"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Wallet, SignOut, CircleNotch } from "@phosphor-icons/react";

function hasPhantomExtension(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as {
    solana?: { isPhantom?: boolean };
    phantom?: { solana?: { isPhantom?: boolean } };
  };
  return !!(w.solana?.isPhantom || w.phantom?.solana?.isPhantom);
}

export function ConnectWalletButton({
  className = "",
  size = "sm",
}: {
  className?: string;
  size?: "sm" | "md";
}) {
  const {
    publicKey,
    wallet,
    wallets,
    select,
    connect,
    disconnect,
    connecting,
    connected,
  } = useWallet();
  const { setVisible } = useWalletModal();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pendingConnect = useRef(false);

  const pad = size === "md" ? "px-4 py-2.5 text-sm" : "px-3 py-1.5 text-xs";

  // After select(Phantom), adapter mounts async — then connect.
  useEffect(() => {
    if (!pendingConnect.current || !wallet || connected || connecting) return;
    pendingConnect.current = false;
    setBusy(true);
    void connect()
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        if (/user rejected|rejected the request|cancel/i.test(msg)) {
          setErr("Cancelled.");
        } else {
          setErr(msg || "Connect failed.");
          setVisible(true);
        }
      })
      .finally(() => setBusy(false));
  }, [wallet, connected, connecting, connect, setVisible]);

  const handleConnect = useCallback(async () => {
    setErr(null);

    if (!hasPhantomExtension()) {
      window.open("https://phantom.app/download", "_blank", "noopener,noreferrer");
      setErr("Install Phantom, then reload this page.");
      return;
    }

    setBusy(true);
    try {
      if (wallet) {
        await connect();
        return;
      }

      const phantom =
        wallets.find((w) => /phantom/i.test(w.adapter.name)) ?? wallets[0];

      if (phantom) {
        pendingConnect.current = true;
        select(phantom.adapter.name);
        // connect runs in useEffect once wallet is ready
        return;
      }

      setVisible(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/user rejected|rejected the request|cancel/i.test(msg)) {
        setErr("Cancelled.");
      } else {
        setErr(msg || "Connect failed.");
        setVisible(true);
      }
    } finally {
      // keep busy if waiting for select→connect effect
      if (!pendingConnect.current) setBusy(false);
    }
  }, [wallet, wallets, select, connect, setVisible]);

  if (connected && publicKey) {
    const short = `${publicKey.toBase58().slice(0, 4)}…${publicKey
      .toBase58()
      .slice(-4)}`;
    return (
      <button
        type="button"
        onClick={() => void disconnect()}
        className={`inline-flex items-center justify-center gap-2 rounded-full border border-forest/20 bg-mint-soft font-semibold text-forest-deep transition hover:bg-mint ${pad} ${className}`}
        title="Disconnect"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        {short}
        <SignOut size={12} className="opacity-60" />
      </button>
    );
  }

  const loading = busy || connecting;

  return (
    <div className={`inline-flex flex-col items-end gap-1 ${className}`}>
      <button
        type="button"
        disabled={loading}
        onClick={() => void handleConnect()}
        className={`inline-flex items-center justify-center gap-2 rounded-full bg-forest font-semibold text-white transition hover:bg-forest-deep disabled:opacity-60 ${pad}`}
      >
        {loading ? (
          <CircleNotch size={14} className="animate-spin" />
        ) : (
          <Wallet size={14} weight="bold" />
        )}
        {loading ? "Connecting…" : "Connect Wallet"}
      </button>
      {err && (
        <p className="max-w-[12rem] text-right text-[10px] leading-snug text-coral">
          {err}
        </p>
      )}
    </div>
  );
}
