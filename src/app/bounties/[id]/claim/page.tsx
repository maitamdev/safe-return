"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { ArrowLeft, ImageSquare, LockKey, ShieldWarning } from "@phosphor-icons/react";
import { useFindBack } from "@/lib/findback/provider";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import type { AiClaimReport } from "@/lib/ai/types";
import { AiReviewPanel } from "@/components/findback/AiPanel";
import { optimizeImage } from "@/lib/images/optimize";

export default function SubmitClaimPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const { connected } = useWallet();
  const { bounties, loadingBounties, submitClaim, txState } = useFindBack();
  const meta = bounties.find((b) => b.id === id);
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [foundAt, setFoundAt] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AiClaimReport | null>(null);
  const [submitted, setSubmitted] = useState(false);
  // Keep last known meta so background bounty polls never unmount the form mid-typing.
  const metaRef = useRef(meta);
  if (meta) metaRef.current = meta;
  const stableMeta = meta ?? metaRef.current;

  if (loadingBounties && !stableMeta) {
    return <div className="app-card mx-auto max-w-2xl p-6 text-sm text-ink-soft">Đang tải dữ liệu từ Supabase...</div>;
  }

  if (!stableMeta) {
    return <EmptyMessage id={id} />;
  }

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

  const submit = async () => {
    setError(null);
    if (!connected) {
      setError("Hãy kết nối Phantom ở mạng Devnet.");
      return;
    }
    if (description.trim().length < 20) {
      setError("Mô tả bằng chứng cần ít nhất 20 ký tự.");
      return;
    }
    if (location.trim().length < 3) {
      setError("Hãy nhập địa điểm bạn thực sự tìm thấy đồ.");
      return;
    }
    if (!foundAt) {
      setError("Hãy chọn thời điểm tìm thấy đồ.");
      return;
    }
    setBusy(true);
    try {
      const result = await submitClaim({ bountyId: id, description: description.trim(), location: location.trim(), foundAt, imageDataUrl });
      setReport(result);
      setSubmitted(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  if (submitted) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div><h1 className="text-2xl font-bold">Claim đã được ghi nhận</h1><p className="mt-2 text-sm text-ink-soft">Chủ đồ sẽ xem kết quả và quyết định giải ngân.</p></div>
          <Link href={`/bounties/${id}`} className="app-button-primary">Về chi tiết tin</Link>
        </div>
        {report && <AiReviewPanel report={report} canDecide={false} />}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/bounties/${id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-ink-soft hover:text-forest"><ArrowLeft size={16} />Chi tiết tin</Link>
      <h1 className="mt-6 text-3xl font-bold tracking-tight">Gửi bằng chứng tìm thấy</h1>
      <p className="mt-2 text-lg font-semibold text-forest">{stableMeta.title}</p>
      <div className="alert-box-warn mt-5 flex items-start gap-3 rounded-xl p-4 text-sm leading-6">
        <ShieldWarning size={21} className="mt-0.5 shrink-0" />
        <p>Không đăng số điện thoại, email, số giấy tờ hoặc chi tiết bí mật. Nội dung, địa điểm, thời gian và ảnh chỉ mở cho bạn, chủ tin và trọng tài được phân công; blockchain chỉ nhận hash bằng chứng.</p>
      </div>

      {!connected && <div className="app-card mt-6 p-5"><p className="mb-3 text-sm text-ink-soft">Kết nối ví Devnet để ký claim.</p><ConnectWalletButton size="md" /></div>}

      <div className="app-card mt-6 space-y-5 p-5 sm:p-7">
        <label className="block"><span className="text-sm font-bold">Mô tả đồ bạn tìm thấy</span><span className="mt-1 block text-xs leading-5 text-ink-muted">Nêu màu, thương hiệu, vết xước và đặc điểm nhìn thấy được.</span><textarea className="app-input mt-2 min-h-36 resize-y" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1800} placeholder="Mô tả chi tiết bằng chứng" /></label>
        <label className="block"><span className="inline-flex items-center gap-1.5 text-sm font-bold"><LockKey size={16} className="text-forest" />Địa điểm tìm thấy <span className="font-normal text-ink-muted">(riêng tư)</span></span><span className="mt-1 block text-xs leading-5 text-ink-muted">Không hiển thị công khai và không tự sao chép địa điểm làm mất.</span><input className="app-input mt-2" name="private-found-location" autoComplete="off" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Ví dụ: Sảnh thư viện, gần quầy bảo vệ" maxLength={180} /></label>
        <label className="block"><span className="text-sm font-bold">Thời điểm tìm thấy</span><input type="datetime-local" className="app-input mt-2" value={foundAt} onChange={(event) => setFoundAt(event.target.value)} /></label>
        <label className="block"><span className="text-sm font-bold">Ảnh bằng chứng <span className="font-normal text-ink-muted">(không bắt buộc)</span></span><span className="mt-1 block text-xs leading-5 text-ink-muted">Không có ảnh, AI chỉ đánh giá mô tả và luôn yêu cầu chủ tin kiểm tra thêm.</span><span className="mt-2 flex min-h-28 flex-col items-center justify-center rounded-xl border border-dashed border-line-strong bg-bg-deep p-4 text-center hover:border-forest"><ImageSquare size={26} className="text-forest" /><span className="mt-2 text-sm font-semibold">{imageBusy ? "Đang tối ưu ảnh" : "Chọn ảnh, tối đa 10 MB"}</span><input type="file" accept="image/*" disabled={imageBusy} className="sr-only" onChange={(event) => void onFile(event.target.files?.[0] ?? null)} /></span></label>
        {imageDataUrl && <div><Image unoptimized src={imageDataUrl} alt="Ảnh bằng chứng đã chọn" width={960} height={540} className="max-h-64 w-auto rounded-xl object-cover" /></div>}
        {error && <p className="alert-box-danger rounded-xl p-3 text-sm" role="alert">{error}</p>}
        <button type="button" disabled={busy || txState === "pending" || !connected} onClick={() => void submit()} className="app-button-primary w-full">{busy ? "Đang ghi bằng chứng" : "Gửi bằng chứng riêng tư"}</button>
      </div>
    </div>
  );
}

function EmptyMessage({ id }: { id: string }) {
  return <div className="app-card mx-auto max-w-lg p-6 text-center"><h1 className="text-xl font-bold">Không tìm thấy tin</h1><p className="mt-2 text-sm text-ink-soft">Bounty {id || "này"} không tồn tại trong dữ liệu Supabase bạn được phép xem.</p><Link href="/bounties" className="app-button-primary mt-5">Về danh sách</Link></div>;
}
