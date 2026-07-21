"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  ArrowLeft,
  ArrowSquareOut,
  Coins,
  ImageSquare,
  LockKey,
  MapPin,
  Timer,
  UserCircle,
} from "@phosphor-icons/react";
import { useFindBack } from "@/lib/findback/provider";
import { AiReviewPanel } from "@/components/findback/AiPanel";
import { ClaimWorkflowPanel } from "@/components/findback/ClaimWorkflowPanel";
import { MediaIntegrityBadge } from "@/components/findback/MediaIntegrityBadge";
import { TrustProof } from "@/components/findback/TrustProof";
import { ArbitrationSetup } from "@/components/findback/ArbitrationSetup";
import { statusBadge, statusLabel } from "@/components/findback/BountyCard";
import {
  FIND_SYMBOL,
  explorerAddressUrl,
  fromAtomic,
} from "@/lib/findback/config";
import { isActionableOwnerClaim, isPayableClaimStatus } from "@/lib/findback/status";
import {
  bountyPda,
  getConnection,
  type OnChainBounty,
} from "@/lib/findback/program";
import type { ClaimMeta } from "@/lib/findback/store";
import { workflowStatusLabel } from "@/lib/findback/workflow";

const flow = ["Draft", "Funded", "ClaimSubmitted", "AiReviewed", "Released"];

export default function BountyDetailPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const { publicKey } = useWallet();
  const {
    bounties,
    loadingBounties,
    fetchOnChain,
    fund,
    reviewClaim,
    accept,
    reject,
    dispute,
    finalizeRejection,
    timeoutDispute,
    refund,
    cancel,
    txState,
    lastTxUrl,
    programId,
  } = useFindBack();
  const meta = bounties.find((b) => b.id === id);
  const [onchain, setOnchain] = useState<OnChainBounty | null>(null);
  const [chainLoading, setChainLoading] = useState(true);
  const [chainError, setChainError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nowUnix, setNowUnix] = useState(() => Date.now() / 1000);

  useEffect(() => {
    const timer = window.setInterval(() => setNowUnix(Date.now() / 1000), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchOnChain(id)
        .then((result) => {
          if (cancelled) return;
          setOnchain(result);
          setChainError(
            result ? null : "Không tìm thấy tài khoản bounty trên Devnet.",
          );
          setChainLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          setChainError("Không thể đọc Solana Devnet lúc này.");
          setChainLoading(false);
        });
    };
    const connection = getConnection();
    const first = window.setTimeout(load, 0);
    const subscriptionId = connection.onAccountChange(
      bountyPda(id)[0],
      load,
      "confirmed",
    );
    const interval = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearTimeout(first);
      window.clearInterval(interval);
      void connection.removeAccountChangeListener(subscriptionId);
    };
  }, [fetchOnChain, id]);

  if (loadingBounties) return <DetailSkeleton />;
  if (!meta) return <NotFound id={id} />;

  const walletAddress = publicKey?.toBase58();
  const claims = meta.claims?.length
    ? meta.claims
    : meta.claim
      ? [meta.claim]
      : [];
  const activeClaims = claims.filter((claim) =>
    isActionableOwnerClaim(claim.status, claim.workflowStatus),
  );
  const currentClaim = claims.find(
    (claim) => claim.finderWallet === walletAddress,
  );
  const isOwner = Boolean(
    walletAddress &&
    (meta.ownerWallet === walletAddress || onchain?.owner === walletAddress),
  );
  const chainStatus = onchain?.status || meta.status || "Draft";
  const hasDisputedClaim = claims.some(
    (claim) => claim.status?.replaceAll("_", "").toLowerCase() === "disputed",
  );
  const status =
    meta.protocolVersion === 2 && chainStatus === "Funded" && activeClaims.length > 0
      ? hasDisputedClaim
        ? "Disputed"
        : activeClaims.some((claim) => claim.aiReport)
        ? "AiReviewed"
        : "ClaimSubmitted"
      : chainStatus;
  const canClaim =
    onchain?.status === "Funded" &&
    !isOwner &&
    !currentClaim &&
    nowUnix <= (onchain?.deadline ?? meta.deadlineUnix);
  const deadline = new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "long",
  }).format(new Date(meta.deadlineUnix * 1000));

  const reloadChain = async () => {
    setChainLoading(true);
    try {
      const result = await fetchOnChain(id);
      setOnchain(result);
      setChainError(
        result ? null : "Không tìm thấy tài khoản bounty trên Devnet.",
      );
    } catch {
      setChainError("Không thể đọc Solana Devnet lúc này.");
    } finally {
      setChainLoading(false);
    }
  };

  const run = async (action: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await action();
      await reloadChain();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Link
        href="/bounties"
        className="inline-flex items-center gap-2 text-sm font-semibold text-ink-soft hover:text-forest"
      >
        <ArrowLeft size={16} />
        Danh sách tin
      </Link>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          {meta.imageDataUrl ? (
            <Image
              unoptimized
              src={meta.imageDataUrl}
              alt={`Ảnh tham chiếu cho ${meta.title}`}
              width={1200}
              height={675}
              className="aspect-[16/9] w-full rounded-2xl border border-line object-cover shadow-[0_18px_46px_rgba(28,56,43,0.08)]"
            />
          ) : (
            <div className="flex aspect-[16/9] items-center justify-center rounded-2xl border border-line bg-bg-deep text-ink-muted">
              <div className="text-center">
                <ImageSquare size={36} className="mx-auto text-forest" />
                <p className="mt-2 text-sm">Không có ảnh tham chiếu</p>
              </div>
            </div>
          )}
          {meta.media && (
            <div className="mt-3">
              <MediaIntegrityBadge purpose="listing" bountyId={id} />
            </div>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span
              className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${statusBadge(status)}`}
            >
              {statusLabel(status)}
            </span>
            <span className="text-sm text-ink-soft">{meta.category}</span>
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            {meta.title}
          </h1>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-ink-soft">
            {meta.description}
          </p>
          <dl className="mt-6 grid gap-3 text-sm text-ink-soft sm:grid-cols-3">
            <Info icon={MapPin} value={meta.location} />
            <Info icon={Coins} value={`${meta.rewardUi} ${FIND_SYMBOL}`} />
            <Info icon={Timer} value={`Hạn ${deadline}`} />
          </dl>
        </div>

        <aside className="app-card self-start p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Kiểm tra on-chain</h2>
            <button
              type="button"
              onClick={() => void reloadChain()}
              disabled={chainLoading}
              className="text-xs font-bold text-forest hover:underline"
            >
              {chainLoading ? "Đang đọc" : "Làm mới"}
            </button>
          </div>
          <dl className="mt-4 divide-y divide-line">
            <ChainRow
              label="Trạng thái"
              value={
                chainLoading
                  ? "Đang tải"
                  : onchain
                    ? statusLabel(onchain.status)
                    : "Không có dữ liệu"
              }
            />
            <ChainRow
              label="Escrow"
              value={
                onchain
                  ? `${fromAtomic(onchain.amountFunded)} / ${fromAtomic(onchain.rewardAmount)} ${FIND_SYMBOL}`
                  : "Chưa xác minh"
              }
            />
            <ChainRow
              label="Hợp đồng"
              value={
                <a
                  href={explorerAddressUrl(programId)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-forest hover:underline"
                >
                  {programId.slice(0, 8)}…<ArrowSquareOut size={13} />
                </a>
              }
            />
            {onchain && (
              <ChainRow
                label="Mã tin (on-chain)"
                value={
                  <a
                    href={explorerAddressUrl(onchain.address)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-forest hover:underline"
                  >
                    {onchain.address.slice(0, 8)}…<ArrowSquareOut size={13} />
                  </a>
                }
              />
            )}
            {onchain && onchain.aiScore > 0 && (
              <ChainRow label="Điểm đã ghi" value={`${onchain.aiScore}/100`} />
            )}
            {onchain?.protocolVersion && onchain.protocolVersion >= 2 ? (
              <ChainRow
                label="Phân xử"
                value={onchain.arbitrationMode === 1 ? "Hội đồng 2/3" : "Một trọng tài"}
              />
            ) : null}
          </dl>
          {chainError && (
            <p className="alert-box-warn mt-4 rounded-xl p-3 text-xs leading-5">
              {chainError}
            </p>
          )}
          {(meta.lastTxUrl || lastTxUrl) && (
            <a
              href={meta.lastTxUrl || lastTxUrl || "#"}
              target="_blank"
              rel="noreferrer"
              className="app-button-secondary mt-4 w-full"
            >
              Giao dịch gần nhất <ArrowSquareOut size={16} />
            </a>
          )}
          <div className="mt-4 grid gap-2">
            {isOwner && onchain?.status === "Draft" && (
              <button
                type="button"
                disabled={busy || txState === "pending"}
                onClick={() => void run(() => fund(id))}
                className="app-button-primary w-full"
              >
                Khóa phần thưởng
              </button>
            )}
            {isOwner && onchain?.status === "Draft" && (
              <button
                type="button"
                disabled={busy || txState === "pending"}
                onClick={() => void run(() => cancel(id))}
                className="app-button-secondary w-full"
              >
                Hủy bounty chưa nạp tiền
              </button>
            )}
            {canClaim && (
              <Link
                href={`/bounties/${id}/claim`}
                className="app-button-primary w-full"
              >
                Tôi đã tìm thấy đồ
              </Link>
            )}
            {isOwner &&
              onchain &&
              onchain.status === "Funded" &&
              nowUnix > onchain.deadline &&
              onchain.activeClaims === 0 && (
                <button
                  type="button"
                  disabled={busy || txState === "pending"}
                  onClick={() => void run(() => refund(id))}
                  className="app-button-secondary w-full"
                >
                  Yêu cầu hoàn tiền khi hết hạn
                </button>
              )}
            {isOwner &&
            onchain?.status === "Funded" &&
            nowUnix <= onchain.deadline ? (
              <p className="rounded-xl border border-line bg-bg-deep px-3 py-2 text-xs leading-5 text-ink-muted">
                Phần thưởng khóa trong két. Chỉ hoàn lại sau ngày hết hạn và khi không còn bằng chứng đang xử lý.
              </p>
            ) : null}
          </div>
          {isOwner &&
          onchain &&
          onchain.protocolVersion >= 2 &&
          onchain.arbitrationMode === 0 &&
          ["Draft", "Funded"].includes(onchain.status) ? (
            <details className="mt-3 rounded-xl border border-line bg-bg-deep">
              <summary className="cursor-pointer list-none px-3 py-2 text-xs font-bold text-ink-soft">
                Tùy chọn nâng cao: hội đồng 3 người khi tranh chấp
              </summary>
              <div className="border-t border-line p-3">
                <p className="mb-3 text-[11px] leading-5 text-ink-muted">
                  Mặc định dùng một trọng tài. Chỉ bật hội đồng khi bạn cần bỏ phiếu 2/3 cho tranh chấp phức tạp.
                </p>
                <ArbitrationSetup
                  bountyId={id}
                  leadArbiter={onchain.arbiter}
                  onConfigured={reloadChain}
                />
              </div>
            </details>
          ) : null}
        </aside>
      </div>

      <section className="mt-10 border-t border-line pt-8">
        <h2 className="text-lg font-bold">Tiến trình bounty</h2>
        <ol className="mt-5 grid gap-2 sm:grid-cols-5">
          {flow.map((item) => {
            const currentRank = flow.indexOf(
              status === "Accepted" ? "Released" : status,
            );
            const done = currentRank >= flow.indexOf(item);
            return (
              <li
                key={item}
                className={`rounded-xl border px-3 py-3 text-center text-xs font-bold ${done ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-line bg-bg-elevated text-ink-muted"}`}
              >
                {statusLabel(item)}
              </li>
            );
          })}
        </ol>
      </section>

      {onchain &&
        onchain.protocolVersion >= 2 &&
        onchain.status === "Released" &&
        onchain.finder !== "11111111111111111111111111111111" && (
          <TrustProof
            bountyId={id}
            owner={onchain.owner}
            finder={onchain.finder}
          />
        )}

      {isOwner && activeClaims.length > 0 ? (
        <section className="mt-8 flex flex-col gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:flex-row sm:items-center sm:justify-between" aria-labelledby="owner-next-action">
          <div>
            <h2 id="owner-next-action" className="text-base font-bold text-emerald-950">
              Có {activeClaims.length} người gửi bằng chứng — cần bạn xử lý
            </h2>
            <p className="mt-1 text-sm leading-6 text-emerald-800">
              Cách làm an toàn: xem bằng chứng → nhắn tin/hẹn gặp nơi công cộng → nhận đúng đồ → trả thưởng.
              Chỉ trả trước khi nhận đồ nếu bạn chấp nhận rủi ro.
            </p>
          </div>
          <a href="#claims-title" className="app-button-primary shrink-0">Xem bằng chứng</a>
        </section>
      ) : null}

      {claims.length > 0 && (
        <ClaimsSection
          bountyId={id}
          claims={claims}
          rewardUi={meta.rewardUi}
          bountyStatus={chainStatus}
          isOwner={isOwner}
          busy={busy || txState === "pending"}
          onReview={(claim) => void run(async () => { await reviewClaim(id, claim.finderWallet); })}
          onAccept={(claim) => void run(() => accept(id, claim.finderWallet))}
          onReject={(claim) => void run(() => reject(id, claim.finderWallet))}
          onDispute={(claim) => void run(() => dispute(id, claim.finderWallet))}
          onFinalizeRejection={(claim) =>
            void run(() => finalizeRejection(id, claim.finderWallet!))
          }
          onTimeoutDispute={(claim) =>
            void run(() => timeoutDispute(id, claim.finderWallet!))
          }
        />
      )}
      {error && (
        <p
          className="alert-box-danger mt-6 rounded-xl p-4 text-sm"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

function ClaimsSection({
  bountyId,
  claims,
  rewardUi,
  bountyStatus,
  isOwner,
  busy,
  onReview,
  onAccept,
  onReject,
  onDispute,
  onFinalizeRejection,
  onTimeoutDispute,
}: {
  bountyId: string;
  claims: ClaimMeta[];
  rewardUi: number;
  bountyStatus: string;
  isOwner: boolean;
  busy: boolean;
  onReview: (claim: ClaimMeta) => void;
  onAccept: (claim: ClaimMeta) => void;
  onReject: (claim: ClaimMeta) => void;
  onDispute: (claim: ClaimMeta) => void;
  onFinalizeRejection: (claim: ClaimMeta) => void;
  onTimeoutDispute: (claim: ClaimMeta) => void;
}) {
  return (
    <section className="mt-10" aria-labelledby="claims-title">
      <div className="max-w-2xl">
        <h2 id="claims-title" className="text-2xl font-bold tracking-tight">
          Người tìm thấy đã gửi bằng chứng
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink-soft">
          Mỗi người gửi một hồ sơ riêng. Ảnh, địa điểm và tin nhắn chỉ bạn, người gửi và (nếu có) người phân xử được xem.</p>
      </div>
      <div className="mt-5 grid gap-5">
        {claims.map((claim) => {
          const finder = claim.finderWallet || "Chưa xác định";
          return (
            <article
              key={
                claim.id || claim.claimPda || `${finder}-${claim.submittedAt}`
              }
              className="app-card overflow-hidden"
            >
              {claim.imageDataUrl && (
                <Image
                  unoptimized
                  src={claim.imageDataUrl}
                  alt="Ảnh bằng chứng do người tìm thấy gửi"
                  width={960}
                  height={640}
                  className="aspect-[3/2] w-full object-cover"
                />
              )}
              <div className="p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-ink-soft">
                    <UserCircle size={17} className="text-forest" aria-hidden />
                    <span className="font-mono">
                      {finder.length > 18
                        ? `${finder.slice(0, 8)}…${finder.slice(-6)}`
                        : finder}
                    </span>
                  </span>
                  <span className="rounded-lg border border-line bg-bg-deep px-2.5 py-1 text-xs font-bold text-ink-soft">
                    {claim.workflowStatus
                      ? workflowStatusLabel(claim.workflowStatus)
                      : claim.aiReport
                        ? "AI đã đánh giá"
                        : "Đang chờ kiểm tra"}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-6 text-ink">
                  {claim.description}
                </p>
                <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <dt className="inline-flex items-center gap-1.5 text-ink-muted"><LockKey size={14} aria-hidden />Địa điểm tìm thấy (riêng tư)</dt>
                    <dd className="mt-1">
                      <details className="rounded-lg border border-line bg-bg-deep px-3 py-2">
                        <summary className="cursor-pointer font-semibold text-forest">Hiện địa điểm cho người có quyền</summary>
                        <p className="mt-2 font-semibold text-ink">{claim.location || "Không cung cấp"}</p>
                      </details>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">Thời điểm</dt>
                    <dd className="mt-1 font-semibold text-ink">
                      {claim.foundAt || "Không cung cấp"}
                    </dd>
                  </div>
                </dl>
                {claim.media && claim.id && (
                  <div className="mt-4">
                    <MediaIntegrityBadge
                      purpose="claim"
                      bountyId={bountyId}
                      claimId={claim.id}
                    />
                  </div>
                )}
                {claim.evidenceHashHex && (
                  <details className="mt-4 rounded-xl border border-line bg-bg-deep p-3">
                    <summary className="cursor-pointer text-xs font-semibold text-forest">
                      Xem hash bằng chứng
                    </summary>
                    <p className="mt-2 break-all font-mono text-[10px] leading-5 text-ink-muted">
                      {claim.evidenceHashHex}
                    </p>
                  </details>
                )}
                <p className="mt-4 inline-flex items-center gap-2 text-xs text-ink-muted">
                  <LockKey size={15} aria-hidden />
                  Bằng chứng được kiểm tra lại mỗi lần mở
                </p>
                {claim.aiReport ? (
                  <details className="mt-5">
                    <summary className="cursor-pointer text-sm font-bold text-forest">Xem đánh giá AI</summary>
                    <div className="mt-3">
                      <AiReviewPanel
                        titleId={`review-title-${claim.id || claim.claimPda || claim.submittedAt}`}
                        report={claim.aiReport}
                        bountyId={bountyId}
                        finderWallet={claim.finderWallet}
                        provenance={{
                          inputHash: claim.aiInputHash,
                          reportHash: claim.aiReportHash,
                          modelHash: claim.aiModelHash,
                          promptVersion: claim.aiPromptVersion,
                        }}
                        canDecide={false}
                      />
                    </div>
                  </details>
                ) : null}
                {isOwner &&
                isPayableClaimStatus(claim.status, claim.workflowStatus) &&
                !["Released", "Refunded", "Cancelled", "Canceled", "Disputed"].includes(
                  bountyStatus,
                ) ? (
                  <div className="mt-5 rounded-2xl border border-line bg-bg-deep p-4">
                    <p className="text-sm font-bold text-ink">Quyết định của chủ đồ</p>
                    <p className="mt-1 text-xs leading-5 text-ink-soft">
                      Dùng khung bên dưới để chat, hẹn gặp và trả thưởng an toàn.
                      Chỉ ký trả thưởng khi đã tin đúng đồ (tốt nhất sau khi nhận tay).
                    </p>
                  </div>
                ) : null}
                {claim.id ? (
                  <ClaimWorkflowPanel
                    claimId={claim.id}
                    rewardUi={rewardUi}
                    hasAiReport={Boolean(claim.aiReport)}
                    chainStatus={claim.status}
                    bountyStatus={bountyStatus}
                    busy={busy}
                    onReview={() => onReview(claim)}
                    onAccept={() => onAccept(claim)}
                    onReject={() => onReject(claim)}
                    onDispute={() => onDispute(claim)}
                    disputeDeadline={claim.disputeDeadline}
                    resolutionDeadline={claim.resolutionDeadline}
                    onFinalizeRejection={() => onFinalizeRejection(claim)}
                    onTimeoutDispute={() => onTimeoutDispute(claim)}
                  />
                ) : (
                  <p className="alert-box-warn mt-5 rounded-xl p-3 text-xs leading-5">Bằng chứng cũ chưa có mã riêng nên chưa thể mở trao đổi realtime.</p>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Info({ icon: Icon, value }: { icon: typeof MapPin; value: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-line bg-bg-deep p-3">
      <Icon size={17} className="mt-0.5 shrink-0 text-forest" />
      <span>{value}</span>
    </div>
  );
}
function ChainRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 text-sm">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right font-semibold text-ink">{value}</dd>
    </div>
  );
}
function DetailSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div>
        <div className="skeleton aspect-[16/9]" />
        <div className="skeleton mt-5 h-9 w-2/3" />
        <div className="skeleton mt-4 h-4 w-full" />
      </div>
      <div className="app-card space-y-4 p-6">
        <div className="skeleton h-6 w-1/2" />
        <div className="skeleton h-12 w-full" />
        <div className="skeleton h-12 w-full" />
      </div>
    </div>
  );
}
function NotFound({ id }: { id: string }) {
  return (
    <div className="app-card mx-auto max-w-lg p-7 text-center">
      <h1 className="text-xl font-bold">Không tìm thấy tin</h1>
      <p className="mt-2 text-sm leading-6 text-ink-soft">
        Bounty {id || "này"} không tồn tại trong dữ liệu Supabase bạn được phép
        xem.
      </p>
      <Link href="/bounties" className="app-button-primary mt-5">
        Về danh sách
      </Link>
    </div>
  );
}
