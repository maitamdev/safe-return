"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import type { AiClaimReport } from "@/lib/ai/types";
import type { BountyMeta } from "./store";
import {
  acceptClaimOnChain,
  acceptClaimV2OnChain,
  cancelBountyOnChain,
  castArbitrationVoteOnChain,
  configureArbitrationPanelOnChain,
  createBountyOnChain,
  fetchBounty,
  fundBountyOnChain,
  finalizeDisputeRejectOnChain,
  finalizeDisputeReleaseOnChain,
  openDisputeOnChain,
  openDisputeV2OnChain,
  openDisputeV3OnChain,
  resolveDisputeOnChain,
  resolveDisputeV2OnChain,
  refundAfterExpiryOnChain,
  rejectClaimOnChain,
  rejectClaimV2OnChain,
  submitClaimOnChain,
  submitClaimV2OnChain,
  type OnChainBounty,
  type WalletLike,
} from "./program";
import {
  FINDBACK_PROGRAM_ID,
  FIND_MINT,
  PROTOCOL_V2_ENABLED,
  SPONSORED_FEES_ENABLED,
  SOLANA_LIVE,
  fromAtomic,
  toAtomic,
} from "./config";
import { sendSponsoredTransaction } from "./sponsored";
import {
  evidenceIntegrityPayload,
  evidenceIntegrityPayloadV2,
  imageDescriptorFromDataUrl,
  metadataIntegrityPayload,
  metadataIntegrityPayloadV2,
} from "./integrity";
import { uploadPrivateMedia } from "@/lib/media/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  fetchBountiesFromSupabase,
  subscribeToBountyChanges,
  syncBountyStateToSupabase,
  syncClaimToSupabase,
  syncBountyToSupabase,
} from "./db";

type TxState = "idle" | "pending" | "confirmed" | "failed";

type FindBackCtx = {
  bounties: BountyMeta[];
  loadingBounties: boolean;
  refresh: () => Promise<void>;
  lastTx: string | null;
  lastTxUrl: string | null;
  lastIx: string | null;
  txState: TxState;
  error: string | null;
  clearError: () => void;
  chainReady: boolean;
  programId: string;
  findMint: string;
  createAndFund: (input: {
    id: string;
    title: string;
    description: string;
    category: string;
    location: string;
    rewardUi: number;
    days: number;
    imageDataUrl?: string | null;
  }) => Promise<void>;
  fund: (bountyId: string) => Promise<void>;
  submitClaim: (input: {
    bountyId: string;
    description: string;
    location: string;
    foundAt: string;
    imageDataUrl?: string | null;
  }) => Promise<AiClaimReport | null>;
  reviewClaim: (bountyId: string, finderWallet?: string) => Promise<AiClaimReport | null>;
  accept: (bountyId: string, finderWallet?: string) => Promise<void>;
  reject: (bountyId: string, finderWallet?: string) => Promise<void>;
  dispute: (bountyId: string, finderWallet?: string) => Promise<void>;
  refund: (bountyId: string) => Promise<void>;
  cancel: (bountyId: string) => Promise<void>;
  resolveDispute: (bountyId: string, releaseToFinder: boolean, finderWallet?: string) => Promise<void>;
  configureArbitrationPanel: (bountyId: string, arbiters: [string, string, string]) => Promise<void>;
  voteArbitration: (bountyId: string, finderWallet: string, releaseToFinder: boolean) => Promise<void>;
  finalizeArbitration: (bountyId: string, finderWallet: string, releaseToFinder: boolean) => Promise<void>;
  fetchOnChain: (bountyId: string) => Promise<OnChainBounty | null>;
};

const Ctx = createContext<FindBackCtx | null>(null);

async function sha256Bytes(text: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(hash);
}

async function requireVerifiedWallet(address: string) {
  const response = await fetch("/api/wallet/status", { cache: "no-store" });
  const json = (await response.json().catch(() => ({}))) as {
    address?: string | null;
    error?: string;
  };
  if (!response.ok || json.address !== address) {
    throw new Error(json.error || "Hãy bấm “Xác minh ví” trước khi thao tác.");
  }
}

export function FindBackProvider({ children }: { children: ReactNode }) {
  const { publicKey, signTransaction, connected } = useWallet();
  const { user } = useAuth();
  const [bounties, setBounties] = useState<BountyMeta[]>([]);
  const bountiesRef = useRef<BountyMeta[]>([]);
  const [loadingBounties, setLoadingBounties] = useState(true);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [lastTxUrl, setLastTxUrl] = useState<string | null>(null);
  const [lastIx, setLastIx] = useState<string | null>(null);
  const [txState, setTxState] = useState<TxState>("idle");
  const [error, setError] = useState<string | null>(null);

  const replaceBounties = useCallback((next: BountyMeta[]) => {
    bountiesRef.current = next;
    setBounties(next);
  }, []);

  const upsertInMemory = useCallback((bounty: BountyMeta) => {
    const next = [
      bounty,
      ...bountiesRef.current.filter((item) => item.id !== bounty.id),
    ].sort((left, right) => right.createdAt - left.createdAt);
    bountiesRef.current = next;
    setBounties(next);
  }, []);

  const currentBounty = useCallback(
    (bountyId: string) => bountiesRef.current.find((item) => item.id === bountyId),
    []
  );

  const refresh = useCallback(async () => {
    if (!user) {
      replaceBounties([]);
      setLoadingBounties(false);
      return;
    }
    setLoadingBounties(true);
    try {
      replaceBounties(await fetchBountiesFromSupabase());
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(`Không tải được dữ liệu thật từ Supabase: ${message}`);
    } finally {
      setLoadingBounties(false);
    }
  }, [replaceBounties, user]);

  useEffect(() => {
    if (!user) {
      const reset = window.setTimeout(() => {
        replaceBounties([]);
        setLoadingBounties(false);
      }, 0);
      return () => window.clearTimeout(reset);
    }
    const first = window.setTimeout(() => void refresh(), 0);
    const unsubscribe = subscribeToBountyChanges(
      () => void refresh(),
      (message) => setError(message)
    );
    const poll = window.setInterval(() => void refresh(), 30_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(poll);
      unsubscribe();
    };
  }, [refresh, replaceBounties, user]);

  const wallet = useMemo((): WalletLike | null => {
    if (!connected || !publicKey || !signTransaction) return null;
    return {
      publicKey,
      signTransaction: async <T extends Transaction>(tx: T) => {
        const signed = await signTransaction(tx);
        return signed as T;
      },
    };
  }, [connected, publicKey, signTransaction]);

  const requireWallet = useCallback(() => {
    if (!wallet)
      throw new Error(
        "Chưa nối ví. Bấm «Kết nối ví» và bảo đảm Phantom đang ở Devnet."
      );
    return wallet;
  }, [wallet]);

  const friendlyError = (raw: string) => {
    const m = raw.toLowerCase();
    if (/request blocked|dapp could be malicious|blocked this request/i.test(raw))
      return "Phantom đã chặn nhầm giao dịch dù Devnet preflight thành công. Không chọn “Proceed anyway”; domain SafeReturn cần được Phantom duyệt lại.";
    if (/user rejected|rejected the request|cancel/i.test(raw))
      return "Bạn đã hủy ký trong Phantom. Bấm lại nếu muốn tiếp tục.";
    if (/blockhash|expired|block height/i.test(m))
      return "Giao dịch hết hạn. Hãy bấm lại lần nữa.";
    if (/insufficient|0x1|insufficient funds|no record of a prior/i.test(m))
      return "Thiếu SOL (phí) hoặc thiếu FIND. Bấm «Nhận 100 FIND» ở trang Browse.";
    if (/already in use|already been processed|custom program error: 0x0/i.test(m))
      return "Bounty id đã tồn tại on-chain. Tạo bounty mới (id khác).";
    if (/attempt to debit|insufficient lamports/i.test(m))
      return "Ví không đủ SOL Devnet. Lấy free tại faucet.solana.com (Devnet).";
    if (/simulation failed|custom program error/i.test(m))
      return `Lỗi smart contract: ${raw.slice(0, 180)}`;
    if (/failed to fetch|network|429|503/i.test(m))
      return "RPC Devnet đang bận. Đợi vài giây rồi thử lại.";
    return raw;
  };

  const runTx = useCallback(
    async <T extends { signature: string; url: string }>(
      ixName: string,
      fn: () => Promise<T>
    ): Promise<T> => {
      setError(null);
      setTxState("pending");
      setLastIx(ixName);
      try {
        const res = await fn();
        setLastTx(res.signature);
        setLastTxUrl(res.url);
        setTxState("confirmed");
        return res;
      } catch (e) {
        setTxState("failed");
        const msg = e instanceof Error ? e.message : String(e);
        const nice = friendlyError(msg);
        setError(nice);
        throw new Error(nice);
      }
    },
    []
  );

  const createAndFund = useCallback(
    async (input: {
      id: string;
      title: string;
      description: string;
      category: string;
      location: string;
      rewardUi: number;
      days: number;
      imageDataUrl?: string | null;
    }) => {
      const w = requireWallet();
      await requireVerifiedWallet(w.publicKey.toBase58());
      if (!SOLANA_LIVE) throw new Error("SOLANA_LIVE is off");
      if (!FIND_MINT) throw new Error("FIND mint not configured");

      let deadlineUnix =
        Math.floor(Date.now() / 1000) + Math.max(1, input.days) * 86400;
      const existing = await fetchBounty(input.id);
      if (existing) {
        if (existing.owner !== w.publicKey.toBase58()) {
          throw new Error("Mã bounty đã thuộc về ví khác.");
        }
        deadlineUnix = existing.deadline;
      }
      const useV2 = existing
        ? existing.protocolVersion >= 2
        : PROTOCOL_V2_ENABLED;
      const imageDescriptor = useV2
        ? await imageDescriptorFromDataUrl(input.imageDataUrl)
        : null;
      const media = useV2 && input.imageDataUrl
        ? await uploadPrivateMedia({
            purpose: "listing",
            bountyId: input.id,
            dataUrl: input.imageDataUrl,
          })
        : null;
      const metaPayload = useV2
        ? metadataIntegrityPayloadV2({
            bountyId: input.id,
            owner: w.publicKey.toBase58(),
            rewardBaseUnits: (existing?.rewardAmount ?? toAtomic(input.rewardUi)).toString(),
            deadlineUnix,
            title: input.title,
            description: input.description,
            category: input.category,
            location: input.location,
            image: imageDescriptor,
          })
        : metadataIntegrityPayload({
            title: input.title,
            description: input.description,
            category: input.category,
            location: input.location,
          });
      const metadataHash = await sha256Bytes(metaPayload);
      const metadataHashHex = Array.from(metadataHash)
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");

      if (existing) {
        const existingMetadataHashHex = Array.from(existing.metadataHash)
          .map((byte) => byte.toString(16).padStart(2, "0"))
          .join("");
        if (existingMetadataHashHex !== metadataHashHex) {
          throw new Error("Metadata Supabase không khớp hash bounty trên Devnet.");
        }
      }

      const meta: BountyMeta = {
        id: input.id,
        title: input.title,
        description: input.description,
        category: input.category,
        location: input.location,
        rewardUi: existing ? fromAtomic(existing.rewardAmount) : input.rewardUi,
        deadlineUnix,
        ownerWallet: w.publicKey.toBase58(),
        imageDataUrl: useV2 ? null : input.imageDataUrl ?? null,
        media,
        protocolVersion: existing?.protocolVersion ?? (useV2 ? 2 : 1),
        createdAt: Date.now(),
        status: existing?.status || "Draft",
        metadataHashHex,
      };

      const created = existing
        ? null
        : SPONSORED_FEES_ENABLED && useV2
          ? await runTx("create_bounty_sponsored", () =>
              sendSponsoredTransaction(w, {
                action: "create_bounty",
                bountyId: input.id,
                rewardUi: input.rewardUi,
                deadlineUnix,
                metadataHashHex,
              })
            )
          : await runTx("create_bounty", () =>
              createBountyOnChain(w, {
                bountyId: input.id,
                rewardUi: input.rewardUi,
                deadlineUnix,
                metadataHash,
              })
            );
      const draft = {
        ...meta,
        lastTx: created?.signature ?? null,
        lastTxUrl: created?.url ?? null,
      };
      if (!user?.id) throw new Error("Phiên đăng nhập đã hết hạn.");
      await syncBountyToSupabase(draft);
      upsertInMemory(draft);

      if (existing?.status === "Funded") {
        await syncBountyStateToSupabase(draft);
        await refresh();
        return;
      }
      if (existing && existing.status !== "Draft") {
        throw new Error(`Bounty đã ở trạng thái ${existing.status}, không thể nạp lại.`);
      }

      const funded = SPONSORED_FEES_ENABLED && useV2
        ? await runTx("fund_bounty_sponsored", () =>
            sendSponsoredTransaction(w, {
              action: "fund_bounty",
              bountyId: input.id,
            })
          )
        : await runTx("fund_bounty", () =>
            fundBountyOnChain(w, input.id, input.rewardUi)
          );

      const saved = {
        ...draft,
        status: "Funded",
        lastTx: funded.signature,
        lastTxUrl: funded.url,
      };
      await syncBountyStateToSupabase(saved);
      upsertInMemory(saved);
      await refresh();
    },
    [requireWallet, runTx, refresh, upsertInMemory, user]
  );

  const fund = useCallback(
    async (bountyId: string) => {
      const w = requireWallet();
      await requireVerifiedWallet(w.publicKey.toBase58());
      const meta = currentBounty(bountyId);
      if (!meta) throw new Error("Không tìm thấy metadata của bounty.");
      const onchain = await fetchBounty(bountyId);
      if (!onchain) throw new Error("Không tìm thấy bounty trên Devnet.");
      const remaining = onchain.rewardAmount - onchain.amountFunded;
      if (remaining <= BigInt(0)) throw new Error("Bounty đã được nạp đủ phần thưởng.");
      const useSponsored =
        SPONSORED_FEES_ENABLED && onchain.protocolVersion >= 2;
      const result = useSponsored
        ? await runTx("fund_bounty_sponsored", () =>
            sendSponsoredTransaction(w, {
              action: "fund_bounty",
              bountyId,
            })
          )
        : await runTx("fund_bounty", () =>
            fundBountyOnChain(w, bountyId, fromAtomic(remaining))
          );
      const updated = {
        ...meta,
        status: "Funded",
        lastTx: result.signature,
        lastTxUrl: result.url,
      };
      await syncBountyStateToSupabase(updated);
      upsertInMemory(updated);
      await refresh();
    },
    [currentBounty, requireWallet, runTx, refresh, upsertInMemory]
  );

  const reviewClaim = useCallback(
    async (bountyId: string, finderWallet?: string) => {
      const meta = currentBounty(bountyId);
      if (!meta) throw new Error("Không tìm thấy bounty trong Supabase.");
      const targetClaim = finderWallet
        ? meta.claims?.find((claim) => claim.finderWallet === finderWallet)
        : meta.claim;
      if (!targetClaim) throw new Error("Chưa có bằng chứng claim để đánh giá.");
      let report: AiClaimReport | null = null;
      const result = await runTx("record_ai_review", async () => {
        const response = await fetch("/api/ai/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bountyId, claimId: targetClaim.id }),
        });
        const json = (await response.json()) as {
          report?: AiClaimReport;
          reviewTx?: { signature: string; url: string };
          error?: string;
        };
        if (!response.ok || !json.report || !json.reviewTx) {
          throw new Error(json.error || "AI review failed");
        }
        report = json.report;
        return json.reviewTx;
      });
      const updated: BountyMeta = {
        ...meta,
        aiReport: report,
        status: "AiReviewed",
        lastTx: result.signature,
        lastTxUrl: result.url,
      };
      upsertInMemory(updated);
      await refresh();
      return report;
    },
    [currentBounty, refresh, runTx, upsertInMemory]
  );

  const submitClaim = useCallback(
    async (input: {
      bountyId: string;
      description: string;
      location: string;
      foundAt: string;
      imageDataUrl?: string | null;
    }) => {
      const w = requireWallet();
      await requireVerifiedWallet(w.publicKey.toBase58());
      const meta = currentBounty(input.bountyId);
      if (!meta) throw new Error("Không tìm thấy bounty trong Supabase.");

      const onchain = await fetchBounty(input.bountyId);
      if (!onchain) throw new Error("Không tìm thấy bounty trên Solana Devnet.");
      const useV2 = onchain.protocolVersion >= 2 && PROTOCOL_V2_ENABLED;
      const imageDescriptor = useV2
        ? await imageDescriptorFromDataUrl(input.imageDataUrl)
        : null;
      const media = useV2 && input.imageDataUrl
        ? await uploadPrivateMedia({
            purpose: "claim",
            bountyId: input.bountyId,
            dataUrl: input.imageDataUrl,
          })
        : null;
      const evidencePayload = useV2
        ? evidenceIntegrityPayloadV2({
            bountyId: input.bountyId,
            description: input.description,
            location: input.location,
            foundAt: input.foundAt,
            image: imageDescriptor,
            finder: w.publicKey.toBase58(),
          })
        : evidenceIntegrityPayload({
            description: input.description,
            location: input.location,
            foundAt: input.foundAt,
            imageDataUrl: input.imageDataUrl,
            finder: w.publicKey.toBase58(),
          });
      const evidenceHash = await sha256Bytes(evidencePayload);
      const evidenceHashHex = Array.from(evidenceHash)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const claimTx = useV2
        ? SPONSORED_FEES_ENABLED
          ? await runTx("submit_claim_v2_sponsored", () =>
              sendSponsoredTransaction(w, {
                action: "submit_claim_v2",
                bountyId: input.bountyId,
                evidenceHashHex,
              })
            )
          : await runTx("submit_claim_v2", () =>
              submitClaimV2OnChain(w, input.bountyId, evidenceHash)
            )
        : await runTx("submit_claim", () =>
            submitClaimOnChain(w, input.bountyId, evidenceHash)
          );
      const claimPda = useV2
        ? (claimTx as { signature: string; url: string; claimPda: string }).claimPda
        : null;

      const submitted: BountyMeta = {
        ...meta,
        claim: {
          finderWallet: w.publicKey.toBase58(),
          description: input.description,
          location: input.location,
          foundAt: input.foundAt,
          imageDataUrl: useV2 ? null : input.imageDataUrl ?? null,
          media,
          protocolVersion: useV2 ? 2 : 1,
          claimPda,
          submittedAt: Date.now(),
          evidenceHashHex,
        },
        aiReport: null,
        status: "ClaimSubmitted",
        lastTx: claimTx.signature,
        lastTxUrl: claimTx.url,
      };
      await syncClaimToSupabase(submitted);
      upsertInMemory(submitted);
      await refresh();
      return null;
    },
    [currentBounty, requireWallet, runTx, refresh, upsertInMemory]
  );

  const accept = useCallback(
    async (bountyId: string, finderWallet?: string) => {
      const w = requireWallet();
      await requireVerifiedWallet(w.publicKey.toBase58());
      const meta = currentBounty(bountyId);
      if (!meta) throw new Error("Không tìm thấy bounty trong Supabase.");
      const onchain = await fetchBounty(bountyId);
      const targetClaim = finderWallet
        ? meta.claims?.find((claim) => claim.finderWallet === finderWallet)
        : meta.claim;
      const finderStr =
        targetClaim?.finderWallet ||
        (onchain?.finder &&
        onchain.finder !== "11111111111111111111111111111111"
          ? onchain.finder
          : undefined);
      if (!finderStr) throw new Error("No finder on claim");
      const useV2 = PROTOCOL_V2_ENABLED && Boolean(onchain?.protocolVersion && onchain.protocolVersion >= 2);
      const res = useV2
        ? await runTx("accept_claim_v2", () =>
            acceptClaimV2OnChain(w, bountyId, new PublicKey(finderStr))
          )
        : await runTx("accept_claim", () =>
            acceptClaimOnChain(w, bountyId, new PublicKey(finderStr))
          );
      const updated = { ...meta, status: "Released", lastTx: res.signature, lastTxUrl: res.url };
      await syncBountyStateToSupabase(updated, targetClaim);
      upsertInMemory(updated);
      await refresh();
    },
    [currentBounty, requireWallet, runTx, refresh, upsertInMemory]
  );

  const reject = useCallback(
    async (bountyId: string, finderWallet?: string) => {
      const w = requireWallet();
      await requireVerifiedWallet(w.publicKey.toBase58());
      const meta = currentBounty(bountyId);
      if (!meta) throw new Error("Không tìm thấy bounty trong Supabase.");
      const onchain = await fetchBounty(bountyId);
      const targetClaim = finderWallet
        ? meta.claims?.find((claim) => claim.finderWallet === finderWallet)
        : meta.claim;
      const useV2 = PROTOCOL_V2_ENABLED && Boolean(onchain?.protocolVersion && onchain.protocolVersion >= 2);
      if (useV2 && !targetClaim?.finderWallet) throw new Error("Không tìm thấy finder của Claim PDA.");
      const res = useV2
        ? await runTx("reject_claim_v2", () =>
            rejectClaimV2OnChain(w, bountyId, new PublicKey(targetClaim!.finderWallet!))
          )
        : await runTx("reject_claim", () => rejectClaimOnChain(w, bountyId));
      const updated = {
        ...meta,
        status: "Funded",
        claim: null,
        aiReport: null,
        lastTx: res.signature,
        lastTxUrl: res.url,
      };
      await syncBountyStateToSupabase(updated, targetClaim);
      upsertInMemory(updated);
      await refresh();
    },
    [currentBounty, requireWallet, runTx, refresh, upsertInMemory]
  );

  const dispute = useCallback(
    async (bountyId: string, finderWallet?: string) => {
      const w = requireWallet();
      await requireVerifiedWallet(w.publicKey.toBase58());
      const meta = currentBounty(bountyId);
      if (!meta) throw new Error("Không tìm thấy bounty trong Supabase.");
      const onchain = await fetchBounty(bountyId);
      const targetClaim = finderWallet
        ? meta.claims?.find((claim) => claim.finderWallet === finderWallet)
        : meta.claim;
      const useV2 = PROTOCOL_V2_ENABLED && Boolean(onchain?.protocolVersion && onchain.protocolVersion >= 2);
      if (useV2 && !targetClaim?.finderWallet) throw new Error("Không tìm thấy finder của Claim PDA.");
      const result = useV2
        ? onchain?.arbitrationMode === 1
          ? await runTx("open_dispute_v3", () =>
              openDisputeV3OnChain(w, bountyId, new PublicKey(targetClaim!.finderWallet!))
            )
          : await runTx("open_dispute_v2", () =>
              openDisputeV2OnChain(w, bountyId, new PublicKey(targetClaim!.finderWallet!))
            )
        : await runTx("open_dispute", () => openDisputeOnChain(w, bountyId));
      const updated = { ...meta, status: "Disputed", lastTx: result.signature, lastTxUrl: result.url };
      await syncBountyStateToSupabase(updated, targetClaim);
      upsertInMemory(updated);
      await refresh();
    },
    [currentBounty, requireWallet, runTx, refresh, upsertInMemory]
  );

  const refund = useCallback(
    async (bountyId: string) => {
      const w = requireWallet();
      await requireVerifiedWallet(w.publicKey.toBase58());
      const meta = currentBounty(bountyId);
      if (!meta) throw new Error("Không tìm thấy bounty trong Supabase.");
      const res = await runTx("refund_after_expiry", () =>
        refundAfterExpiryOnChain(w, bountyId)
      );
      const updated = { ...meta, status: "Refunded", lastTx: res.signature, lastTxUrl: res.url };
      await syncBountyStateToSupabase(updated);
      upsertInMemory(updated);
      await refresh();
    },
    [currentBounty, requireWallet, runTx, refresh, upsertInMemory]
  );

  const cancel = useCallback(
    async (bountyId: string) => {
      const w = requireWallet();
      await requireVerifiedWallet(w.publicKey.toBase58());
      const meta = currentBounty(bountyId);
      if (!meta) throw new Error("Không tìm thấy bounty trong Supabase.");
      const result = await runTx("cancel_bounty", () =>
        cancelBountyOnChain(w, bountyId)
      );
      const updated = { ...meta, status: "Cancelled", lastTx: result.signature, lastTxUrl: result.url };
      await syncBountyStateToSupabase(updated);
      upsertInMemory(updated);
      await refresh();
    },
    [currentBounty, requireWallet, runTx, refresh, upsertInMemory]
  );

  const resolveDispute = useCallback(
    async (bountyId: string, releaseToFinder: boolean, finderWallet?: string) => {
      const w = requireWallet();
      await requireVerifiedWallet(w.publicKey.toBase58());
      const meta = currentBounty(bountyId);
      if (!meta) throw new Error("Không tìm thấy bounty trong Supabase.");
      const onchain = await fetchBounty(bountyId);
      if (!onchain) throw new Error("Không tìm thấy bounty trên Devnet.");
      const targetClaim = finderWallet
        ? meta.claims?.find((claim) => claim.finderWallet === finderWallet)
        : meta.claim;
      const useV2 = PROTOCOL_V2_ENABLED && onchain.protocolVersion >= 2;
      if (useV2 && onchain.arbitrationMode === 1) {
        throw new Error("Bounty này dùng hội đồng 2/3. Hãy bỏ phiếu trên trang Phân xử.");
      }
      if (useV2 && !targetClaim?.finderWallet) throw new Error("Không tìm thấy finder của Claim PDA.");
      const result = useV2
        ? await runTx("resolve_dispute_v2", () =>
            resolveDisputeV2OnChain(
              w,
              bountyId,
              new PublicKey(targetClaim!.finderWallet!),
              releaseToFinder
            )
          )
        : await runTx("resolve_dispute", () => {
            const counterparty = new PublicKey(
              releaseToFinder ? onchain.finder : onchain.owner
            );
            return resolveDisputeOnChain(w, bountyId, counterparty, releaseToFinder);
          });
      const updated = {
        ...meta,
        status: releaseToFinder ? "Released" : useV2 ? "Funded" : "Refunded",
        lastTx: result.signature,
        lastTxUrl: result.url,
      };
      await syncBountyStateToSupabase(updated, targetClaim);
      upsertInMemory(updated);
      await refresh();
    },
    [currentBounty, requireWallet, runTx, refresh, upsertInMemory]
  );

  const configureArbitrationPanel = useCallback(
    async (bountyId: string, arbiters: [string, string, string]) => {
      const w = requireWallet();
      await requireVerifiedWallet(w.publicKey.toBase58());
      const parsed = arbiters.map((address) => new PublicKey(address)) as [
        PublicKey,
        PublicKey,
        PublicKey,
      ];
      if (new Set(parsed.map((address) => address.toBase58())).size !== 3) {
        throw new Error("Ba trọng tài phải là ba ví khác nhau.");
      }
      if (parsed.some((address) => address.equals(w.publicKey))) {
        throw new Error("Chủ bounty không thể nằm trong hội đồng phân xử.");
      }
      await runTx("configure_arbitration_panel", () =>
        configureArbitrationPanelOnChain(w, bountyId, parsed)
      );
    },
    [requireWallet, runTx]
  );

  const voteArbitration = useCallback(
    async (bountyId: string, finderWallet: string, releaseToFinder: boolean) => {
      const w = requireWallet();
      await requireVerifiedWallet(w.publicKey.toBase58());
      await runTx("cast_arbitration_vote", () =>
        castArbitrationVoteOnChain(
          w,
          bountyId,
          new PublicKey(finderWallet),
          releaseToFinder
        )
      );
    },
    [requireWallet, runTx]
  );

  const finalizeArbitration = useCallback(
    async (bountyId: string, finderWallet: string, releaseToFinder: boolean) => {
      const w = requireWallet();
      await requireVerifiedWallet(w.publicKey.toBase58());
      const meta = currentBounty(bountyId);
      if (!meta) throw new Error("Không tìm thấy bounty trong Supabase.");
      const targetClaim = meta.claims?.find(
        (claim) => claim.finderWallet === finderWallet
      ) || meta.claim;
      const finder = new PublicKey(finderWallet);
      const result = releaseToFinder
        ? await runTx("finalize_dispute_release", () =>
            finalizeDisputeReleaseOnChain(w, bountyId, finder)
          )
        : await runTx("finalize_dispute_reject", () =>
            finalizeDisputeRejectOnChain(w, bountyId, finder)
          );
      const updated = {
        ...meta,
        status: releaseToFinder ? "Released" : "Funded",
        lastTx: result.signature,
        lastTxUrl: result.url,
      };
      await syncBountyStateToSupabase(updated, targetClaim);
      upsertInMemory(updated);
      await refresh();
    },
    [currentBounty, refresh, requireWallet, runTx, upsertInMemory]
  );

  const value: FindBackCtx = {
    bounties,
    loadingBounties,
    refresh,
    lastTx,
    lastTxUrl,
    lastIx,
    txState,
    error,
    clearError: () => setError(null),
    chainReady: Boolean(FIND_MINT && FINDBACK_PROGRAM_ID && SOLANA_LIVE),
    programId: FINDBACK_PROGRAM_ID,
    findMint: FIND_MINT,
    createAndFund,
    fund,
    submitClaim,
    reviewClaim,
    accept,
    reject,
    dispute,
    refund,
    cancel,
    resolveDispute,
    configureArbitrationPanel,
    voteArbitration,
    finalizeArbitration,
    fetchOnChain: fetchBounty,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFindBack() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useFindBack outside provider");
  return v;
}
