"use client";

import { useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import {
  ArrowSquareOut,
  HandHeart,
  SealCheck,
  ShieldCheck,
} from "@phosphor-icons/react";
import { explorerAddressUrl, fromAtomic } from "@/lib/findback/config";
import {
  fetchReputation,
  fetchReturnAttestation,
  getConnection,
  reputationPda,
  returnAttestationPda,
  type OnChainReputation,
  type OnChainReturnAttestation,
} from "@/lib/findback/program";

type TrustProofProps = {
  bountyId: string;
  owner: string;
  finder: string;
};

type ProofState = {
  owner: OnChainReputation | null;
  finder: OnChainReputation | null;
  attestation: OnChainReturnAttestation | null;
};

export function TrustProof({ bountyId, owner, finder }: TrustProofProps) {
  const [proof, setProof] = useState<ProofState | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const ownerKey = new PublicKey(owner);
    const finderKey = new PublicKey(finder);
    const load = async () => {
      try {
        const [ownerReputation, finderReputation, attestation] =
          await Promise.all([
            fetchReputation(ownerKey),
            fetchReputation(finderKey),
            fetchReturnAttestation(bountyId, finderKey),
          ]);
        if (!cancelled) {
          setProof({
            owner: ownerReputation,
            finder: finderReputation,
            attestation,
          });
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    };

    const connection = getConnection();
    const addresses = [
      reputationPda(ownerKey)[0],
      reputationPda(finderKey)[0],
      returnAttestationPda(bountyId, finderKey)[0],
    ];
    const first = window.setTimeout(() => void load(), 0);
    const subscriptions = addresses.map((address) =>
      connection.onAccountChange(address, () => void load(), "confirmed"),
    );
    return () => {
      cancelled = true;
      window.clearTimeout(first);
      for (const subscription of subscriptions) {
        void connection.removeAccountChangeListener(subscription);
      }
    };
  }, [bountyId, finder, owner]);

  return (
    <section
      className="mt-8 overflow-hidden rounded-2xl border border-emerald-200 bg-bg-elevated shadow-[0_18px_48px_rgba(17,94,64,0.08)]"
      aria-labelledby="trust-proof-title"
    >
      <div className="flex flex-col gap-4 border-b border-emerald-100 bg-emerald-50/70 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">
            <SealCheck size={17} weight="fill" aria-hidden />
            Bằng chứng hoàn trả
          </p>
          <h2
            id="trust-proof-title"
            className="mt-2 text-xl font-bold tracking-tight text-ink"
          >
            Uy tín được ghi trực tiếp trên Solana
          </h2>
        </div>
        {proof?.attestation ? (
          <a
            href={explorerAddressUrl(proof.attestation.address)}
            target="_blank"
            rel="noreferrer"
            className="app-button-secondary self-start"
          >
            Xem xác nhận trên Explorer <ArrowSquareOut size={16} aria-hidden />
          </a>
        ) : null}
      </div>

      <div className="grid lg:grid-cols-[1fr_1fr_1.15fr]">
        <ReputationColumn
          icon={ShieldCheck}
          eyebrow="Chủ đồ"
          reputation={proof?.owner ?? null}
          totalLabel="Đã trao thưởng"
          total={proof?.owner?.rewardsPaid}
        />
        <ReputationColumn
          icon={HandHeart}
          eyebrow="Người tìm thấy"
          reputation={proof?.finder ?? null}
          totalLabel="Đã nhận thưởng"
          total={proof?.finder?.rewardsEarned}
        />
        <div className="border-t border-line p-5 sm:p-6 lg:border-l lg:border-t-0">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-muted">
            Lần hoàn trả này
          </p>
          {!proof ? (
            <div className="skeleton mt-4 h-20 w-full" />
          ) : proof.attestation ? (
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Metric
                label="Phần thưởng"
                value={`${fromAtomic(proof.attestation.rewardAmount)} FIND`}
              />
              <Metric
                label="Điểm AI lúc chốt"
                value={`${proof.attestation.aiScore}/100`}
              />
              <Metric label="Trạng thái" value="Đã xác thực" />
              <Metric
                label="Thời gian"
                value={new Intl.DateTimeFormat("vi-VN", {
                  dateStyle: "medium",
                }).format(new Date(proof.attestation.settledAt * 1000))}
              />
            </dl>
          ) : (
            <p className="mt-4 text-sm leading-6 text-ink-soft">
              Giao dịch cũ chưa có xác nhận uy tín trên mạng. Không tạo điểm uy tín thay
              thế từ dữ liệu ngoài chuỗi.
            </p>
          )}
          {error ? (
            <p className="mt-3 text-xs text-coral" role="status">
              Chưa đọc được dữ liệu uy tín từ Devnet.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ReputationColumn({
  icon: Icon,
  eyebrow,
  reputation,
  totalLabel,
  total,
}: {
  icon: typeof ShieldCheck;
  eyebrow: string;
  reputation: OnChainReputation | null;
  totalLabel: string;
  total?: bigint;
}) {
  return (
    <div className="border-t border-line p-5 first:border-t-0 sm:p-6 lg:border-t-0 lg:border-r">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-forest">
          <Icon size={21} weight="duotone" aria-hidden />
        </span>
        <div>
          <p className="text-xs font-semibold text-ink-muted">{eyebrow}</p>
          <p className="text-lg font-bold text-ink">
            {reputation
              ? `${reputation.successfulReturns} lần thành công`
              : "Chưa có lịch sử"}
          </p>
        </div>
      </div>
      <p className="mt-4 text-xs text-ink-muted">
        {totalLabel}:{" "}
        <span className="font-semibold text-ink">
          {total === undefined ? "0" : fromAtomic(total)} FIND
        </span>
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="mt-1 font-semibold text-ink">{value}</dd>
    </div>
  );
}
