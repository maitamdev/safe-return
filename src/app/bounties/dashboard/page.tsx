"use client";

import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { ArrowSquareOut, Plus, QrCode, Tray } from "@phosphor-icons/react";
import { useFindBack } from "@/lib/findback/provider";
import { FIND_SYMBOL } from "@/lib/findback/config";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { statusBadge, statusLabel } from "@/components/findback/BountyCard";

export default function DashboardPage() {
  const { publicKey, connected } = useWallet();
  const { bounties, loadingBounties, lastTxUrl, lastIx, txState } = useFindBack();
  const address = publicKey?.toBase58();
  const owned = address ? bounties.filter((b) => b.ownerWallet === address) : [];
  const claimed = address
    ? bounties.filter(
        (b) =>
          b.claims?.some((c) => c.finderWallet === address) ||
          b.claim?.finderWallet === address,
      )
    : [];
  const totalRewards = owned.reduce((total, bounty) => total + bounty.rewardUi, 0);

  return (
    <div>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Hoạt động của tôi</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">Quản lý tin do ví hiện tại tạo và theo dõi hồ sơ tìm thấy bạn đã gửi.</p>
        </div>
        <div className="flex flex-wrap gap-2"><Link href="/bounties/tags" className="app-button-secondary shrink-0"><QrCode size={17} />SafeTag QR</Link><Link href="/bounties/create" className="app-button-primary shrink-0"><Plus size={17} />Đăng tin mới</Link></div>
      </div>

      {!connected && <div className="app-card mt-8 p-6"><h2 className="text-lg font-bold">Kết nối ví để xem dữ liệu cá nhân</h2><p className="mt-2 mb-4 text-sm text-ink-soft">Tài khoản email xác thực người dùng. Địa chỉ Phantom gắn với tin và hồ sơ trên mạng.</p><ConnectWalletButton size="md" /></div>}

      {connected && (
        <>
          <dl className="mt-8 grid gap-4 sm:grid-cols-3">
            <Stat label="Tin đã tạo" value={loadingBounties ? "Đang tải" : String(owned.length)} />
            <Stat label={`Tổng thưởng đã đặt (${FIND_SYMBOL})`} value={loadingBounties ? "Đang tải" : totalRewards.toLocaleString("vi-VN")} />
            <Stat label="Hồ sơ đã gửi" value={loadingBounties ? "Đang tải" : String(claimed.length)} />
          </dl>

          {lastTxUrl && <a href={lastTxUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-forest hover:underline">Giao dịch gần nhất: {txState === "confirmed" ? "thành công" : txState === "pending" ? "đang xử lý" : txState}{lastIx ? ` · ${lastIx}` : ""}<ArrowSquareOut size={15} /></a>}

          <section className="mt-10">
            <h2 className="text-xl font-bold">Tin do tôi tạo</h2>
            {owned.length > 0 ? <div className="mt-4 grid gap-3">{owned.map((bounty) => <BountyRow key={bounty.id} bounty={bounty} />)}</div> : <Empty text="Ví này chưa đăng tin nào." action="Đăng tin đầu tiên" href="/bounties/create" />}
          </section>

          <section className="mt-10 border-t border-line pt-8">
            <h2 className="text-xl font-bold">Hồ sơ tìm thấy tôi đã gửi</h2>
            {claimed.length > 0 ? <div className="mt-4 grid gap-3">{claimed.map((bounty) => <BountyRow key={bounty.id} bounty={bounty} />)}</div> : <Empty text="Ví này chưa gửi hồ sơ tìm thấy nào." action="Xem tin đang mở" href="/bounties" />}
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="app-card p-5"><dt className="text-sm font-semibold text-ink-soft">{label}</dt><dd className="mt-2 text-2xl font-bold text-ink">{value}</dd></div>; }

function BountyRow({ bounty }: { bounty: ReturnType<typeof useFindBack>["bounties"][number] }) {
  const status = bounty.status || (bounty.aiReport ? "AiReviewed" : bounty.claim ? "ClaimSubmitted" : "Draft");
  return <Link href={`/bounties/${bounty.id}`} className="app-card flex flex-col justify-between gap-4 p-4 transition hover:border-forest/45 sm:flex-row sm:items-center"><div><h3 className="font-bold text-ink">{bounty.title}</h3><p className="mt-1 text-sm text-ink-soft">{bounty.rewardUi} {FIND_SYMBOL} | {bounty.location}</p></div><span className={`self-start rounded-lg border px-2.5 py-1 text-xs font-bold sm:self-auto ${statusBadge(status)}`}>{statusLabel(status)}</span></Link>;
}

function Empty({ text, action, href }: { text: string; action: string; href: string }) { return <div className="app-card mt-4 flex flex-col items-center p-8 text-center"><Tray size={30} className="text-forest" /><p className="mt-3 text-sm text-ink-soft">{text}</p><Link href={href} className="app-button-secondary mt-4">{action}</Link></div>; }
