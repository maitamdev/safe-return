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
  /** Legacy flag retained only to remove old seeded records safely. */
  seed?: boolean;
};

const KEY = "findback_bounties_v1";

export function loadBounties(): BountyMeta[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BountyMeta[];
    const real = parsed.filter((b) => !b.seed);
    if (real.length !== parsed.length) {
      localStorage.setItem(KEY, JSON.stringify(real));
    }
    return real;
  } catch {
    return [];
  }
}

export function saveBounties(list: BountyMeta[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function upsertBounty(b: BountyMeta) {
  const list = loadBounties();
  const i = list.findIndex((x) => x.id === b.id);
  if (i >= 0) list[i] = b;
  else list.unshift(b);
  saveBounties(list);
  return b;
}

export function getBountyMeta(id: string): BountyMeta | undefined {
  return loadBounties().find((b) => b.id === id);
}
