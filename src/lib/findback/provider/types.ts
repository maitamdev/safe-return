import type { AiClaimReport } from "@/lib/ai/types";
import type { BountyMeta } from "../store";
import type { OnChainBounty } from "../program";

export type TxState = "idle" | "pending" | "confirmed" | "failed";

export type FindBackCtx = {
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
  finalizeRejection: (bountyId: string, finderWallet: string) => Promise<void>;
  timeoutDispute: (bountyId: string, finderWallet: string) => Promise<void>;
  fetchOnChain: (bountyId: string) => Promise<OnChainBounty | null>;
};
