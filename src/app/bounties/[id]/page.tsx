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
import { MediaIntegrityBadge } from "@/components/findback/MediaIntegrityBadge";
import { TrustProof } from "@/components/findback/TrustProof";
import { ArbitrationSetup } from "@/components/findback/ArbitrationSetup";
import { statusBadge, statusLabel } from "@/components/findback/BountyCard";
import {
  FIND_SYMBOL,
  explorerAddressUrl,
  fromAtomic,
} from "@/lib/findback/config";
import {
  bountyPda,
  getConnection,
  type OnChainBounty,
} from "@/lib/findback/program";
import type { ClaimMeta } from "@/lib/findback/store";

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
  const currentClaim = claims.find(
    (claim) => claim.finderWallet === walletAddress,
  );
  const isOwner = Boolean(
    walletAddress &&
    (meta.ownerWallet === walletAddress || onchain?.owner === walletAddress),
  );
  const isFinder = Boolean(
    currentClaim || (walletAddress && onchain?.finder === walletAddress),
  );
  const chainStatus = onchain?.status || meta.status || "Draft";
  const hasDisputedClaim = claims.some(
    (claim) => claim.status?.replaceAll("_", "").toLowerCase() === "disputed",
  );
  const status =
    meta.protocolVersion === 2 && chainStatus === "Funded" && claims.length > 0
      ? hasDisputedClaim
        ? "Disputed"
        : claims.some((claim) => claim.aiReport)
        ? "AiReviewed"
        : "ClaimSubmitted"
      : chainStatus;
  const canClaim = onchain?.status === "Funded" && !isOwner && !currentClaim;
  const canDecide =
    isOwner && ["AiReviewed", "ClaimSubmitted"].includes(status);
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
              label="Program"
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
                label="Bounty PDA"
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
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
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
                Khóa phần thưởng vào escrow
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
            {isFinder &&
              ["ClaimSubmitted", "AiReviewed"].includes(status) &&
              !currentClaim?.aiReport && (
                <button
                  type="button"
                  disabled={busy || txState === "pending"}
                  onClick={() =>
                    void run(async () => {
                      await reviewClaim(id, walletAddress);
                    })
                  }
                  className="app-button-primary w-full"
                >
                  Đánh giá bằng AI trực tuyến
                </button>
              )}
            {(isOwner || isFinder) &&
              ["ClaimSubmitted", "AiReviewed"].includes(status) && (
                <button
                  type="button"
                  disabled={busy || txState === "pending"}
                  onClick={() =>
                    void run(() =>
                      dispute(
                        id,
                        isOwner ? meta.claim?.finderWallet : walletAddress,
                      ),
                    )
                  }
                  className="app-button-secondary w-full"
                >
                  Mở tranh chấp
                </button>
              )}
            {isOwner &&
              onchain &&
              ["Funded", "ClaimSubmitted", "AiReviewed"].includes(status) && (
                <button
                  type="button"
                  disabled={busy || txState === "pending"}
                  onClick={() => void run(() => refund(id))}
                  className="app-button-secondary w-full"
                >
                  Yêu cầu hoàn tiền khi hết hạn
                </button>
              )}
          </div>
          {isOwner &&
          onchain &&
          onchain.protocolVersion >= 2 &&
          onchain.arbitrationMode === 0 &&
          ["Draft", "Funded"].includes(onchain.status) ? (
            <ArbitrationSetup
              bountyId={id}
              leadArbiter={onchain.arbiter}
              onConfigured={reloadChain}
            />
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

      {claims.length > 0 && <ClaimsSection bountyId={id} claims={claims} />}

      {meta.aiReport && (
        <div className="mt-8">
          <AiReviewPanel
            report={meta.aiReport}
            bountyId={id}
            finderWallet={meta.claim?.finderWallet}
            provenance={{
              inputHash: meta.claim?.aiInputHash,
              reportHash: meta.claim?.aiReportHash,
              modelHash: meta.claim?.aiModelHash,
              promptVersion: meta.claim?.aiPromptVersion,
            }}
            canDecide={canDecide}
            busy={busy || txState === "pending"}
            onAccept={() =>
              void run(() => accept(id, meta.claim?.finderWallet))
            }
            onReject={() =>
              void run(() => reject(id, meta.claim?.finderWallet))
            }
            onDispute={() =>
              void run(() => dispute(id, meta.claim?.finderWallet))
            }
          />
        </div>
      )}
      {error && (
        <p
          className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
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
}: {
  bountyId: string;
  claims: ClaimMeta[];
}) {
  return (
    <section className="mt-10" aria-labelledby="claims-title">
      <div className="max-w-2xl">
        <h2 id="claims-title" className="text-2xl font-bold tracking-tight">
          Bằng chứng từ người tìm thấy
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink-soft">
          Mỗi người gửi có một Claim PDA độc lập. Ảnh riêng tư chỉ mở cho các
          bên tham gia giao dịch.
        </p>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
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
                    {claim.aiReport ? "AI đã đánh giá" : "Đang chờ kiểm tra"}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-6 text-ink">
                  {claim.description}
                </p>
                <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="text-ink-muted">Địa điểm tìm thấy</dt>
                    <dd className="mt-1 font-semibold text-ink">
                      {claim.location || "Không cung cấp"}
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
