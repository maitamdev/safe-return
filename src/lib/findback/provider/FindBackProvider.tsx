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
import type { BountyMeta } from "../store";
import {
  acceptClaimOnChain,
  acceptClaimV2OnChain,
  cancelBountyOnChain,
  castArbitrationVoteOnChain,
  configureArbitrationPanelOnChain,
  createAndFundBountyOnChain,
  createBountyOnChain,
  createBountyV2OnChain,
  fetchBounty,
  fundBountyOnChain,
  finalizeDisputeRejectOnChain,
  finalizeDisputeReleaseOnChain,
  finalizeRejectionV2OnChain,
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
  timeoutDisputeV2OnChain,
  type OnChainBounty,
  type WalletLike,
} from "../program";
import {
  FINDBACK_PROGRAM_ID,
  FIND_MINT,
  PROTOCOL_V2_ENABLED,
  SPONSORED_FEES_ENABLED,
  SOLANA_LIVE,
  fromAtomic,
  toAtomic,
} from "../config";
import { sendSponsoredTransaction } from "../sponsored";
import {
  evidenceIntegrityPayload,
  evidenceIntegrityPayloadV2,
  imageDescriptorFromDataUrl,
  metadataIntegrityPayload,
  metadataIntegrityPayloadV2,
} from "../integrity";
import { uploadPrivateMedia } from "@/lib/media/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  fetchBountiesFromSupabase,
  flushPendingSyncs,
  queuePendingSync,
  subscribeToBountyChanges,
  syncBountyStateToSupabase,
  syncClaimToSupabase,
  syncBountyToSupabase,
} from "../db";
import type { FindBackCtx, TxState } from "./types";
import { requireVerifiedWallet, sha256Bytes } from "./crypto";
import { friendlyError } from "./errors";

const Ctx = createContext<FindBackCtx | null>(null);

export function FindBackProvider({ children }: { children: ReactNode }) {
  const { publicKey, signTransaction, connected } = useWallet();
  const { user } = useAuth();
  const [bounties, setBounties] = useState<BountyMeta[]>([]);
  const bountiesRef = useRef<BountyMeta[]>([]);
  const lastReconcileAtRef = useRef(0);
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

  const syncRecoverably = useCallback(
    async (
      kind: "bounty" | "claim" | "state",
      bounty: BountyMeta,
      claim?: BountyMeta["claim"],
    ) => {
      try {
        if (kind === "bounty") await syncBountyToSupabase(bounty);
        else if (kind === "claim") await syncClaimToSupabase(bounty);
        else await syncBountyStateToSupabase(bounty, claim);
      } catch {
        queuePendingSync(kind, bounty, claim);
        setError(
          "Giao dịch Devnet đã xác nhận. Dữ liệu hiển thị đang được tự động đồng bộ lại.",
        );
      }
    },
    [],
  );

  const refresh = useCallback(async () => {
    if (!user) {
      replaceBounties([]);
      setLoadingBounties(false);
      return;
    }
    setLoadingBounties(true);
    try {
      await flushPendingSyncs();
      if (Date.now() - lastReconcileAtRef.current >= 60_000) {
        lastReconcileAtRef.current = Date.now();
        await fetch("/api/bounties/reconcile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }).catch(() => null);
      }
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

      const useSponsoredCreate = SPONSORED_FEES_ENABLED && useV2;
      if (!existing && !useSponsoredCreate) {
        const createdAndFunded = await runTx(
          useV2 ? "create_and_fund_bounty_v2" : "create_and_fund_bounty",
          () =>
            createAndFundBountyOnChain(
              w,
              {
                bountyId: input.id,
                rewardUi: input.rewardUi,
                deadlineUnix,
                metadataHash,
              },
              useV2,
            ),
        );
        const saved = {
          ...meta,
          status: "Funded" as const,
          lastTx: createdAndFunded.signature,
          lastTxUrl: createdAndFunded.url,
        };
        if (!user?.id) throw new Error("Phiên đăng nhập đã hết hạn.");
        await syncRecoverably("bounty", saved);
        upsertInMemory(saved);
        await refresh();
        return;
      }

      const created = existing
        ? null
        : useSponsoredCreate
          ? await runTx("create_bounty_sponsored", () =>
              sendSponsoredTransaction(w, {
                action: "create_bounty",
                bountyId: input.id,
                rewardUi: input.rewardUi,
                deadlineUnix,
                metadataHashHex,
              })
            )
          : await runTx(useV2 ? "create_bounty_v2" : "create_bounty", () =>
              (useV2 ? createBountyV2OnChain : createBountyOnChain)(w, {
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
      await syncRecoverably("bounty", draft);
      upsertInMemory(draft);

      if (existing?.status === "Funded") {
        await syncRecoverably("state", draft);
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
      await syncRecoverably("state", saved);
      upsertInMemory(saved);
      await refresh();
    },
    [requireWallet, runTx, refresh, syncRecoverably, upsertInMemory, user]
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
      await syncRecoverably("state", updated);
      upsertInMemory(updated);
      await refresh();
    },
    [currentBounty, requireWallet, runTx, refresh, syncRecoverably, upsertInMemory]
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
      await syncRecoverably("claim", submitted);
      upsertInMemory(submitted);
      await refresh();
      return null;
    },
    [currentBounty, requireWallet, runTx, refresh, syncRecoverably, upsertInMemory]
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
      await syncRecoverably("state", updated, targetClaim);
      upsertInMemory(updated);
      await refresh();
    },
    [currentBounty, requireWallet, runTx, refresh, syncRecoverably, upsertInMemory]
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
        lastTx: res.signature,
        lastTxUrl: res.url,
      };
      await syncRecoverably("state", updated, targetClaim);
      upsertInMemory(updated);
      await refresh();
    },
    [currentBounty, requireWallet, runTx, refresh, syncRecoverably, upsertInMemory]
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
      await syncRecoverably("state", updated, targetClaim);
      upsertInMemory(updated);
      await refresh();
    },
    [currentBounty, requireWallet, runTx, refresh, syncRecoverably, upsertInMemory]
  );

  const finalizeRejection = useCallback(
    async (bountyId: string, finderWallet: string) => {
      const w = requireWallet();
      await requireVerifiedWallet(w.publicKey.toBase58());
      const meta = currentBounty(bountyId);
      if (!meta) throw new Error("Không tìm thấy bounty trong Supabase.");
      const targetClaim =
        meta.claims?.find((claim) => claim.finderWallet === finderWallet) ||
        meta.claim;
      const result = await runTx("finalize_rejection_v2", () =>
        finalizeRejectionV2OnChain(w, bountyId, new PublicKey(finderWallet)),
      );
      const updated = {
        ...meta,
        lastTx: result.signature,
        lastTxUrl: result.url,
      };
      await syncRecoverably("state", updated, targetClaim);
      await refresh();
    },
    [currentBounty, refresh, requireWallet, runTx, syncRecoverably],
  );

  const timeoutDispute = useCallback(
    async (bountyId: string, finderWallet: string) => {
      const w = requireWallet();
      await requireVerifiedWallet(w.publicKey.toBase58());
      const meta = currentBounty(bountyId);
      if (!meta) throw new Error("Không tìm thấy bounty trong Supabase.");
      const targetClaim =
        meta.claims?.find((claim) => claim.finderWallet === finderWallet) ||
        meta.claim;
      const result = await runTx("timeout_dispute_v2", () =>
        timeoutDisputeV2OnChain(w, bountyId, new PublicKey(finderWallet)),
      );
      const updated = {
        ...meta,
        lastTx: result.signature,
        lastTxUrl: result.url,
      };
      await syncRecoverably("state", updated, targetClaim);
      await refresh();
    },
    [currentBounty, refresh, requireWallet, runTx, syncRecoverably],
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
      await syncRecoverably("state", updated);
      upsertInMemory(updated);
      await refresh();
    },
    [currentBounty, requireWallet, runTx, refresh, syncRecoverably, upsertInMemory]
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
      await syncRecoverably("state", updated);
      upsertInMemory(updated);
      await refresh();
    },
    [currentBounty, requireWallet, runTx, refresh, syncRecoverably, upsertInMemory]
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
      await syncRecoverably("state", updated, targetClaim);
      upsertInMemory(updated);
      await refresh();
    },
    [currentBounty, requireWallet, runTx, refresh, syncRecoverably, upsertInMemory]
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
      await syncRecoverably("state", updated, targetClaim);
      upsertInMemory(updated);
      await refresh();
    },
    [currentBounty, refresh, requireWallet, runTx, syncRecoverably, upsertInMemory]
  );

  const clearError = useCallback(() => setError(null), []);

  const chainReady = Boolean(FIND_MINT && FINDBACK_PROGRAM_ID && SOLANA_LIVE);

  const value = useMemo<FindBackCtx>(
    () => ({
      bounties,
      loadingBounties,
      refresh,
      lastTx,
      lastTxUrl,
      lastIx,
      txState,
      error,
      clearError,
      chainReady,
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
      finalizeRejection,
      timeoutDispute,
      fetchOnChain: fetchBounty,
    }),
    [
      bounties,
      loadingBounties,
      refresh,
      lastTx,
      lastTxUrl,
      lastIx,
      txState,
      error,
      clearError,
      chainReady,
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
      finalizeRejection,
      timeoutDispute,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}


export function useFindBack() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useFindBack outside provider");
  return v;
}
