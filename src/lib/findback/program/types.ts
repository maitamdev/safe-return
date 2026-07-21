import type { PublicKey, Transaction } from "@solana/web3.js";

export type WalletLike = {
  publicKey: PublicKey;
  signTransaction: <T extends Transaction>(tx: T) => Promise<T>;
};

export type BountyStatusName =
  | "Draft"
  | "Funded"
  | "ClaimSubmitted"
  | "AiReviewed"
  | "Accepted"
  | "Released"
  | "Rejected"
  | "Disputed"
  | "Refunded"
  | "Expired"
  | "Cancelled"
  | "Unknown";

export const STATUS_MAP: BountyStatusName[] = [
  "Draft",
  "Funded",
  "ClaimSubmitted",
  "AiReviewed",
  "Accepted",
  "Released",
  "Rejected",
  "Disputed",
  "Refunded",
  "Expired",
  "Cancelled",
];

export type OnChainBounty = {
  address: string;
  owner: string;
  finder: string;
  arbiter: string;
  mint: string;
  bountyId: string;
  rewardAmount: bigint;
  amountFunded: bigint;
  deadline: number;
  status: BountyStatusName;
  metadataHash: Uint8Array;
  evidenceHash: Uint8Array;
  aiScore: number;
  aiRisk: number;
  aiDecision: number;
  aiExplanationHash: Uint8Array;
  createdAt: number;
  updatedAt: number;
  protocolVersion: number;
  arbitrationMode: number;
  activeClaims: number;
  workflowVersion: number;
};

export type ClaimV2StatusName =
  | "Submitted"
  | "AiReviewed"
  | "Rejected"
  | "Disputed"
  | "Settled"
  | "RejectionPending"
  | "Unknown";

export const CLAIM_V2_STATUS_MAP: ClaimV2StatusName[] = [
  "Submitted",
  "AiReviewed",
  "Rejected",
  "Disputed",
  "Settled",
  "RejectionPending",
];

export type OnChainClaimV2 = {
  address: string;
  bounty: string;
  finder: string;
  evidenceHash: Uint8Array;
  aiInputHash: Uint8Array;
  aiReportHash: Uint8Array;
  aiModelHash: Uint8Array;
  aiScore: number;
  aiRisk: number;
  aiDecision: number;
  status: ClaimV2StatusName;
  createdAt: number;
  updatedAt: number;
  disputeDeadline: number;
  resolutionDeadline: number;
  workflowVersion: number;
};

export type OnChainReputation = {
  address: string;
  wallet: string;
  successfulReturns: number;
  rewardsEarned: bigint;
  rewardsPaid: bigint;
  lastActivity: number;
};

export type OnChainReturnAttestation = {
  address: string;
  bounty: string;
  claim: string;
  owner: string;
  finder: string;
  rewardAmount: bigint;
  aiScore: number;
  settledAt: number;
};

export type OnChainArbitrationPanel = {
  address: string;
  bounty: string;
  arbiters: [string, string, string];
  quorum: number;
  createdAt: number;
};

export type OnChainDisputeCase = {
  address: string;
  bounty: string;
  claim: string;
  panel: string;
  releaseVotes: number;
  rejectVotes: number;
  decision: 0 | 1 | 2;
  finalized: boolean;
  createdAt: number;
  resolvedAt: number;
};

export type OnChainArbitrationVote = {
  address: string;
  disputeCase: string;
  arbiter: string;
  releaseToFinder: boolean;
  votedAt: number;
};

