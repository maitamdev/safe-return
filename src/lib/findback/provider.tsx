"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import type { AiClaimReport } from "@/lib/ai/types";
import {
  loadBounties,
  saveBounties,
  upsertBounty,
  type BountyMeta,
} from "./store";
// saveBounties used when merging remote
import {
  acceptClaimOnChain,
  cancelBountyOnChain,
  createBountyOnChain,
  fetchBounty,
  fundBountyOnChain,
  openDisputeOnChain,
  resolveDisputeOnChain,
  refundAfterExpiryOnChain,
  rejectClaimOnChain,
  submitClaimOnChain,
  type OnChainBounty,
  type WalletLike,
} from "./program";
import { FINDBACK_PROGRAM_ID, FIND_MINT, SOLANA_LIVE, fromAtomic } from "./config";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  fetchBountiesFromSupabase,
  syncBountyStateToSupabase,
  syncClaimToSupabase,
  syncBountyToSupabase,
} from "./db";

type TxState = "idle" | "pending" | "confirmed" | "failed";

type FindBackCtx = {
  bounties: BountyMeta[];
  loadingBounties: boolean;
  refresh: () => void;
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
  reviewClaim: (bountyId: string) => Promise<AiClaimReport | null>;
  accept: (bountyId: string) => Promise<void>;
  reject: (bountyId: string) => Promise<void>;
  dispute: (bountyId: string) => Promise<void>;
  refund: (bountyId: string) => Promise<void>;
  cancel: (bountyId: string) => Promise<void>;
  resolveDispute: (bountyId: string, releaseToFinder: boolean) => Promise<void>;
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
  const [loadingBounties, setLoadingBounties] = useState(true);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [lastTxUrl, setLastTxUrl] = useState<string | null>(null);
  const [lastIx, setLastIx] = useState<string | null>(null);
  const [txState, setTxState] = useState<TxState>("idle");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setBounties(loadBounties());
  }, []);

  useEffect(() => {
    if (!user) {
      Promise.resolve().then(() => {
        setBounties(loadBounties());
        setLoadingBounties(false);
      });
      return;
    }
    let cancelled = false;
    void (async () => {
      const remote = await fetchBountiesFromSupabase();
      if (cancelled) return;
      const local = loadBounties();
      const map = new Map<string, BountyMeta>();
      for (const b of local) map.set(b.id, b);
      for (const b of remote) {
        const prev = map.get(b.id);
        if (!prev || (b.createdAt || 0) >= (prev.createdAt || 0)) {
          map.set(b.id, { ...prev, ...b, seed: false });
        }
      }
      const merged = Array.from(map.values()).sort(
        (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
      );
      saveBounties(merged);
      setBounties(merged);
      setLoadingBounties(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

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
    async (ixName: string, fn: () => Promise<{ signature: string; url: string }>) => {
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

      const deadlineUnix =
        Math.floor(Date.now() / 1000) + Math.max(1, input.days) * 86400;
      const metaPayload = JSON.stringify({
        title: input.title,
        description: input.description,
        category: input.category,
        location: input.location,
      });
      const metadataHash = await sha256Bytes(metaPayload);

      const meta: BountyMeta = {
        id: input.id,
        title: input.title,
        description: input.description,
        category: input.category,
        location: input.location,
        rewardUi: input.rewardUi,
        deadlineUnix,
        ownerWallet: w.publicKey.toBase58(),
        imageDataUrl: input.imageDataUrl ?? null,
        createdAt: Date.now(),
        status: "Draft",
      };

      const created = await runTx("create_bounty", () =>
        createBountyOnChain(w, {
          bountyId: input.id,
          rewardUi: input.rewardUi,
          deadlineUnix,
          metadataHash,
        })
      );
      const draft = {
        ...meta,
        lastTx: created.signature,
        lastTxUrl: created.url,
      };
      upsertBounty(draft);
      if (user?.id) await syncBountyToSupabase(draft, user.id);
      refresh();

      const funded = await runTx("fund_bounty", () =>
        fundBountyOnChain(w, input.id, input.rewardUi)
      );

      const saved = {
        ...draft,
        status: "Funded",
        lastTx: funded.signature,
        lastTxUrl: funded.url,
      };
      upsertBounty(saved);
      await syncBountyStateToSupabase(saved);
      refresh();
    },
    [requireWallet, runTx, refresh, user]
  );

  const fund = useCallback(
    async (bountyId: string) => {
      const w = requireWallet();
      await requireVerifiedWallet(w.publicKey.toBase58());
      const meta = loadBounties().find((b) => b.id === bountyId);
      if (!meta) throw new Error("Không tìm thấy metadata của bounty.");
      const onchain = await fetchBounty(bountyId);
      if (!onchain) throw new Error("Không tìm thấy bounty trên Devnet.");
      const remaining = onchain.rewardAmount - onchain.amountFunded;
      if (remaining <= BigInt(0)) throw new Error("Bounty đã được nạp đủ phần thưởng.");
      const result = await runTx("fund_bounty", () =>
        fundBountyOnChain(w, bountyId, fromAtomic(remaining))
      );
      const updated = {
        ...meta,
        status: "Funded",
        lastTx: result.signature,
        lastTxUrl: result.url,
      };
      upsertBounty(updated);
      await syncBountyStateToSupabase(updated);
      refresh();
    },
    [requireWallet, runTx, refresh]
  );

  const reviewClaim = useCallback(
    async (bountyId: string) => {
      const meta = loadBounties().find((b) => b.id === bountyId);
      if (!meta?.claim) throw new Error("Chưa có bằng chứng claim để đánh giá.");
      let report: AiClaimReport | null = null;
      const result = await runTx("record_ai_review", async () => {
        const response = await fetch("/api/ai/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bountyId,
            finderDescription: meta.claim?.description,
            finderLocation: meta.claim?.location,
            finderFoundAt: meta.claim?.foundAt,
            finderImageDataUrl: meta.claim?.imageDataUrl,
          }),
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
      upsertBounty(updated);
      await syncClaimToSupabase(updated);
      refresh();
      return report;
    },
    [refresh, runTx]
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
      const list = loadBounties();
      const meta = list.find((b) => b.id === input.bountyId);
      if (!meta) throw new Error("Bounty not found off-chain");

      const evidencePayload = JSON.stringify({
        description: input.description,
        location: input.location,
        foundAt: input.foundAt,
        image: input.imageDataUrl ? "attached" : null,
        finder: w.publicKey.toBase58(),
        at: Date.now(),
      });
      const evidenceHash = await sha256Bytes(evidencePayload);
      const evidenceHashHex = Array.from(evidenceHash)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const claimTx = await runTx("submit_claim", () =>
        submitClaimOnChain(w, input.bountyId, evidenceHash)
      );

      const submitted: BountyMeta = {
        ...meta,
        claim: {
          finderWallet: w.publicKey.toBase58(),
          description: input.description,
          location: input.location,
          foundAt: input.foundAt,
          imageDataUrl: input.imageDataUrl ?? null,
          submittedAt: Date.now(),
          evidenceHashHex,
        },
        aiReport: null,
        status: "ClaimSubmitted",
        lastTx: claimTx.signature,
        lastTxUrl: claimTx.url,
      };
      upsertBounty(submitted);
      await syncClaimToSupabase(submitted);
      refresh();
      return reviewClaim(input.bountyId);
    },
    [requireWallet, runTx, refresh, reviewClaim]
  );

  const accept = useCallback(
    async (bountyId: string) => {
      const w = requireWallet();
      const meta = loadBounties().find((b) => b.id === bountyId);
      const onchain = await fetchBounty(bountyId);
      const finderStr =
        onchain?.finder &&
        onchain.finder !== "11111111111111111111111111111111"
          ? onchain.finder
          : meta?.claim?.finderWallet;
      if (!finderStr) throw new Error("No finder on claim");
      const res = await runTx("accept_claim", () =>
        acceptClaimOnChain(w, bountyId, new PublicKey(finderStr))
      );
      if (meta) {
        const updated = { ...meta, status: "Released", lastTx: res.signature, lastTxUrl: res.url };
        upsertBounty(updated);
        await syncBountyStateToSupabase(updated);
        refresh();
      }
    },
    [requireWallet, runTx, refresh]
  );

  const reject = useCallback(
    async (bountyId: string) => {
      const w = requireWallet();
      const res = await runTx("reject_claim", () =>
        rejectClaimOnChain(w, bountyId)
      );
      const meta = loadBounties().find((b) => b.id === bountyId);
      if (meta) {
        upsertBounty({
          ...meta,
          status: "Funded",
          claim: null,
          aiReport: null,
          lastTx: res.signature,
          lastTxUrl: res.url,
        });
        await syncBountyStateToSupabase({ ...meta, status: "Funded", claim: null, aiReport: null, lastTx: res.signature, lastTxUrl: res.url });
        refresh();
      }
    },
    [requireWallet, runTx, refresh]
  );

  const dispute = useCallback(
    async (bountyId: string) => {
      const w = requireWallet();
      const result = await runTx("open_dispute", () => openDisputeOnChain(w, bountyId));
      const meta = loadBounties().find((b) => b.id === bountyId);
      if (meta) {
        const updated = { ...meta, status: "Disputed", lastTx: result.signature, lastTxUrl: result.url };
        upsertBounty(updated);
        await syncBountyStateToSupabase(updated);
      }
      refresh();
    },
    [requireWallet, runTx, refresh]
  );

  const refund = useCallback(
    async (bountyId: string) => {
      const w = requireWallet();
      const res = await runTx("refund_after_expiry", () =>
        refundAfterExpiryOnChain(w, bountyId)
      );
      const meta = loadBounties().find((b) => b.id === bountyId);
      if (meta) {
        const updated = { ...meta, status: "Refunded", lastTx: res.signature, lastTxUrl: res.url };
        upsertBounty(updated);
        await syncBountyStateToSupabase(updated);
        refresh();
      }
    },
    [requireWallet, runTx, refresh]
  );

  const cancel = useCallback(
    async (bountyId: string) => {
      const w = requireWallet();
      const result = await runTx("cancel_bounty", () =>
        cancelBountyOnChain(w, bountyId)
      );
      const meta = loadBounties().find((b) => b.id === bountyId);
      if (meta) {
        const updated = { ...meta, status: "Cancelled", lastTx: result.signature, lastTxUrl: result.url };
        upsertBounty(updated);
        await syncBountyStateToSupabase(updated);
        refresh();
      }
    },
    [requireWallet, runTx, refresh]
  );

  const resolveDispute = useCallback(
    async (bountyId: string, releaseToFinder: boolean) => {
      const w = requireWallet();
      const onchain = await fetchBounty(bountyId);
      if (!onchain) throw new Error("Không tìm thấy bounty trên Devnet.");
      const counterparty = new PublicKey(
        releaseToFinder ? onchain.finder : onchain.owner
      );
      const result = await runTx("resolve_dispute", () =>
        resolveDisputeOnChain(w, bountyId, counterparty, releaseToFinder)
      );
      const meta = loadBounties().find((b) => b.id === bountyId);
      if (meta) {
        const updated = {
          ...meta,
          status: releaseToFinder ? "Released" : "Refunded",
          lastTx: result.signature,
          lastTxUrl: result.url,
        };
        upsertBounty(updated);
        try {
          await syncBountyStateToSupabase(updated);
        } catch {
          // Arbiter may not be an off-chain listing participant; on-chain remains authoritative.
        }
        refresh();
      }
    },
    [requireWallet, runTx, refresh]
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
    fetchOnChain: fetchBounty,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFindBack() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useFindBack outside provider");
  return v;
}

// silence unused
void saveBounties;
