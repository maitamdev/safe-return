"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Copy, DownloadSimple, Printer } from "@phosphor-icons/react";

export function SafeTagQr({ code, label }: { code: string; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/t/${code}`;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !url) return;
    void QRCode.toCanvas(canvas, url, {
      width: 220,
      margin: 2,
      errorCorrectionLevel: "H",
      color: { dark: "#073f2b", light: "#ffffff" },
    });
  }, [url]);

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `safetag-${safeFileName(label)}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const print = () => {
    const printWindow = window.open("", "_blank", "width=640,height=760");
    if (!printWindow) return;
    void QRCode.toString(url, {
      type: "svg",
      width: 320,
      margin: 2,
      errorCorrectionLevel: "H",
      color: { dark: "#073f2b", light: "#ffffff" },
    }).then((svg) => {
      printWindow.document.write(`<!doctype html><html lang="vi"><head><title>SafeTag</title><style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;color:#13201c}.card{width:360px;border:2px solid #08784a;border-radius:24px;padding:28px;text-align:center}.brand{font-weight:800;color:#08784a;font-size:20px}.label{font-size:24px;font-weight:800;margin:14px 0 4px}.hint{font-size:14px;color:#5d6d67;margin:0 0 18px}.code{font-family:monospace;font-size:10px;overflow-wrap:anywhere}@media print{.card{break-inside:avoid}}</style></head><body><div class="card"><div class="brand">SafeReturn</div><div class="label">${escapeHtml(label)}</div><p class="hint">Quét mã để báo cho chủ sở hữu</p>${svg}<p class="code">${escapeHtml(url)}</p></div><script>window.onload=()=>window.print()<\/script></body></html>`);
      printWindow.document.close();
    });
  };

  return (
    <div className="rounded-2xl border border-line bg-bg-deep p-4">
      <canvas ref={canvasRef} className="mx-auto h-auto w-full max-w-[220px] rounded-xl bg-white" aria-label={`Mã QR SafeTag cho ${label}`} />
      <div className="mt-4 grid grid-cols-3 gap-2">
        <QrAction icon={Copy} label={copied ? "Đã chép" : "Chép link"} onClick={() => void copy()} />
        <QrAction icon={DownloadSimple} label="Tải PNG" onClick={download} />
        <QrAction icon={Printer} label="In thẻ" onClick={print} />
      </div>
    </div>
  );
}

function QrAction({ icon: Icon, label, onClick }: { icon: typeof Copy; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border border-line bg-bg-elevated px-2 text-[11px] font-semibold text-ink-soft hover:border-forest/40 hover:text-forest"><Icon size={17} aria-hidden /> {label}</button>;
}

function safeFileName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "do-vat";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character);
}
