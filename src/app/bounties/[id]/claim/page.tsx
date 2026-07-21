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

  // Cache only for this bounty id (background poll must not unmount form;
  // navigating to another id must not reuse the previous title).
  const metaRef = useRef(meta && meta.id === id ? meta : undefined);
  if (meta && meta.id === id) {
    metaRef.current = meta;
  } else if (metaRef.current?.id !== id) {
    metaRef.current = undefined;
  }
  const stableMeta =
    meta && meta.id === id
      ? meta
      : metaRef.current?.id === id
        ? metaRef.current
        : undefined;

  if (loadingBounties && !stableMeta) {
    return (
      <div className="app-card mx-auto max-w-2xl p-6 text-sm text-ink-soft">
        Đang tải tin...
      </div>
    );
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
      setError("Hãy kết nối ví Phantom (mạng Devnet) trước khi gửi.");
      return;
    }
    if (description.trim().length < 20) {
      setError("Mô tả cần ít nhất 20 ký tự — nêu đặc điểm chỉ người giữ đồ mới biết.");
      return;
    }
    if (location.trim().length < 3) {
      setError("Nhập nơi bạn thực sự tìm thấy đồ (chỉ chủ tin được xem).");
      return;
    }
    if (!foundAt) {
      setError("Chọn thời điểm tìm thấy.");
      return;
    }
    setBusy(true);
    try {
      const result = await submitClaim({
        bountyId: id,
        description: description.trim(),
        location: location.trim(),
        foundAt,
        imageDataUrl,
      });
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
          <div>
            <h1 className="text-2xl font-bold">Đã gửi bằng chứng</h1>
            <p className="mt-2 text-sm text-ink-soft">
              Chủ đồ sẽ xem và liên hệ bạn. Bạn không cần làm gì thêm trừ khi được hỏi hoặc hẹn giao đồ.
            </p>
          </div>
          <Link href={`/bounties/${id}`} className="app-button-primary">
            Theo dõi tin này
          </Link>
        </div>
        {report && <AiReviewPanel report={report} canDecide={false} />}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/bounties/${id}`}
        className="inline-flex items-center gap-2 text-sm font-semibold text-ink-soft hover:text-forest"
      >
        <ArrowLeft size={16} />
        Quay lại tin
      </Link>
      <h1 className="mt-6 text-3xl font-bold tracking-tight">Tôi tìm thấy đồ này</h1>
      <p className="mt-2 text-lg font-semibold text-forest">{stableMeta.title}</p>

      <ol className="app-card mt-5 space-y-2 p-4 text-sm leading-6 text-ink-soft">
        <li>
          <span className="font-bold text-ink">1.</span> Mô tả đúng món đồ bạn đang giữ (màu, vết xước, chữ in…).
        </li>
        <li>
          <span className="font-bold text-ink">2.</span> Nơi và lúc tìm thấy — chỉ chủ tin xem được.
        </li>
        <li>
          <span className="font-bold text-ink">3.</span> Gửi xong chờ chủ tin. Họ hẹn gặp rồi mới trả thưởng.
        </li>
      </ol>

      <div className="alert-box-warn mt-5 flex items-start gap-3 rounded-xl p-4 text-sm leading-6">
        <ShieldWarning size={21} className="mt-0.5 shrink-0" />
        <p>
          Không ghi SĐT, email, số giấy tờ trong mô tả công khai. Ảnh và địa điểm chỉ mở cho bạn và chủ tin.
          Mạng blockchain chỉ lưu mã băm (hash), không lưu ảnh.
        </p>
      </div>

      {!connected && (
        <div className="app-card mt-6 p-5">
          <p className="mb-3 text-sm text-ink-soft">
            Cần ví Phantom ở chế độ <strong>Devnet</strong> để gửi bằng chứng.
          </p>
          <ConnectWalletButton size="md" />
        </div>
      )}

      <div className="app-card mt-6 space-y-5 p-5 sm:p-7">
        <label className="block">
          <span className="text-sm font-bold">Mô tả món đồ bạn đang giữ</span>
          <span className="mt-1 block text-xs leading-5 text-ink-muted">
            Viết đặc điểm nhìn thấy được. Đừng bịa — chủ tin sẽ đối chiếu.
          </span>
          <textarea
            className="app-input mt-2 min-h-36 resize-y"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={1800}
            placeholder="Ví dụ: ví da nâu, góc sờn, có thẻ xe buýt bên trong..."
          />
        </label>
        <label className="block">
          <span className="inline-flex items-center gap-1.5 text-sm font-bold">
            <LockKey size={16} className="text-forest" />
            Nơi tìm thấy <span className="font-normal text-ink-muted">(riêng tư)</span>
          </span>
          <span className="mt-1 block text-xs leading-5 text-ink-muted">
            Chỉ chủ tin thấy. Gặp giao đồ nên chọn nơi công cộng.
          </span>
          <input
            className="app-input mt-2"
            name="private-found-location"
            autoComplete="off"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Ví dụ: sảnh thư viện, gần quầy bảo vệ"
            maxLength={180}
          />
        </label>
        <label className="block">
          <span className="text-sm font-bold">Lúc tìm thấy</span>
          <input
            type="datetime-local"
            className="app-input mt-2"
            value={foundAt}
            onChange={(event) => setFoundAt(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-sm font-bold">
            Ảnh bằng chứng <span className="font-normal text-ink-muted">(nên có)</span>
          </span>
          <span className="mt-1 block text-xs leading-5 text-ink-muted">
            Ảnh rõ giúp chủ tin tin bạn hơn. Che thông tin nhạy cảm trên ảnh nếu cần.
          </span>
          <span className="mt-2 flex min-h-28 flex-col items-center justify-center rounded-xl border border-dashed border-line-strong bg-bg-deep p-4 text-center hover:border-forest">
            <ImageSquare size={26} className="text-forest" />
            <span className="mt-2 text-sm font-semibold">
              {imageBusy ? "Đang xử lý ảnh..." : "Chọn ảnh (tối đa 10 MB)"}
            </span>
            <input
              type="file"
              accept="image/*"
              disabled={imageBusy}
              className="sr-only"
              onChange={(event) => void onFile(event.target.files?.[0] ?? null)}
            />
          </span>
        </label>
        {imageDataUrl && (
          <div>
            <Image
              unoptimized
              src={imageDataUrl}
              alt="Ảnh bằng chứng đã chọn"
              width={960}
              height={540}
              className="max-h-64 w-auto rounded-xl object-cover"
            />
          </div>
        )}
        {error && (
          <p className="alert-box-danger rounded-xl p-3 text-sm" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={busy || txState === "pending" || !connected}
          onClick={() => void submit()}
          className="app-button-primary w-full"
        >
          {busy ? "Đang gửi..." : "Gửi bằng chứng cho chủ tin"}
        </button>
      </div>
    </div>
  );
}

function EmptyMessage({ id }: { id: string }) {
  return (
    <div className="app-card mx-auto max-w-lg p-6 text-center">
      <h1 className="text-xl font-bold">Không tìm thấy tin</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Tin {id ? `${id.slice(0, 8)}…` : "này"} không tồn tại hoặc bạn không có quyền xem.
      </p>
      <Link href="/bounties" className="app-button-primary mt-5">
        Về danh sách tin
      </Link>
    </div>
  );
}
