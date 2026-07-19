/**
 * Off-chain bounty metadata (images, full AI report).
 * On-chain stores only hashes + status + amounts.
 */

import type { AiClaimReport } from "@/lib/ai/types";
import type { StoredMedia } from "@/lib/media/types";

export type ClaimMeta = {
  id?: string;
  claimPda?: string | null;
  protocolVersion?: number;
  finderWallet?: string;
  description: string;
  location: string;
  foundAt: string;
  imageDataUrl?: string | null;
  media?: StoredMedia | null;
  submittedAt: number;
  evidenceHashHex?: string;
  aiReport?: AiClaimReport | null;
  aiInputHash?: string | null;
  aiReportHash?: string | null;
  aiModelHash?: string | null;
  aiPromptVersion?: string | null;
  status?: string;
  lastTx?: string | null;
  lastTxUrl?: string | null;
};

export type BountyMeta = {
  id: string;
  title: string;
  description: string;
  category: string;
  location: string;
  rewardUi: number;
  deadlineUnix: number;
  ownerWallet?: string;
  imageDataUrl?: string | null;
  media?: StoredMedia | null;
  protocolVersion?: number;
  createdAt: number;
  status?: string;
  /** full AI report for latest claim */
  aiReport?: AiClaimReport | null;
  /** Legacy/latest claim compatibility view. */
  claim?: ClaimMeta | null;
  /** Protocol v2 exposes every independent finder claim. */
  claims?: ClaimMeta[];
  lastTx?: string | null;
  lastTxUrl?: string | null;
  metadataHashHex?: string | null;
};
