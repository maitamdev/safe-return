export type ItemStatus =
  | "ACTIVE"
  | "LOST"
  | "FOUND_CANDIDATE"
  | "RETURN_IN_PROGRESS";

export type CaseStatus =
  | "OPEN"
  | "MATCH_SUGGESTED"
  | "CLAIMED"
  | "MATCH_ACCEPTED"
  | "HANDOVER_PENDING"
  | "RETURNED"
  | "DISPUTED"
  | "EXPIRED"
  | "CANCELLED";

export type EscrowStatus =
  | "UNFUNDED"
  | "FUNDED"
  | "LOCKED"
  | "RELEASED"
  | "REFUNDED"
  | "DISPUTED";

export interface Item {
  id: string;
  name: string;
  type: string;
  brand: string;
  color: string;
  area: string;
  status: ItemStatus;
  hasQr: boolean;
  imageGradient: string;
  secretHint: string;
  registeredAt: string;
  chainHash: string;
}

export interface LostCase {
  id: string;
  itemId: string;
  itemName: string;
  owner: string;
  finder?: string;
  /** Solana pubkey of owner (set when case opened with connected wallet). */
  ownerWallet?: string;
  /** Solana pubkey of finder (set when match accepted). */
  finderWallet?: string;
  location: string;
  lostAt: string;
  reward: number;
  status: CaseStatus;
  escrow: EscrowStatus;
  matchScore?: number;
  matchReasons?: string[];
  imageGradient: string;
  visibility: string;
  safePoint?: string;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  time: string;
  unread: boolean;
}

export interface ReputationBadge {
  id: string;
  name: string;
  desc: string;
  earned: boolean;
}

export const currentUser = {
  name: "Quinn Nguyen",
  nickname: "quinn.n",
  email: "quinn@student.edu.vn",
  campus: "UniHack University",
  area: "Campus North",
  wallet: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  walletShort: "7xKX…gAsU",
  reputation: 86,
  returns: 3,
  disputes: 0,
  verified: true,
};

export const items: Item[] = [
  {
    id: "ITM-8F2A91",
    name: "Black Campus Backpack",
    type: "Backpack",
    brand: "The North Face",
    color: "Black / White logo",
    area: "Library · Building A",
    status: "LOST",
    hasQr: true,
    imageGradient: "from-zinc-800 via-zinc-700 to-zinc-900",
    secretHint: "Front pocket has a star-shaped keychain",
    registeredAt: "2026-03-12",
    chainHash: "3k9f…a2b1",
  },
  {
    id: "ITM-4C11B0",
    name: "Student Card",
    type: "ID Card",
    brand: "University",
    color: "Blue / White",
    area: "Campus-wide",
    status: "ACTIVE",
    hasQr: true,
    imageGradient: "from-sky-700 via-blue-600 to-indigo-800",
    secretHint: "Last 4 digits of serial: 4821",
    registeredAt: "2026-02-01",
    chainHash: "9m2p…c8d4",
  },
  {
    id: "ITM-B7E003",
    name: "AirPods Case",
    type: "Electronics",
    brand: "Apple",
    color: "White",
    area: "Canteen",
    status: "ACTIVE",
    hasQr: true,
    imageGradient: "from-stone-200 via-neutral-100 to-stone-300",
    secretHint: "Case has a small scratch near hinge",
    registeredAt: "2026-04-18",
    chainHash: "1q7n…f0e2",
  },
  {
    id: "ITM-D90A22",
    name: "Room Keys",
    type: "Keys",
    brand: "Dorm",
    color: "Silver",
    area: "Dormitory B",
    status: "ACTIVE",
    hasQr: false,
    imageGradient: "from-amber-200 via-yellow-100 to-stone-300",
    secretHint: "Keychain is a mini basketball",
    registeredAt: "2026-05-02",
    chainHash: "5t4w…h9j3",
  },
];

export const cases: LostCase[] = [
  {
    id: "CASE-2026-0142",
    itemId: "ITM-8F2A91",
    itemName: "Black Campus Backpack",
    owner: "Quinn Nguyen",
    finder: "Mai Tran",
    location: "University Library, Floor 2",
    lostAt: "2026-07-18 · 14:20",
    reward: 5,
    status: "MATCH_SUGGESTED",
    escrow: "UNFUNDED",
    matchScore: 93,
    matchReasons: [
      "Same black backpack model",
      "Matching white logo",
      "Compatible location (Library)",
      "Found 20 minutes after loss report",
    ],
    imageGradient: "from-zinc-800 via-zinc-700 to-zinc-900",
    visibility: "Campus only",
    safePoint: "Security Office · Gate A",
  },
  {
    id: "CASE-2026-0118",
    itemId: "ITM-B7E003",
    itemName: "AirPods Case",
    owner: "Linh Vo",
    finder: "Quinn Nguyen",
    location: "Canteen East",
    lostAt: "2026-07-10 · 11:05",
    reward: 3,
    status: "RETURNED",
    escrow: "RELEASED",
    matchScore: 88,
    matchReasons: ["White case match", "Same canteen zone"],
    imageGradient: "from-stone-200 via-neutral-100 to-stone-300",
    visibility: "Public",
    safePoint: "Library Desk",
  },
];

export const notifications: Notification[] = [
  {
    id: "n1",
    title: "AI match found",
    body: "93% match for your Black Campus Backpack",
    time: "2 min ago",
    unread: true,
  },
  {
    id: "n2",
    title: "QR scanned",
    body: "Someone scanned ITM-8F2A91 near Library",
    time: "18 min ago",
    unread: true,
  },
  {
    id: "n3",
    title: "Reward released",
    body: "3 mock USDC sent for CASE-2026-0118",
    time: "Yesterday",
    unread: false,
  },
];

export const badges: ReputationBadge[] = [
  {
    id: "b1",
    name: "First Return",
    desc: "Completed your first successful return",
    earned: true,
  },
  {
    id: "b2",
    name: "Trusted Finder",
    desc: "3+ successful returns with zero disputes",
    earned: true,
  },
  {
    id: "b3",
    name: "Campus Helper",
    desc: "Helped return items on your campus",
    earned: true,
  },
  {
    id: "b4",
    name: "Five Returns",
    desc: "Five successful handovers",
    earned: false,
  },
  {
    id: "b5",
    name: "Verified SafePoint",
    desc: "Operates an official SafePoint",
    earned: false,
  },
];

export const safePoints = [
  {
    id: "sp1",
    name: "Security Office · Gate A",
    hours: "06:00 – 22:00",
    holding: 7,
    status: "Open",
  },
  {
    id: "sp2",
    name: "Library Front Desk",
    hours: "08:00 – 21:00",
    holding: 4,
    status: "Open",
  },
  {
    id: "sp3",
    name: "Student Union Office",
    hours: "09:00 – 17:00",
    holding: 2,
    status: "Open",
  },
  {
    id: "sp4",
    name: "Dormitory B Reception",
    hours: "24/7",
    holding: 5,
    status: "Open",
  },
];

export const demoSteps = [
  {
    id: 1,
    title: "Quinn reports a lost backpack",
    role: "Owner",
    detail:
      "Black backpack, white logo, lost at the library. Reward set to 5 mock USDC.",
  },
  {
    id: 2,
    title: "Mai finds it and uploads a photo",
    role: "Finder",
    detail:
      "Mai posts a found-item report with photo, time, and location near the library.",
  },
  {
    id: 3,
    title: "AI proposes a 93% match",
    role: "AI",
    detail:
      "Image, location, and timing align. AI explains reasons — never auto-releases funds.",
  },
  {
    id: 4,
    title: "Secret detail confirmed",
    role: "Owner + Finder",
    detail:
      "“Front pocket has a star-shaped keychain.” Mai confirms. Ownership verified.",
  },
  {
    id: 5,
    title: "Reward locked in escrow",
    role: "Solana",
    detail:
      "Quinn funds 5 mock USDC into a PDA escrow on Solana Devnet.",
  },
  {
    id: 6,
    title: "Handed to SafePoint",
    role: "SafePoint",
    detail:
      "Mai drops the bag at Security Office. Staff scans the case code and holds it.",
  },
  {
    id: 7,
    title: "Quinn picks up with OTP",
    role: "Handover",
    detail:
      "Quinn verifies identity, enters one-time OTP. SafePoint confirms return.",
  },
  {
    id: 8,
    title: "Reward released on-chain",
    role: "Solana",
    detail:
      "Smart contract sends 5 mock USDC to Mai. Explorer link available.",
  },
];

export const stats = [
  { label: "Items registered", value: "1,248" },
  { label: "Successful returns", value: "386" },
  { label: "Avg. recovery time", value: "4.2h" },
  { label: "Dispute rate", value: "1.8%" },
];

export function statusColor(status: string) {
  const map: Record<string, string> = {
    ACTIVE: "bg-mint text-forest-deep",
    LOST: "bg-gold-soft text-amber-900",
    FOUND_CANDIDATE: "bg-sky-100 text-sky-900",
    RETURN_IN_PROGRESS: "bg-violet-100 text-violet-900",
    OPEN: "bg-gold-soft text-amber-900",
    MATCH_SUGGESTED: "bg-mint text-forest-deep",
    CLAIMED: "bg-sky-100 text-sky-900",
    MATCH_ACCEPTED: "bg-emerald-100 text-emerald-900",
    HANDOVER_PENDING: "bg-orange-100 text-orange-900",
    RETURNED: "bg-forest text-white",
    DISPUTED: "bg-red-100 text-red-800",
    EXPIRED: "bg-stone-200 text-stone-700",
    CANCELLED: "bg-stone-200 text-stone-700",
    UNFUNDED: "bg-stone-200 text-stone-700",
    FUNDED: "bg-sky-100 text-sky-900",
    LOCKED: "bg-gold-soft text-amber-900",
    RELEASED: "bg-forest text-white",
    REFUNDED: "bg-stone-300 text-stone-800",
  };
  return map[status] ?? "bg-stone-200 text-stone-700";
}
