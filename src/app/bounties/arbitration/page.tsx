"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { Gavel, ShieldWarning } from "@phosphor-icons/react";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { ARBITER, FIND_SYMBOL } from "@/lib/findback/config";
import { useFindBack } from "@/lib/findback/provider";

export default function ArbitrationPage() {
  const { publicKey } = useWallet();
  const { bounties, loadingBounties, resolveDispute, txState } = useFindBack();
  const address = publicKey?.toBase58();
  const isArbiter = address === ARBITER;
  const disputed = bounties.filter((bounty) => bounty.status === "Disputed");

  return (
    <div>
      <div className="rounded-3xl bg-forest px-6 py-8 text-white sm:px-9">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/12">
          <Gavel size={24} weight="fill" />
        </div>
        <h1 className="mt-5 text-3xl font-bold tracking-tight">Trung tâm phân xử</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">
          Arbiter xem bằng chứng riêng của hai bên rồi ký quyết định cuối cùng trên Solana Devnet. AI chỉ hỗ trợ đối chiếu, không tự chuyển tiền.
        </p>
      </div>

      {!address && (
        <section className="app-card mt-7 p-6">
          <h2 className="font-bold">Kết nối ví arbiter</h2>
          <p className="mt-2 mb-4 text-sm text-ink-soft">Cần đúng ví arbiter đã ghi trong bounty.</p>
          <ConnectWalletButton size="md" />
        </section>
      )}

      {address && !isArbiter && (
        <section className="mt-7 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
          <div className="flex items-start gap-3">
            <ShieldWarning size={22} className="mt-0.5 shrink-0" />
            <div>
              <h2 className="font-bold">Ví hiện tại không phải arbiter</h2>
              <p className="mt-1 break-all text-sm leading-6">Arbiter Devnet: {ARBITER}</p>
            </div>
          </div>
        </section>
      )}

      <section className="mt-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-forest">Hàng chờ</p>
            <h2 className="mt-2 text-2xl font-bold">Bounty đang tranh chấp</h2>
          </div>
          <span className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink-soft">
            {loadingBounties ? "Đang tải" : `${disputed.length} vụ`}
          </span>
        </div>

        <div className="mt-5 grid gap-4">
          {disputed.map((bounty) => (
            <article key={bounty.id} className="app-card p-5 sm:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-rose-700">Đang tranh chấp</p>
                  <h3 className="mt-2 text-lg font-bold">{bounty.title}</h3>
                  <p className="mt-2 text-sm text-ink-soft">{bounty.location} · {bounty.rewardUi} {FIND_SYMBOL}</p>
                  {bounty.aiReport && <p className="mt-2 text-sm text-ink-soft">AI: {bounty.aiReport.score}/100 · {bounty.aiReport.decision}</p>}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button type="button" disabled={!isArbiter || txState === "pending"} onClick={() => void resolveDispute(bounty.id, true)} className="app-button-primary">Trả FIND cho finder</button>
                  <button type="button" disabled={!isArbiter || txState === "pending"} onClick={() => void resolveDispute(bounty.id, false)} className="app-button-secondary">Hoàn FIND cho owner</button>
                </div>
              </div>
            </article>
          ))}
          {!loadingBounties && disputed.length === 0 && (
            <div className="app-card p-8 text-center text-sm text-ink-soft">Chưa có tranh chấp nào trong dữ liệu bạn được phép xem.</div>
          )}
        </div>
      </section>
    </div>
  );
}
