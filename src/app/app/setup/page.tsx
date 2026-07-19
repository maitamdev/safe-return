"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle,
  PlayCircle,
  ShieldCheck,
} from "@phosphor-icons/react";
import { WalletOnboarding } from "@/components/wallet/WalletOnboarding";
import { Button } from "@/components/ui/Button";
import {
  MOCK_USDC_MINT,
  PROGRAM_ID,
  explorerAddressUrl,
} from "@/lib/solana/config";

export default function SetupPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
          Bắt đầu · 5 phút
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">
          Hướng dẫn dùng SafeReturn
          <span className="block text-forest">không cần biết blockchain</span>
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-soft">
          Bạn chỉ cần ví Phantom (miễn phí) và tiền <em>ảo</em> trên Devnet.
          Toàn bộ giao dịch đều xem được trên Solana Explorer — phục vụ demo
          hackathon, không liên quan tiền thật.
        </p>
      </div>

      <WalletOnboarding forceOpen />

      <section className="double-bezel">
        <div className="double-bezel-inner space-y-4 p-5 md:p-6">
          <h2 className="font-display text-lg font-bold">
            Sau khi đã connect + nạp tiền ảo
          </h2>
          <ol className="space-y-3 text-sm text-ink-soft">
            {[
              {
                t: "Chạy Live Demo (khuyên dùng cho giám khảo)",
                d: "8 bước kể chuyện Quinn mất balo → Mai nhặt → SafePoint trả đồ + thưởng on-chain.",
                href: "/app/demo",
              },
              {
                t: "Hoặc tự tay: Báo mất → AI match → Fund escrow",
                d: "Mỗi nút sẽ bật popup Phantom để bạn Approve (ký tx thật trên Devnet).",
                href: "/app/lost",
              },
              {
                t: "SafePoint desk",
                d: "Nhân viên ký lock OTP + release reward — vẫn là Devnet.",
                href: "/app/safepoint",
              },
            ].map((x, i) => (
              <li
                key={x.href}
                className="flex gap-3 rounded-2xl border border-line bg-white/60 p-3.5"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mint text-sm font-bold text-forest-deep">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{x.t}</p>
                  <p className="mt-0.5 text-xs leading-relaxed">{x.d}</p>
                  <Link
                    href={x.href}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-forest hover:underline"
                  >
                    Mở <ArrowRight size={12} />
                  </Link>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-bg-elevated p-4">
          <ShieldCheck size={22} className="text-forest" weight="duotone" />
          <p className="mt-2 text-sm font-semibold">An toàn</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">
            Devnet SOL không rút ra mainnet được. Đừng bao giờ share seed phrase
            Phantom. App không hỏi seed.
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-bg-elevated p-4">
          <CheckCircle size={22} className="text-forest" weight="duotone" />
          <p className="mt-2 text-sm font-semibold">Đã deploy sẵn</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">
            Program{" "}
            <a
              className="font-mono text-forest underline"
              href={explorerAddressUrl(PROGRAM_ID)}
              target="_blank"
              rel="noreferrer"
            >
              {PROGRAM_ID.slice(0, 8)}…
            </a>
            {MOCK_USDC_MINT && (
              <>
                {" "}
                · mint mock USDC{" "}
                <span className="font-mono">{MOCK_USDC_MINT.slice(0, 8)}…</span>
              </>
            )}
          </p>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button href="/app/demo" icon>
          <span className="inline-flex items-center gap-2">
            <PlayCircle size={18} weight="fill" />
            Vào Live Demo
          </span>
        </Button>
        <Button href="/app" variant="secondary">
          Dashboard
        </Button>
      </div>
    </div>
  );
}
