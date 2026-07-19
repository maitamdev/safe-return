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
  /** seed demo flag */
  seed?: boolean;
};

const KEY = "findback_bounties_v1";

export const SEED_BOUNTIES: BountyMeta[] = [
  {
    id: "FB-UEF-001",
    title: "Thẻ sinh viên UEF",
    description:
      "Thẻ sinh viên UEF màu xanh, tên Mai, có dây đeo đỏ. Mất gần cổng A.",
    category: "ID card",
    location: "UEF — Cổng A",
    rewardUi: 20,
    deadlineUnix: Math.floor(Date.now() / 1000) + 7 * 86400,
    createdAt: Date.now() - 86400000,
    imageDataUrl: null,
    seed: true,
  },
  {
    id: "FB-TD-LAP",
    title: "Laptop Dell XPS bạc",
    description:
      "Dell XPS 13 bạc, dán sticker Solana góc trái, vỏ hơi trầy cạnh phải.",
    category: "Laptop",
    location: "Thủ Đức — quán cà phê",
    rewardUi: 100,
    deadlineUnix: Math.floor(Date.now() / 1000) + 5 * 86400,
    createdAt: Date.now() - 3600000 * 5,
    seed: true,
  },
  {
    id: "FB-WALLET",
    title: "Ví da nâu + giấy tờ",
    description: "Ví da nâu, bên trong CCCD và vài thẻ ATM (không lộ số).",
    category: "Wallet",
    location: "Quận 1 — phố đi bộ",
    rewardUi: 50,
    deadlineUnix: Math.floor(Date.now() / 1000) + 3 * 86400,
    createdAt: Date.now() - 7200000,
    seed: true,
  },
  {
    id: "FB-AIRPODS",
    title: "AirPods Pro case trắng",
    description: "Case AirPods Pro trắng, khắc chữ Q nhỏ ở nắp.",
    category: "Electronics",
    location: "Khuôn viên trường — thư viện",
    rewardUi: 15,
    deadlineUnix: Math.floor(Date.now() / 1000) + 4 * 86400,
    createdAt: Date.now() - 1800000,
    seed: true,
  },
];

export function loadBounties(): BountyMeta[] {
  if (typeof window === "undefined") return SEED_BOUNTIES;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      localStorage.setItem(KEY, JSON.stringify(SEED_BOUNTIES));
      return [...SEED_BOUNTIES];
    }
    const parsed = JSON.parse(raw) as BountyMeta[];
    // merge seeds missing
    const ids = new Set(parsed.map((b) => b.id));
    const merged = [...parsed];
    for (const s of SEED_BOUNTIES) {
      if (!ids.has(s.id)) merged.push(s);
    }
    return merged;
  } catch {
    return [...SEED_BOUNTIES];
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
