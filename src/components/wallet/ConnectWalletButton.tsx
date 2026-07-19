"use client";

import { useCallback, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Wallet, SignOut, CircleNotch } from "@phosphor-icons/react";

export function ConnectWalletButton({
  className = "",
  size = "sm",
  dark = false,
}: {
  className?: string;
  size?: "sm" | "md";
  /** FindBack dark shell */
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

  const pad = size === "md" ? "px-4 py-2.5 text-sm" : "px-3 py-1.5 text-xs";

  const handleConnect = useCallback(async () => {
    setHint(null);
    setBusy(true);
    try {
      const phantom =
        wallets.find((w) => /phantom/i.test(w.adapter.name)) ?? wallets[0];

      if (!phantom && !wallet) {
        window.open(
          "https://phantom.app/download",
          "_blank",
          "noopener,noreferrer"
        );
        setHint("Cài Phantom extension, reload trang, rồi bấm lại.");
        return;
      }

      if (!wallet && phantom) {
        select(phantom.adapter.name);
        // give adapter a tick then connect
        await new Promise((r) => setTimeout(r, 120));
      }

      try {
        await connect();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/user rejected|rejected|cancel/i.test(msg)) {
          setHint("Bạn đã hủy. Bấm lại nếu muốn nối ví.");
        } else if (/blocked|malicious|forbidden|not been authorized/i.test(msg)) {
          setHint(
            "Phantom chặn site mới. Trong popup bấm «Vẫn tiếp tục (không an toàn)» rồi Connect lại."
          );
          setVisible(true);
        } else {
          setHint(msg || "Không nối được ví — mở modal chọn Phantom.");
          setVisible(true);
        }
      }
    } finally {
      setBusy(false);
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
          className={`max-w-[16rem] text-right text-[10px] leading-snug ${
            dark ? "text-amber-200" : "text-coral"
          }`}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
