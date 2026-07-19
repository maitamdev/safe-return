"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";
import { CircleNotch, ShieldCheck, SignOut, Wallet } from "@phosphor-icons/react";

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
    connect,
    disconnect,
    connecting,
    connected,
    signMessage,
  } = useWallet();
  const { setVisible } = useWalletModal();
  const [hint, setHint] = useState<string | null>(null);
  const [verifiedAddress, setVerifiedAddress] = useState<string | null>(null);
  const [serviceReady, setServiceReady] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const pad = size === "md" ? "px-4 py-2.5 text-sm" : "px-3 py-2 text-xs";

  useEffect(() => {
    if (!connected || !publicKey) return;
    let cancelled = false;
    fetch("/api/wallet/status", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as {
          address?: string | null;
          configured?: boolean;
          adminConfigured?: boolean;
          schemaReady?: boolean;
        };
      })
      .then((json) => {
        if (!cancelled) {
          setVerifiedAddress(json?.address || null);
          setServiceReady(
            json?.configured !== false &&
              json?.adminConfigured !== false &&
              json?.schemaReady !== false
          );
        }
      })
      .catch(() => {
        if (!cancelled) setVerifiedAddress(null);
      });
    return () => {
      cancelled = true;
    };
  }, [connected, publicKey]);

  const openWallet = async () => {
    setHint(null);
    if (!wallet) {
      setVisible(true);
      return;
    }
    try {
      await connect();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setHint(
        /rejected|cancel/i.test(message)
          ? "Bạn đã hủy yêu cầu kết nối trong ví."
          : "Không kết nối được. Hãy mở khóa Phantom và chọn mạng Devnet."
      );
    }
  };

  const verifyWallet = async () => {
    if (!publicKey || !signMessage) {
      setHint("Ví này không hỗ trợ ký tin nhắn. Hãy dùng Phantom phiên bản mới.");
      return;
    }
    setHint(null);
    setVerifying(true);
    try {
      const challengeResponse = await fetch("/api/wallet/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: publicKey.toBase58() }),
      });
      const challenge = (await challengeResponse.json()) as {
        message?: string;
        error?: string;
      };
      if (!challengeResponse.ok || !challenge.message) {
        throw new Error(challenge.error || "Không tạo được yêu cầu xác minh.");
      }

      const signature = await signMessage(
        new TextEncoder().encode(challenge.message)
      );
      const verifyResponse = await fetch("/api/wallet/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: publicKey.toBase58(),
          message: challenge.message,
          signature: bs58.encode(signature),
        }),
      });
      const result = (await verifyResponse.json()) as {
        address?: string;
        error?: string;
      };
      if (!verifyResponse.ok || !result.address) {
        throw new Error(result.error || "Không xác minh được ví.");
      }

      setVerifiedAddress(result.address);
      window.dispatchEvent(
        new CustomEvent("safereturn:wallet-verified", { detail: result.address })
      );
      setHint("Đã xác minh quyền sở hữu ví.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setHint(
        /rejected|cancel/i.test(message)
          ? "Bạn đã hủy ký xác minh trong ví."
          : message
      );
    } finally {
      setVerifying(false);
    }
  };

  if (connected && publicKey) {
    const address = publicKey.toBase58();
    const short = `${address.slice(0, 4)}…${address.slice(-4)}`;
    const verified = verifiedAddress === address;

    if (!verified) {
      return (
        <div className={`inline-flex flex-col items-end gap-1.5 ${className}`}>
          <button
            type="button"
            disabled={verifying || !serviceReady}
            onClick={() => void verifyWallet()}
            className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:translate-y-px disabled:cursor-wait disabled:opacity-60 ${
              dark
                ? "bg-amber-300 text-slate-950 hover:bg-amber-200"
                : "bg-amber-100 text-amber-950 hover:bg-amber-200"
            } ${pad}`}
          >
            {verifying ? (
              <CircleNotch size={15} className="animate-spin" />
            ) : (
              <ShieldCheck size={15} weight="bold" />
            )}
            {verifying ? "Đang xác minh" : serviceReady ? `Xác minh ${short}` : "Hệ thống chưa sẵn sàng"}
          </button>
          {!serviceReady && (
            <p className={`max-w-72 text-right text-xs ${dark ? "text-amber-100" : "text-amber-800"}`}>
              Quản trị viên cần hoàn tất secret key và migration Supabase.
            </p>
          )}
          {hint && (
            <p className={`max-w-72 text-right text-xs ${dark ? "text-amber-100" : "text-amber-800"}`}>
              {hint}
            </p>
          )}
        </div>
      );
    }

    return (
      <div className={`inline-flex flex-col items-end gap-1.5 ${className}`}>
        <button
          type="button"
          onClick={() => void disconnect()}
          className={`inline-flex items-center justify-center gap-2 rounded-xl border font-semibold transition active:translate-y-px ${
            dark
              ? "border-white/20 bg-white/10 text-white hover:bg-white/15"
              : "border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
          } ${pad}`}
          title="Ngắt kết nối ví"
        >
          <ShieldCheck size={14} weight="fill" />
          {short}
          <SignOut size={14} />
        </button>
        {hint && (
          <p className={`max-w-72 text-right text-xs ${dark ? "text-emerald-100" : "text-emerald-800"}`}>
            {hint}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`inline-flex flex-col items-end gap-1.5 ${className}`}>
      <button
        type="button"
        disabled={connecting}
        onClick={() => void openWallet()}
        className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:translate-y-px disabled:cursor-wait disabled:opacity-60 ${
          dark
            ? "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
            : "bg-emerald-700 text-white hover:bg-emerald-800"
        } ${pad}`}
      >
        {connecting ? (
          <CircleNotch size={15} className="animate-spin" />
        ) : (
          <Wallet size={15} weight="bold" />
        )}
        {connecting ? "Đang kết nối" : "Kết nối ví"}
      </button>
      {hint && (
        <p className={`max-w-64 text-right text-xs ${dark ? "text-amber-200" : "text-amber-800"}`}>
          {hint}
        </p>
      )}
    </div>
  );
}
