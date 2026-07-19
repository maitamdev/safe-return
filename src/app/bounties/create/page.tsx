"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useFindBack } from "@/lib/findback/provider";
import { FIND_SYMBOL } from "@/lib/findback/config";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";

function newId() {
  return `FB-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export default function CreateBountyPage() {
  const router = useRouter();
  const { connected } = useWallet();
  const { createAndFund, txState, findMint } = useFindBack();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Electronics");
  const [location, setLocation] = useState("");
  const [rewardUi, setRewardUi] = useState(50);
  const [days, setDays] = useState(7);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);

  const onFile = (file: File | null) => {
    if (!file) return;
    if (file.size > 900_000) {
      setErr("Image max ~900KB");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setErr("Image only");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(String(reader.result));
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    setErr(null);
    if (!connected) {
      setErr("Connect Phantom on Devnet first");
      return;
    }
    if (!findMint) {
      setErr("FIND mint missing — run npm run findback:setup");
      return;
    }
    if (!title.trim() || !description.trim() || !location.trim()) {
      setErr("Fill title, description, location");
      return;
    }
    setBusy(true);
    try {
      const id = newId();
      await createAndFund({
        id,
        title: title.trim(),
        description: description.trim(),
        category,
        location: location.trim(),
        rewardUi,
        days,
        imageDataUrl,
      });
      router.push(`/bounties/${id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const steps = ["Item", "Place & time", "Reward", "Sign"];

  return (
    <div className="mx-auto max-w-xl">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9945FF]">
        Create bounty
      </p>
      <h1 className="mt-1 font-display text-3xl font-bold">
        Lock a FIND reward
      </h1>
      <p className="mt-2 text-sm text-white/55">
        Escrow on Solana Devnet. AI will score claims later — you still approve
        release.
      </p>

      <div className="mt-6 flex gap-2">
        {steps.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => setStep(i)}
            className={`flex-1 rounded-full py-2 text-[11px] font-bold ${
              i === step
                ? "bg-white text-black"
                : i < step
                  ? "bg-[#14F195]/20 text-[#14F195]"
                  : "bg-white/5 text-white/40"
            }`}
          >
            {i + 1}. {s}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        {step === 0 && (
          <>
            <Field label="Item title">
              <input
                className={inputCls}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Laptop Dell XPS bạc"
              />
            </Field>
            <Field label="Category">
              <select
                className={inputCls}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {[
                  "Electronics",
                  "Laptop",
                  "Phone",
                  "Wallet",
                  "ID card",
                  "Other",
                ].map((c) => (
                  <option key={c} value={c} className="bg-[#0b1224]">
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Description (features, marks)">
              <textarea
                className={`${inputCls} min-h-[100px]`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Color, brand, scratches, unique marks…"
              />
            </Field>
            <Field label="Reference photo (off-chain)">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                className="text-sm text-white/60"
              />
              {imageDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageDataUrl}
                  alt=""
                  className="mt-2 h-28 rounded-xl object-cover"
                />
              )}
            </Field>
          </>
        )}

        {step === 1 && (
          <>
            <Field label="Lost location">
              <input
                className={inputCls}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="UEF, Thủ Đức, library…"
              />
            </Field>
            <Field label="Claim deadline (days)">
              <input
                type="number"
                min={1}
                max={60}
                className={inputCls}
                value={days}
                onChange={(e) => setDays(Number(e.target.value) || 7)}
              />
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <Field label={`Reward amount (${FIND_SYMBOL} test token)`}>
              <input
                type="number"
                min={1}
                className={inputCls}
                value={rewardUi}
                onChange={(e) => setRewardUi(Number(e.target.value) || 1)}
              />
            </Field>
            <p className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-100">
              FIND is a <strong>Devnet test SPL token</strong>, not real USDC.
              You need FIND balance in Phantom (import mint after setup).
            </p>
          </>
        )}

        {step === 3 && (
          <div className="space-y-3 text-sm text-white/70">
            <Row k="Title" v={title || "—"} />
            <Row k="Location" v={location || "—"} />
            <Row k="Reward" v={`${rewardUi} ${FIND_SYMBOL}`} />
            <Row k="Deadline" v={`${days} days`} />
            <Row k="Wallet" v={connected ? "Connected" : "Not connected"} />
            {!connected && (
              <div className="pt-2">
                <ConnectWalletButton size="md" />
              </div>
            )}
            <p className="text-xs text-white/45">
              Signing will run <code className="text-[#14F195]">create_bounty</code>{" "}
              then <code className="text-[#14F195]">fund_bounty</code> — real
              Devnet transactions.
            </p>
          </div>
        )}

        {err && (
          <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
            {err}
          </p>
        )}

        <div className="flex justify-between gap-2 pt-2">
          <button
            type="button"
            disabled={step === 0 || busy}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold disabled:opacity-40"
          >
            Back
          </button>
          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="rounded-full bg-white px-5 py-2 text-sm font-bold text-black"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              disabled={busy || txState === "pending"}
              onClick={() => void submit()}
              className="rounded-full bg-gradient-to-r from-[#9945FF] to-[#14F195] px-5 py-2 text-sm font-bold text-black disabled:opacity-50"
            >
              {busy ? "Signing…" : "Create & fund"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-[#9945FF]/50";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-white/45">
        {label}
      </span>
      {children}
    </label>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-white/5 py-2">
      <span className="text-white/40">{k}</span>
      <span className="text-right font-medium text-white">{v}</span>
    </div>
  );
}
