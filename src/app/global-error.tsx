"use client";

import { useEffect } from "react";

export default function GlobalRootError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[safereturn/global]", error);
  }, [error]);

  return (
    <html lang="vi">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#0c1411",
          color: "#e8f0ec",
          padding: "1.5rem",
        }}
      >
        <div
          role="alert"
          style={{
            maxWidth: 420,
            width: "100%",
            border: "1px solid #24352e",
            borderRadius: 16,
            padding: "2rem",
            background: "#121c18",
            textAlign: "center",
          }}
        >
          <h1 style={{ margin: 0, fontSize: "1.35rem" }}>SafeReturn gặp lỗi nghiêm trọng</h1>
          <p style={{ marginTop: 12, lineHeight: 1.55, color: "#9aada4", fontSize: 14 }}>
            Hãy tải lại trang. Trạng thái escrow trên Solana Devnet vẫn được giữ nguyên.
          </p>
          {error.digest ? (
            <p style={{ marginTop: 12, fontFamily: "ui-monospace, monospace", fontSize: 12, color: "#7f948a" }}>
              {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              marginTop: 20,
              minHeight: 44,
              padding: "0.65rem 1.1rem",
              borderRadius: 12,
              border: "1px solid #1fad6c",
              background: "#1fad6c",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Thử lại
          </button>
        </div>
      </body>
    </html>
  );
}
