/**
 * Off-chain bounty metadata (images, full AI report).
 * On-chain stores only hashes + status + amounts.
 */

import type { AiClaimReport } from "@/lib/ai/types";

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
  createdAt: number;
  status?: string;
  /** full AI report for latest claim */
  aiReport?: AiClaimReport | null;
  claim?: {
    finderWallet?: string;
    description: string;
    location: string;
    foundAt: string;
    imageDataUrl?: string | null;
    submittedAt: number;
    evidenceHashHex?: string;
  } | null;
  lastTx?: string | null;
  lastTxUrl?: string | null;
  metadataHashHex?: string | null;
};
