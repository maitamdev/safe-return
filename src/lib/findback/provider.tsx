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
import { decisionToU8, riskToU8 } from "@/lib/ai/types";
import {
  loadBounties,
  saveBounties,
  upsertBounty,
  type BountyMeta,
} from "./store";
import {
  acceptClaimOnChain,
  createBountyOnChain,
  fetchBounty,
  fundBountyOnChain,
  openDisputeOnChain,
  recordAiReviewOnChain,
  refundAfterExpiryOnChain,
  rejectClaimOnChain,
  submitClaimOnChain,
  type OnChainBounty,
  type WalletLike,
} from "./program";
import { FINDBACK_PROGRAM_ID, FIND_MINT, SOLANA_LIVE } from "./config";

type TxState = "idle" | "pending" | "confirmed" | "failed";

type FindBackCtx = {
  bounties: BountyMeta[];
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
  submitClaim: (input: {
    bountyId: string;
    description: string;
    location: string;
    foundAt: string;
    imageDataUrl?: string | null;
  }) => Promise<AiClaimReport | null>;
  accept: (bountyId: string) => Promise<void>;
  reject: (bountyId: string) => Promise<void>;
  dispute: (bountyId: string) => Promise<void>;
  refund: (bountyId: string) => Promise<void>;
  fetchOnChain: (bountyId: string) => Promise<OnChainBounty | null>;
};

const Ctx = createContext<FindBackCtx | null>(null);

async function sha256Bytes(text: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(hash);
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function FindBackProvider({ children }: { children: ReactNode }) {
  const { publicKey, signTransaction, connected } = useWallet();
  const [bounties, setBounties] = useState<BountyMeta[]>([]);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [lastTxUrl, setLastTxUrl] = useState<string | null>(null);
  const [lastIx, setLastIx] = useState<string | null>(null);
  const [txState, setTxState] = useState<TxState>("idle");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setBounties(loadBounties());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
    if (!wallet) throw new Error("Connect Phantom wallet first (Devnet).");
    return wallet;
  }, [wallet]);

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
        setError(msg);
        throw e;
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
      };
      upsertBounty(meta);
      refresh();

      await runTx("create_bounty", () =>
        createBountyOnChain(w, {
          bountyId: input.id,
          rewardUi: input.rewardUi,
          deadlineUnix,
          metadataHash,
        })
      );

      const funded = await runTx("fund_bounty", () =>
        fundBountyOnChain(w, input.id, input.rewardUi)
      );

      upsertBounty({
        ...meta,
        lastTx: funded.signature,
        lastTxUrl: funded.url,
      });
      refresh();
    },
    [requireWallet, runTx, refresh]
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

      await runTx("submit_claim", () =>
        submitClaimOnChain(w, input.bountyId, evidenceHash)
      );

      // AI review (server)
      const aiRes = await fetch("/api/ai/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bountyId: input.bountyId,
          ownerTitle: meta.title,
          ownerDescription: meta.description,
          ownerCategory: meta.category,
          ownerLocation: meta.location,
          ownerImageDataUrl: meta.imageDataUrl,
          finderDescription: input.description,
          finderLocation: input.location,
          finderFoundAt: input.foundAt,
          finderImageDataUrl: input.imageDataUrl,
        }),
      });
      if (!aiRes.ok) {
        const err = await aiRes.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error || "AI review failed"
        );
      }
      const aiJson = (await aiRes.json()) as {
        report: AiClaimReport;
        explanationHashHex: string;
      };

      const explanationHash = hexToBytes(aiJson.explanationHashHex);
      await runTx("record_ai_review", () =>
        recordAiReviewOnChain(w, input.bountyId, {
          score: aiJson.report.score,
          riskLevel: riskToU8(aiJson.report),
          decision: decisionToU8(aiJson.report.decision),
          explanationHash,
        })
      );

      const updated: BountyMeta = {
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
        aiReport: aiJson.report,
        lastTx: lastTx,
        lastTxUrl: lastTxUrl,
      };
      upsertBounty(updated);
      refresh();
      return aiJson.report;
    },
    [requireWallet, runTx, refresh, lastTx, lastTxUrl]
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
        upsertBounty({ ...meta, lastTx: res.signature, lastTxUrl: res.url });
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
          claim: null,
          aiReport: null,
          lastTx: res.signature,
          lastTxUrl: res.url,
        });
        refresh();
      }
    },
    [requireWallet, runTx, refresh]
  );

  const dispute = useCallback(
    async (bountyId: string) => {
      const w = requireWallet();
      await runTx("open_dispute", () => openDisputeOnChain(w, bountyId));
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
        upsertBounty({ ...meta, lastTx: res.signature, lastTxUrl: res.url });
        refresh();
      }
    },
    [requireWallet, runTx, refresh]
  );

  const value: FindBackCtx = {
    bounties,
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
    submitClaim,
    accept,
    reject,
    dispute,
    refund,
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
