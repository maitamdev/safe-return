"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowClockwise, House, WarningCircle } from "@phosphor-icons/react";

export default function BountiesError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[safereturn/bounties]", error);
  }, [error]);

  return (
    <div className="app-card mx-auto max-w-xl p-7 text-center sm:p-10" role="alert">
      <span className="alert-danger mx-auto flex h-14 w-14 items-center justify-center rounded-2xl">
        <WarningCircle size={30} weight="duotone" />
      </span>
      <h1 className="mt-5 text-2xl font-bold">Chưa tải được dữ liệu</h1>
      <p className="mt-3 text-sm leading-6 text-ink-soft">
        Kết nối dữ liệu hoặc mạng thử nghiệm có thể đang gián đoạn. Giao dịch đã xác nhận trên mạng không bị mất.
      </p>
      {error.digest && <p className="mt-3 font-mono text-xs text-ink-muted">Mã lỗi: {error.digest}</p>}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => unstable_retry()} className="app-button-primary">
          <ArrowClockwise size={17} /> Thử lại
        </button>
        <Link href="/" className="app-button-secondary"><House size={17} /> Trang chủ</Link>
      </div>
    </div>
  );
}
