"use client";

import { useState } from "react";
import { Gavel, ShieldCheck } from "@phosphor-icons/react";
import { useFindBack } from "@/lib/findback/provider";

export function ArbitrationSetup({
  bountyId,
  leadArbiter,
  onConfigured,
}: {
  bountyId: string;
  leadArbiter: string;
  onConfigured: () => Promise<void>;
}) {
  const { configureArbitrationPanel, txState } = useFindBack();
  const [second, setSecond] = useState("");
  const [third, setThird] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const configure = async () => {
    setBusy(true);
    setError(null);
    try {
      await configureArbitrationPanel(bountyId, [leadArbiter, second.trim(), third.trim()]);
      await onConfigured();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Chưa cấu hình được hội đồng.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className="mt-5 rounded-xl border border-line bg-bg-deep p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-ink [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2"><Gavel size={18} className="text-forest" /> Bật hội đồng phân xử 2/3</span>
        <span className="text-xs font-semibold text-forest">Thiết lập</span>
      </summary>
      <p className="mt-3 text-xs leading-5 text-ink-soft">
        Ba ví độc lập xem bằng chứng và mỗi ví chỉ được bỏ một phiếu. Cần hai phiếu cùng quyết định mới có thể chốt tranh chấp.
      </p>
      <div className="mt-4 rounded-xl border border-line bg-white p-3">
        <p className="text-[11px] font-semibold text-ink-muted">Trọng tài chính đã cấu hình</p>
        <p className="mt-1 break-all font-mono text-[10px] leading-5 text-ink">{leadArbiter}</p>
      </div>
      <label className="mt-3 block text-xs font-semibold text-ink">Ví trọng tài thứ hai
        <input className="app-input mt-2 font-mono text-xs" value={second} onChange={(event) => setSecond(event.target.value)} placeholder="Địa chỉ ví Solana Devnet" />
      </label>
      <label className="mt-3 block text-xs font-semibold text-ink">Ví trọng tài thứ ba
        <input className="app-input mt-2 font-mono text-xs" value={third} onChange={(event) => setThird(event.target.value)} placeholder="Địa chỉ ví Solana Devnet" />
      </label>
      {error ? <p className="mt-3 text-xs leading-5 text-coral" role="alert">{error}</p> : null}
      <button type="button" disabled={busy || txState === "pending" || !second.trim() || !third.trim()} onClick={() => void configure()} className="app-button-primary mt-4 w-full">
        <ShieldCheck size={17} /> {busy ? "Đang cấu hình" : "Xác nhận hội đồng 2/3"}
      </button>
      <p className="mt-3 text-[11px] leading-5 text-ink-muted">Thiết lập này được khóa trên Solana và không thể thay sau khi tạo panel.</p>
    </details>
  );
}
