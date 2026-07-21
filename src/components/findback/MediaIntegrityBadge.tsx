"use client";

import { useEffect, useState } from "react";
import { CheckCircle, ShieldCheck, WarningCircle } from "@phosphor-icons/react";
import type { MediaPurpose } from "@/lib/media/types";
import { privateMediaUrl } from "@/lib/media/client";

type Verification = {
  verified: boolean;
  network: string;
  sha256: string;
  byteSize: number;
  error?: string;
};

export function MediaIntegrityBadge({
  purpose,
  bountyId,
  claimId,
}: {
  purpose: MediaPurpose;
  bountyId: string;
  claimId?: string;
}) {
  const [state, setState] = useState<"checking" | "verified" | "failed">("checking");
  const [verification, setVerification] = useState<Verification | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(privateMediaUrl({ purpose, bountyId, claimId, mode: "verify" }), {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const result = (await response.json()) as Verification;
        if (!response.ok || !result.verified) {
          throw new Error(result.error || "Không thể xác minh ảnh.");
        }
        setVerification(result);
        setState("verified");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setVerification({
          verified: false,
          network: "Solana Devnet",
          sha256: "",
          byteSize: 0,
          error: error instanceof Error ? error.message : "Không thể xác minh ảnh.",
        });
        setState("failed");
      });
    return () => controller.abort();
  }, [bountyId, claimId, purpose]);

  if (state === "checking") {
    return (
      <div className="inline-flex items-center gap-2 rounded-xl border border-line bg-bg-elevated px-3 py-2 text-xs font-semibold text-ink-soft" role="status">
        <ShieldCheck size={16} aria-hidden />
        Đang đối chiếu hash với Devnet
      </div>
    );
  }

  if (state === "failed") {
    return (
      <div className="alert-box-danger inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold" title={verification?.error} role="alert">
        <WarningCircle size={16} weight="fill" aria-hidden />
        Không xác minh được ảnh
      </div>
    );
  }

  return (
    <div className="alert-box-ok inline-flex max-w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold" title={`SHA-256 ${verification?.sha256}`}>
      <CheckCircle size={16} weight="fill" aria-hidden />
      <span>Ảnh khớp Solana Devnet</span>
      <span className="font-mono text-[10px] opacity-80">
        {verification?.sha256.slice(0, 8)}…{verification?.sha256.slice(-6)}
      </span>
    </div>
  );
}
