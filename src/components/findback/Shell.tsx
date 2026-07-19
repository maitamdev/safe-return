"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CheckCircle,
  Gavel,
  House,
  MagnifyingGlass,
  PlusCircle,
  SquaresFour,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { NetworkBadge } from "@/components/wallet/NetworkBadge";
import { TokenBalances } from "@/components/wallet/TokenBalances";
import { UserMenu } from "@/components/auth/UserMenu";
import { useFindBack } from "@/lib/findback/provider";
import { cn } from "@/lib/cn";

const nav = [
  { href: "/bounties", label: "Danh sách", icon: MagnifyingGlass },
  { href: "/bounties/create", label: "Tạo tin", icon: PlusCircle },
  { href: "/bounties/dashboard", label: "Của tôi", icon: SquaresFour },
  { href: "/bounties/arbitration", label: "Phân xử", icon: Gavel },
  { href: "/", label: "Giới thiệu", icon: House },
];

export function FindBackShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { error, clearError, lastTxUrl, lastIx, txState } = useFindBack();

  return (
    <div className="min-h-[100dvh] bg-bg text-ink">
      <header className="sticky top-0 z-40 border-b border-line bg-white/94 backdrop-blur-xl">
        <div className="mx-auto flex h-[4.5rem] max-w-[1440px] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/bounties" className="flex shrink-0 items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest font-bold text-white">SR</span>
            <div className="hidden sm:block">
              <p className="text-sm font-bold leading-none text-forest">SafeReturn</p>
              <p className="mt-1 text-[11px] text-ink-muted">Solana Devnet</p>
            </div>
          </Link>

          <nav className="mx-auto hidden shrink-0 items-center gap-1 xl:flex" aria-label="Điều hướng chính">
            {nav.map((item) => {
              const active = item.href === "/bounties" ? pathname === item.href : item.href !== "/" && pathname.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition", active ? "bg-mint-soft text-forest" : "text-ink-soft hover:bg-bg-deep hover:text-ink")}>
                  <item.icon size={16} weight={active ? "fill" : "regular"} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <div className="hidden shrink-0 items-center gap-2 2xl:flex">
              <NetworkBadge showBalance={false} />
              <TokenBalances />
            </div>
            <UserMenu />
            <ConnectWalletButton compact />
          </div>
        </div>
        <div className="border-t border-line bg-[#fbfcfb] 2xl:hidden">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
            <NetworkBadge showBalance={false} />
            <TokenBalances />
          </div>
        </div>
      </header>

      {(error || txState === "pending" || (txState === "confirmed" && lastTxUrl)) && (
        <div className={cn("border-b", error ? "border-rose-200 bg-rose-50" : txState === "confirmed" ? "border-emerald-200 bg-emerald-50" : "border-line bg-white")} role={error ? "alert" : "status"}>
          <div className="mx-auto flex max-w-7xl items-start gap-2 px-4 py-3 text-sm sm:px-6 lg:px-8">
            {error ? <><WarningCircle size={18} className="mt-0.5 shrink-0 text-rose-700" /><span className="min-w-0 flex-1 text-rose-900">{error}</span><button type="button" onClick={clearError} className="rounded-lg p-1 text-rose-700 hover:bg-rose-100" aria-label="Đóng thông báo"><X size={16} /></button></> : txState === "pending" ? <><span className="mt-1 h-2 w-2 animate-pulse rounded-full bg-forest" /><span className="text-ink">Đang gửi {transactionLabel(lastIx)}. Kiểm tra cửa sổ Phantom để ký.</span></> : txState === "confirmed" && lastTxUrl ? <a href={lastTxUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-semibold text-forest hover:underline"><CheckCircle size={17} weight="fill" />Giao dịch thành công. Mở Solana Explorer</a> : null}
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-6 pb-24 sm:px-6 md:py-10 lg:px-8 xl:pb-12">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-white/98 px-1 py-1.5 shadow-[0_-8px_30px_rgba(28,52,41,0.08)] backdrop-blur-lg xl:hidden" aria-label="Điều hướng di động">
        {nav.map((item) => {
          const active = item.href === "/bounties" ? pathname === item.href : item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold", active ? "bg-mint-soft text-forest" : "text-ink-muted")}><item.icon size={20} weight={active ? "fill" : "regular"} />{item.label}</Link>;
        })}
      </nav>
    </div>
  );
}

function transactionLabel(ix: string | null) {
  const labels: Record<string, string> = {
    create_bounty: "giao dịch tạo bounty",
    fund_bounty: "giao dịch khóa thưởng",
    submit_claim: "bằng chứng lên chuỗi",
    record_ai_review: "kết quả đánh giá lên chuỗi",
    accept_claim: "lệnh trả thưởng",
    reject_claim: "lệnh từ chối claim",
    open_dispute: "yêu cầu tranh chấp",
    refund_after_expiry: "yêu cầu hoàn tiền",
    cancel_bounty: "lệnh hủy bounty",
    resolve_dispute: "quyết định phân xử",
    create_bounty_sponsored: "bounty được tài trợ phí",
    fund_bounty_sponsored: "escrow được tài trợ phí",
    submit_claim_v2_sponsored: "claim được tài trợ phí",
  };
  return ix ? labels[ix] ?? ix : "giao dịch";
}
