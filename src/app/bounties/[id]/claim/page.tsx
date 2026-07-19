"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useFindBack } from "@/lib/findback/provider";
import { getBountyMeta } from "@/lib/findback/store";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import type { AiClaimReport } from "@/lib/ai/types";
import { AiReviewPanel } from "@/components/findback/AiPanel";

export default function SubmitClaimPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const router = useRouter();
  const { connected } = useWallet();
  const { bounties, submitClaim, txState } = useFindBack();
  const meta = bounties.find((b) => b.id === id) || getBountyMeta(id);

  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [foundAt, setFoundAt] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [report, setReport] = useState<AiClaimReport | null>(null);

  if (!meta) {
    return <p className="text-white/50">Bounty not found.</p>;
  }

  const onFile = (file: File | null) => {
    if (!file) return;
    if (file.size > 900_000) {
      setErr("Image max ~900KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(String(reader.result));
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    setErr(null);
    if (!connected) {
      setErr("Connect Phantom (Devnet)");
      return;
    }
    if (description.trim().length < 10) {
      setErr("Describe the item / evidence (min 10 chars)");
      return;
    }
    setBusy(true);
    try {
      const r = await submitClaim({
        bountyId: id,
        description: description.trim(),
        location: location.trim() || meta.location,
        foundAt,
        imageDataUrl,
      });
      setReport(r);
      setTimeout(() => router.push(`/bounties/${id}`), 1800);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9945FF]">
          Submit claim
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold">{meta.title}</h1>
        <p className="mt-2 text-sm text-white/55">
          Photos stay off-chain. Only a hash is written on Solana. Do not post
          phone numbers, emails, or private IDs in the public description.
        </p>
      </div>

      {!connected && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <ConnectWalletButton size="md" />
        </div>
      )}

      <div className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <label className="block space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/45">
            Evidence description
          </span>
          <textarea
            className="min-h-[120px] w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-[#9945FF]/50"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What you found, marks, color, brand…"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/45">
            Found location
          </span>
          <input
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={meta.location}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/45">
            Found at
          </span>
          <input
            type="datetime-local"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none"
            value={foundAt}
            onChange={(e) => setFoundAt(e.target.value)}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/45">
            Evidence photo
          </span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            className="text-sm text-white/60"
          />
        </label>

        {err && (
          <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
            {err}
          </p>
        )}

        <button
          type="button"
          disabled={busy || txState === "pending"}
          onClick={() => void submit()}
          className="w-full rounded-full bg-gradient-to-r from-[#9945FF] to-[#14F195] py-3 text-sm font-bold text-black disabled:opacity-50"
        >
          {busy
            ? "Submitting + AI reviewing…"
            : "Submit claim & run AI review"}
        </button>
      </div>

      {report && (
        <AiReviewPanel report={report} canDecide={false} />
      )}
    </div>
  );
}
