"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useFindBack } from "@/lib/findback/provider";
import { FIND_SYMBOL } from "@/lib/findback/config";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import Link from "next/link";

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
  const [category, setCategory] = useState("Điện tử");
  const [location, setLocation] = useState("");
  const [rewardUi, setRewardUi] = useState(50);
  const [days, setDays] = useState(7);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);

  const onFile = (file: File | null) => {
    if (!file) return;
    if (file.size > 900_000) {
      setErr("Ảnh tối đa ~900KB");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setErr("Chỉ nhận file ảnh");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(String(reader.result));
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    setErr(null);
    if (!connected) {
      setErr("Kết nối Phantom (Devnet) trước khi ký.");
      return;
    }
    if (!findMint) {
      setErr("Thiếu FIND mint — liên hệ admin / chạy setup.");
      return;
    }
    if (!title.trim() || !description.trim() || !location.trim()) {
      setErr("Điền đủ tên đồ, mô tả và nơi mất.");
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

  const steps = ["Đồ vật", "Nơi mất", "Thưởng", "Ký ví"];

  return (
    <div className="mx-auto max-w-xl">
      <Link
        href="/bounties"
        className="text-xs font-medium text-white/40 hover:text-white/70"
      >
        ← Quay lại danh sách
      </Link>
      <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-[#9945FF]">
        Tạo tin
      </p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">
        Đăng tin mất đồ
      </h1>
      <p className="mt-2 text-sm text-white/50">
        Khóa thưởng {FIND_SYMBOL} trên Solana Devnet. AI sẽ chấm claim sau — bạn
        vẫn là người bấm chấp nhận.
      </p>

      <div className="mt-6 flex gap-2">
        {steps.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => setStep(i)}
            className={`flex-1 rounded-full py-2.5 text-[11px] font-bold transition ${
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

      <div className="mt-6 space-y-4 rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-5 md:p-6">
        {step === 0 && (
          <>
            <Field label="Tên đồ vật">
              <input
                className={inputCls}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Laptop Dell XPS bạc"
              />
            </Field>
            <Field label="Loại">
              <select
                className={inputCls}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {[
                  "Điện tử",
                  "Laptop",
                  "Điện thoại",
                  "Ví / túi",
                  "Giấy tờ",
                  "Khác",
                ].map((c) => (
                  <option key={c} value={c} className="bg-[#0b1224]">
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Mô tả (màu, thương hiệu, vết xước…)">
              <textarea
                className={`${inputCls} min-h-[110px]`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Càng chi tiết, AI chấm claim càng chính xác…"
              />
            </Field>
            <Field label="Ảnh tham chiếu (lưu off-chain, không lên chain)">
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
            <Field label="Nơi mất / khu vực">
              <input
                className={inputCls}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="VD: UEF, Thủ Đức, thư viện tầng 2…"
              />
            </Field>
            <Field label="Hạn nhận claim (ngày)">
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
            <Field label={`Số thưởng (${FIND_SYMBOL} test)`}>
              <input
                type="number"
                min={1}
                className={inputCls}
                value={rewardUi}
                onChange={(e) => setRewardUi(Number(e.target.value) || 1)}
              />
            </Field>
            <p className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-100">
              <strong>{FIND_SYMBOL}</strong> là token test trên Devnet — không
              phải tiền thật. Cần số dư trong ví (bấm «Nhận 100 FIND» ở trang
              danh sách).
            </p>
          </>
        )}

        {step === 3 && (
          <div className="space-y-3 text-sm text-white/70">
            <Row k="Đồ" v={title || "—"} />
            <Row k="Nơi" v={location || "—"} />
            <Row k="Thưởng" v={`${rewardUi} ${FIND_SYMBOL}`} />
            <Row k="Hạn" v={`${days} ngày`} />
            <Row k="Ví" v={connected ? "Đã nối Phantom" : "Chưa nối"} />
            {!connected && (
              <div className="pt-2">
                <ConnectWalletButton dark size="md" />
              </div>
            )}
            <p className="rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-white/45">
              Bấm «Tạo & khóa thưởng» sẽ mở Phantom để ký 2 giao dịch thật trên
              Devnet. Có thể xem chữ ký trên Solana Explorer sau khi xong.
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
            className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold disabled:opacity-40"
          >
            Quay lại
          </button>
          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="rounded-full bg-white px-6 py-2.5 text-sm font-bold text-black"
            >
              Tiếp tục
            </button>
          ) : (
            <button
              type="button"
              disabled={busy || txState === "pending"}
              onClick={() => void submit()}
              className="rounded-full bg-gradient-to-r from-[#9945FF] to-[#14F195] px-6 py-2.5 text-sm font-bold text-black disabled:opacity-50"
            >
              {busy ? "Đang ký…" : "Tạo & khóa thưởng"}
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
