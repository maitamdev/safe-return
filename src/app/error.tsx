"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowClockwise, House, WarningCircle } from "@phosphor-icons/react";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[safereturn]", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-xl items-center px-4 py-20">
      <div className="app-card w-full p-7 text-center sm:p-10" role="alert">
        <span className="alert-danger mx-auto flex h-14 w-14 items-center justify-center rounded-2xl">
          <WarningCircle size={30} weight="duotone" />
        </span>
        <h1 className="mt-5 text-2xl font-bold">Đã xảy ra lỗi</h1>
        <p className="mt-3 text-sm leading-6 text-ink-soft">
          Ứng dụng gặp sự cố tạm thời. Giao dịch đã xác nhận trên mạng không bị ảnh hưởng.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-ink-muted">Mã lỗi: {error.digest}</p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => unstable_retry()} className="app-button-primary">
            <ArrowClockwise size={17} /> Thử lại
          </button>
          <Link href="/" className="app-button-secondary">
            <House size={17} /> Trang chủ
          </Link>
        </div>
      </div>
    </main>
  );
}
