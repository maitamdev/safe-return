"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useWallet } from "@solana/wallet-adapter-react";
import { ArrowLeft, Check, ImageSquare, LockKey } from "@phosphor-icons/react";
import { useFindBack } from "@/lib/findback/provider";
import { FIND_SYMBOL } from "@/lib/findback/config";
import { optimizeImage } from "@/lib/images/optimize";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";

const steps = ["Thông tin đồ vật", "Địa điểm và thời hạn", "Phần thưởng", "Xác nhận"];

export default function CreateBountyPage() {
  const router = useRouter();
  const { connected } = useWallet();
  const { createAndFund, txState, findMint } = useFindBack();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Điện tử");
  const [location, setLocation] = useState("");
  const [rewardUi, setRewardUi] = useState(10);
  const [days, setDays] = useState(7);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const bountyIdRef = useRef<string | null>(null);

  const onFile = async (file: File | null) => {
    setError(null);
    if (!file) return;
    setImageBusy(true);
    try {
      const optimized = await optimizeImage(file);
      setImageDataUrl(optimized.dataUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setImageBusy(false);
    }
  };

  const validateStep = () => {
    if (step === 0 && (!title.trim() || description.trim().length < 20)) return "Hãy nhập tên đồ và mô tả ít nhất 20 ký tự.";
    if (step === 1 && !location.trim()) return "Hãy nhập khu vực làm mất đồ.";
    if (step === 1 && (days < 1 || days > 60)) return "Thời hạn nhận thông tin phải từ 1 đến 60 ngày.";
    if (step === 2 && (!Number.isFinite(rewardUi) || rewardUi <= 0)) return "Phần thưởng phải lớn hơn 0 FIND.";
    return null;
  };

  const next = () => {
    const problem = validateStep();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setStep((current) => Math.min(3, current + 1));
  };

  const submit = async () => {
    setError(null);
    if (!connected) {
      setError("Hãy kết nối Phantom ở mạng Devnet trước khi ký.");
      return;
    }
    if (!findMint) {
      setError("Ứng dụng chưa cấu hình mint FIND Devnet.");
      return;
    }
    setBusy(true);
    try {
      const id = bountyIdRef.current ?? `FB-${crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
      bountyIdRef.current = id;
      await createAndFund({ id, title: title.trim(), description: description.trim(), category, location: location.trim(), rewardUi, days, imageDataUrl });
      router.push(`/bounties/${id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/bounties" className="inline-flex items-center gap-2 text-sm font-semibold text-ink-soft hover:text-forest"><ArrowLeft size={16} />Danh sách tin</Link>
      <div className="mt-6">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Đăng tin mất đồ</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
          Mô tả vừa đủ để người khác nhận ra. Giữ riêng một đặc điểm bí mật (số máy, chữ khắc…) để đối chiếu khi có người gửi bằng chứng.
          Phần thưởng sẽ bị khóa đến khi bạn chấp nhận.
        </p>
      </div>

      <ol className="mt-8 grid grid-cols-4 gap-2" aria-label="Tiến độ tạo tin">
        {steps.map((label, index) => (
          <li key={label} className="min-w-0">
            <div className={`h-1.5 rounded-full ${index <= step ? "bg-forest" : "bg-line"}`} />
            <p className={`mt-2 hidden text-xs sm:block ${index === step ? "font-bold text-ink" : "text-ink-muted"}`}>{label}</p>
          </li>
        ))}
      </ol>

      <div className="app-card mt-6 p-5 sm:p-7">
        {step === 0 && (
          <div className="space-y-5">
            <Field label="Tên đồ vật" hint="Tên ngắn và dễ nhận biết."><input className="app-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ví dụ: Laptop Dell XPS màu bạc" maxLength={120} /></Field>
            <Field label="Loại đồ"><select className="app-input" value={category} onChange={(event) => setCategory(event.target.value)}>{["Điện tử", "Laptop", "Điện thoại", "Ví và túi", "Giấy tờ", "Chìa khóa", "Khác"].map((item) => <option key={item}>{item}</option>)}</select></Field>
            <Field label="Mô tả nhận dạng" hint="Viết màu, thương hiệu, vết xước… Đừng ghi SĐT hay mật khẩu. Giữ một chi tiết bí mật ngoài tin để hỏi người tìm thấy."><textarea className="app-input min-h-32 resize-y" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Mô tả những gì người nhặt đồ có thể nhìn thấy" maxLength={1800} /></Field>
            <Field label="Ảnh tham chiếu" hint="Nên có. Ảnh chỉ lưu riêng tư, không đưa nguyên ảnh lên blockchain.">
              <span className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-line-strong bg-bg-deep p-4 text-center hover:border-forest">
                <ImageSquare size={26} className="text-forest" /><span className="mt-2 text-sm font-semibold">{imageBusy ? "Đang tối ưu ảnh" : "Chọn ảnh, tối đa 10 MB"}</span><input type="file" accept="image/*" disabled={imageBusy} className="sr-only" onChange={(event) => void onFile(event.target.files?.[0] ?? null)} />
              </span>
              {imageDataUrl && <div className="mt-3"><Image unoptimized src={imageDataUrl} alt="Ảnh tham chiếu đã chọn" width={960} height={540} className="max-h-56 w-auto rounded-xl object-cover" /></div>}
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <Field label="Khu vực làm mất" hint="Đủ cụ thể để người tìm lọc tin, nhưng không đăng địa chỉ nhà riêng."><input className="app-input" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Ví dụ: Thư viện tầng 2, cơ sở Thủ Đức" maxLength={180} /></Field>
            <Field label="Cho phép gửi thông tin trong" hint="Trong thời gian này, người tìm thấy đồ có thể gửi bằng chứng cho bạn. Khi hết hạn mà chưa trao thưởng, bạn có thể yêu cầu nhận lại FIND."><div className="flex items-center gap-3"><input type="number" min={1} max={60} className="app-input max-w-32" value={days} onChange={(event) => setDays(Number(event.target.value))} aria-label="Số ngày nhận thông tin từ người tìm thấy" /><span className="text-sm text-ink-soft">ngày sau khi đăng tin</span></div></Field>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <Field label={`Phần thưởng (${FIND_SYMBOL})`} hint="FIND là token thử trên Devnet, không phải tiền thật. Dùng để minh họa khóa thưởng."><input type="number" min={0.01} step={0.01} className="app-input max-w-48" value={rewardUi} onChange={(event) => setRewardUi(Number(event.target.value))} /></Field>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900"><div className="flex items-start gap-3"><LockKey size={20} className="mt-0.5 shrink-0" /><p>Bạn ký một lần trên Phantom: đăng tin và khóa thưởng. Tiền chỉ ra khi bạn chấp nhận bằng chứng đúng. SOL Devnet chỉ trả phí mạng.</p></div></div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="text-xl font-bold">Kiểm tra trước khi ký</h2>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <Summary label="Đồ vật" value={title} /><Summary label="Loại" value={category} /><Summary label="Khu vực" value={location} /><Summary label="Nhận thông tin trong" value={`${days} ngày sau khi đăng`} /><Summary label="Phần thưởng" value={`${rewardUi} ${FIND_SYMBOL}`} /><Summary label="Ví" value={connected ? "Đã kết nối Devnet" : "Chưa kết nối"} />
            </dl>
            {!connected && <div className="alert-box-warn mt-6 rounded-xl p-4"><p className="mb-3 text-sm">Kết nối ví để ký một giao dịch Devnet.</p><ConnectWalletButton size="md" /></div>}
          </div>
        )}

        {error && <p className="alert-box-danger mt-5 rounded-xl p-3 text-sm" role="alert">{error}</p>}

        <div className="mt-7 flex items-center justify-between gap-3 border-t border-line pt-5">
          <button type="button" disabled={step === 0 || busy} onClick={() => { setError(null); setStep((current) => Math.max(0, current - 1)); }} className="app-button-secondary">Quay lại</button>
          {step < 3 ? <button type="button" onClick={next} className="app-button-primary">Tiếp tục</button> : <button type="button" disabled={busy || txState === "pending" || !connected} onClick={() => void submit()} className="app-button-primary">{busy ? "Đang chờ Phantom" : <><Check size={17} weight="bold" />Đăng tin và khóa thưởng</>}</button>}
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-sm font-bold text-ink">{label}</span>{hint && <span className="mt-1 block text-xs leading-5 text-ink-muted">{hint}</span>}<span className="mt-2 block">{children}</span></label>;
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-line bg-bg-deep p-4"><dt className="text-xs font-semibold text-ink-muted">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-ink">{value || "Chưa nhập"}</dd></div>;
}
