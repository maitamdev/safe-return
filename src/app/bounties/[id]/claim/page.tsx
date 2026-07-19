"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { ArrowLeft, ImageSquare, ShieldWarning } from "@phosphor-icons/react";
import { useFindBack } from "@/lib/findback/provider";
import { getBountyMeta } from "@/lib/findback/store";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import type { AiClaimReport } from "@/lib/ai/types";
import { AiReviewPanel } from "@/components/findback/AiPanel";
import { optimizeImage } from "@/lib/images/optimize";

export default function SubmitClaimPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const { connected } = useWallet();
  const { bounties, submitClaim, txState } = useFindBack();
  const meta = bounties.find((b) => b.id === id) || getBountyMeta(id);
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [foundAt, setFoundAt] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AiClaimReport | null>(null);

  if (!meta) {
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
    if (!foundAt) {
      setError("Hãy chọn thời điểm tìm thấy đồ.");
      return;
    }
    setBusy(true);
    try {
      const result = await submitClaim({ bountyId: id, description: description.trim(), location: location.trim() || meta.location, foundAt, imageDataUrl });
      setReport(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  if (report) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div><h1 className="text-2xl font-bold">Claim đã được ghi nhận</h1><p className="mt-2 text-sm text-ink-soft">Chủ đồ sẽ xem kết quả và quyết định giải ngân.</p></div>
          <Link href={`/bounties/${id}`} className="app-button-primary">Về chi tiết tin</Link>
        </div>
        <AiReviewPanel report={report} canDecide={false} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/bounties/${id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-ink-soft hover:text-forest"><ArrowLeft size={16} />Chi tiết tin</Link>
      <h1 className="mt-6 text-3xl font-bold tracking-tight">Gửi bằng chứng tìm thấy</h1>
      <p className="mt-2 text-lg font-semibold text-forest">{meta.title}</p>
      <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        <ShieldWarning size={21} className="mt-0.5 shrink-0" />
        <p>Không đăng số điện thoại, email, số giấy tờ hoặc chi tiết bí mật. Ảnh ở off-chain; blockchain chỉ nhận hash bằng chứng.</p>
      </div>

      {!connected && <div className="app-card mt-6 p-5"><p className="mb-3 text-sm text-ink-soft">Kết nối ví Devnet để ký claim.</p><ConnectWalletButton size="md" /></div>}

      <div className="app-card mt-6 space-y-5 p-5 sm:p-7">
        <label className="block"><span className="text-sm font-bold">Mô tả đồ bạn tìm thấy</span><span className="mt-1 block text-xs leading-5 text-ink-muted">Nêu màu, thương hiệu, vết xước và đặc điểm nhìn thấy được.</span><textarea className="app-input mt-2 min-h-36 resize-y" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1800} placeholder="Mô tả chi tiết bằng chứng" /></label>
        <label className="block"><span className="text-sm font-bold">Địa điểm tìm thấy</span><input className="app-input mt-2" value={location} onChange={(event) => setLocation(event.target.value)} placeholder={meta.location} maxLength={180} /></label>
        <label className="block"><span className="text-sm font-bold">Thời điểm tìm thấy</span><input type="datetime-local" className="app-input mt-2" value={foundAt} onChange={(event) => setFoundAt(event.target.value)} /></label>
        <label className="block"><span className="text-sm font-bold">Ảnh bằng chứng</span><span className="mt-2 flex min-h-28 flex-col items-center justify-center rounded-xl border border-dashed border-line-strong bg-bg-deep p-4 text-center hover:border-forest"><ImageSquare size={26} className="text-forest" /><span className="mt-2 text-sm font-semibold">{imageBusy ? "Đang tối ưu ảnh" : "Chọn ảnh, tối đa 10 MB"}</span><input type="file" accept="image/*" disabled={imageBusy} className="sr-only" onChange={(event) => void onFile(event.target.files?.[0] ?? null)} /></span></label>
        {imageDataUrl && <div><Image unoptimized src={imageDataUrl} alt="Ảnh bằng chứng đã chọn" width={960} height={540} className="max-h-64 w-auto rounded-xl object-cover" /></div>}
        {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900" role="alert">{error}</p>}
        <button type="button" disabled={busy || txState === "pending" || !connected} onClick={() => void submit()} className="app-button-primary w-full">{busy ? "Đang ghi claim và đánh giá" : "Gửi claim lên Devnet"}</button>
      </div>
    </div>
  );
}

function EmptyMessage({ id }: { id: string }) {
  return <div className="app-card mx-auto max-w-lg p-6 text-center"><h1 className="text-xl font-bold">Không tìm thấy tin</h1><p className="mt-2 text-sm text-ink-soft">Metadata cho bounty {id || "này"} không có trên thiết bị hoặc Supabase.</p><Link href="/bounties" className="app-button-primary mt-5">Về danh sách</Link></div>;
}
