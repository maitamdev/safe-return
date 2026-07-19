"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import type { WalletName } from "@solana/wallet-adapter-base";
import { Wallet, SignOut, CircleNotch } from "@phosphor-icons/react";

type PhantomWindow = Window & {
  phantom?: { solana?: { isPhantom?: boolean; connect?: () => Promise<unknown> } };
  solana?: { isPhantom?: boolean };
};

function hasPhantomInstalled(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as PhantomWindow;
  return Boolean(w.phantom?.solana?.isPhantom || w.solana?.isPhantom);
}

export function ConnectWalletButton({
  className = "",
  size = "sm",
  dark = false,
}: {
  className?: string;
  size?: "sm" | "md";
  dark?: boolean;
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
  const [hint, setHint] = useState<string | null>(null);
  /** After user clicks connect, retry once wallet is selected */
  const pendingRef = useRef(false);

  const pad = size === "md" ? "px-4 py-2.5 text-sm" : "px-3 py-1.5 text-xs";

  const friendly = (e: unknown): string => {
    const msg = e instanceof Error ? e.message : String(e ?? "");
    if (/user rejected|rejected the request|cancel/i.test(msg)) {
      return "Bạn đã hủy trong Phantom. Bấm lại để nối.";
    }
    if (/blocked|malicious|forbidden|not been authorized|unrecognized/i.test(msg)) {
      return "Phantom chặn site mới. Trong popup bấm «Vẫn tiếp tục» rồi Connect.";
    }
    if (/wallet not ready|not found|not installed/i.test(msg)) {
      return "Chưa thấy Phantom. Cài extension → reload trang.";
    }
    if (/unexpected error|failed to connect/i.test(msg)) {
      return "Nối thất bại. Mở Phantom (icon trên Chrome) → unlock → bấm lại.";
    }
    return msg || "Không nối được ví. Thử mở Phantom rồi bấm lại.";
  };

  const doConnect = useCallback(async () => {
    try {
      await connect();
      pendingRef.current = false;
      setHint(null);
    } catch (e) {
      setHint(friendly(e));
      pendingRef.current = false;
    } finally {
      setBusy(false);
    }
  }, [connect]);

  // When user picks Phantom in modal (or select()), auto-run connect
  useEffect(() => {
    if (!pendingRef.current) return;
    if (!wallet || connected || connecting) return;
    const ready =
      wallet.adapter.readyState === WalletReadyState.Installed ||
      wallet.adapter.readyState === WalletReadyState.Loadable;
    if (!ready) {
      setHint("Phantom chưa sẵn sàng. Unlock extension rồi bấm lại.");
      pendingRef.current = false;
      setBusy(false);
      return;
    }
    void doConnect();
  }, [wallet, connected, connecting, doConnect]);

  const handleConnect = useCallback(async () => {
    setHint(null);

    if (!hasPhantomInstalled()) {
      const phantom = wallets.find((w) => /phantom/i.test(w.adapter.name));
      const installed =
        phantom &&
        (phantom.readyState === WalletReadyState.Installed ||
          phantom.readyState === WalletReadyState.Loadable);
      if (!installed) {
        window.open(
          "https://phantom.app/download",
          "_blank",
          "noopener,noreferrer"
        );
        setHint("Cài Phantom extension → reload trang → bấm lại.");
        return;
      }
    }

    setBusy(true);
    pendingRef.current = true;

    // Already selected → connect now
    if (wallet) {
      await doConnect();
      return;
    }

    // Prefer direct select(Phantom) — more reliable than modal-only on some browsers
    const phantom =
      wallets.find((w) => /phantom/i.test(w.adapter.name)) ?? null;

    if (phantom) {
      try {
        select(phantom.adapter.name as WalletName);
        // useEffect above will call connect when wallet state updates
        // Fallback timeout if effect misses
        window.setTimeout(() => {
          if (pendingRef.current && !connected) {
            void doConnect();
          }
        }, 400);
      } catch (e) {
        setHint(friendly(e));
        pendingRef.current = false;
        setBusy(false);
        setVisible(true);
      }
      return;
    }

    // No adapter listed — open modal as last resort
    setVisible(true);
    window.setTimeout(() => {
      if (pendingRef.current && !connected) {
        setBusy(false);
        setHint("Chọn Phantom trong popup. Nếu không hiện gì: unlock Phantom rồi thử lại.");
      }
    }, 8000);
  }, [wallet, wallets, select, doConnect, setVisible, connected]);

  if (connected && publicKey) {
    const short = `${publicKey.toBase58().slice(0, 4)}…${publicKey
      .toBase58()
      .slice(-4)}`;
    return (
      <button
        type="button"
        onClick={() => {
          pendingRef.current = false;
          void disconnect();
        }}
        className={
          dark
            ? `inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/10 font-semibold text-white transition hover:bg-white/15 ${pad} ${className}`
            : `inline-flex items-center justify-center gap-2 rounded-full border border-forest/20 bg-mint-soft font-semibold text-forest-deep transition hover:bg-mint ${pad} ${className}`
        }
        title="Ngắt kết nối"
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
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
        className={
          dark
            ? `inline-flex items-center justify-center gap-2 rounded-full bg-white font-semibold text-black transition hover:bg-white/90 disabled:opacity-60 ${pad}`
            : `inline-flex items-center justify-center gap-2 rounded-full bg-forest font-semibold text-white transition hover:bg-forest-deep disabled:opacity-60 ${pad}`
        }
      >
        {loading ? (
          <CircleNotch size={14} className="animate-spin" />
        ) : (
          <Wallet size={14} weight="bold" />
        )}
        {loading ? "Đang nối…" : "Kết nối ví"}
      </button>
      {hint && (
        <p
          className={`max-w-[18rem] text-right text-[10px] leading-snug ${
            dark ? "text-amber-200" : "text-coral"
          }`}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
