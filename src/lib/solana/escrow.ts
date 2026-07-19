/**
 * Escrow facade used by the app store.
 * REAL Devnet only when wallet is connected + program deployed + mint set.
 * Throws clear errors instead of faking signatures.
 */

import { PublicKey } from "@solana/web3.js";
import {
  PROGRAM_ID,
  SOLANA_LIVE,
  MOCK_USDC_MINT,
  explorerTxUrl,
} from "./config";
import {
  initializeCaseOnChain,
  fundEscrowOnChain,
  setFinderOnChain,
  lockForHandoverOnChain,
  releaseRewardOnChain,
  escrowPda,
  type WalletLike,
  type SendResult,
} from "./program";

export type OnChainEscrowStatus =
  | "Unfunded"
  | "PartiallyFunded"
  | "Funded"
  | "FinderSet"
  | "Locked"
  | "Released"
  | "Refunded"
  | "Disputed";

export type EscrowTxResult = SendResult;

export interface EscrowSnapshot {
  caseId: string;
  status: OnChainEscrowStatus;
  rewardAtomic: bigint;
  fundedAtomic: bigint;
  owner: string;
  finder: string | null;
  authority: string;
  mint: string;
  otpHashHex: string | null;
  pdaHint: string;
}

/** In-memory mirror of what we last sent on-chain (UI only). */
const localMirror = new Map<string, EscrowSnapshot>();

export function isChainReady(): boolean {
  return Boolean(SOLANA_LIVE && PROGRAM_ID && MOCK_USDC_MINT);
}

export function chainReadinessMessage(): string {
  if (!SOLANA_LIVE) return "SOLANA_LIVE=0 (offline mode)";
  if (!MOCK_USDC_MINT)
    return "Thiếu NEXT_PUBLIC_MOCK_USDC_MINT — chạy node scripts/setup-devnet.mjs";
  if (!PROGRAM_ID) return "Thiếu PROGRAM_ID";
  return "ready";
}

export function toUiEscrowStatus(
  s: OnChainEscrowStatus
): "UNFUNDED" | "FUNDED" | "LOCKED" | "RELEASED" | "REFUNDED" | "DISPUTED" {
  switch (s) {
    case "Unfunded":
    case "PartiallyFunded":
      return "UNFUNDED";
    case "Funded":
    case "FinderSet":
      return "FUNDED";
    case "Locked":
      return "LOCKED";
    case "Released":
      return "RELEASED";
    case "Refunded":
      return "REFUNDED";
    case "Disputed":
      return "DISPUTED";
  }
}

export function getEscrowSnapshot(caseId: string): EscrowSnapshot | null {
  return localMirror.get(caseId) ?? null;
}

export function getEscrowPdaBase58(caseId: string): string {
  try {
    return escrowPda(caseId)[0].toBase58();
  } catch {
    return "";
  }
}

function requireWallet(wallet: WalletLike | null | undefined): WalletLike {
  if (!wallet?.publicKey) {
    throw new Error(
      "Chưa nối ví. Vào /app/setup → Connect Phantom (Devnet) → Nạp tiền ảo miễn phí."
    );
  }
  return wallet;
}

function touch(
  caseId: string,
  patch: Partial<EscrowSnapshot> & { owner?: string; rewardUi?: number }
) {
  const prev = localMirror.get(caseId);
  const pda = getEscrowPdaBase58(caseId);
  const next: EscrowSnapshot = {
    caseId,
    status: patch.status ?? prev?.status ?? "Unfunded",
    rewardAtomic: patch.rewardAtomic ?? prev?.rewardAtomic ?? BigInt(0),
    fundedAtomic: patch.fundedAtomic ?? prev?.fundedAtomic ?? BigInt(0),
    owner: patch.owner ?? prev?.owner ?? "",
    finder: patch.finder !== undefined ? patch.finder : prev?.finder ?? null,
    authority: patch.authority ?? prev?.authority ?? "",
    mint: MOCK_USDC_MINT,
    otpHashHex: patch.otpHashHex ?? prev?.otpHashHex ?? null,
    pdaHint: pda ? `${pda.slice(0, 4)}…${pda.slice(-4)}` : prev?.pdaHint ?? "",
  };
  localMirror.set(caseId, next);
  return next;
}

export async function initializeCase(params: {
  caseId: string;
  rewardUi: number;
  owner: string;
  wallet: WalletLike | null;
  authority?: string;
}): Promise<EscrowTxResult> {
  if (!isChainReady()) throw new Error(chainReadinessMessage());
  const wallet = requireWallet(params.wallet);
  const tx = await initializeCaseOnChain({
    wallet,
    caseId: params.caseId,
    rewardUi: params.rewardUi,
    authority: params.authority ? new PublicKey(params.authority) : undefined,
  });
  touch(params.caseId, {
    status: "Unfunded",
    owner: wallet.publicKey.toBase58(),
    rewardAtomic: BigInt(Math.round(params.rewardUi * 1e6)),
  });
  return tx;
}

export async function fundEscrow(params: {
  caseId: string;
  amountUi: number;
  wallet: WalletLike | null;
}): Promise<EscrowTxResult> {
  if (!isChainReady()) throw new Error(chainReadinessMessage());
  const wallet = requireWallet(params.wallet);
  const tx = await fundEscrowOnChain({
    wallet,
    caseId: params.caseId,
    amountUi: params.amountUi,
  });
  const prev = localMirror.get(params.caseId);
  const funded =
    (prev?.fundedAtomic ?? BigInt(0)) +
    BigInt(Math.round(params.amountUi * 1e6));
  const reward = prev?.rewardAtomic ?? funded;
  touch(params.caseId, {
    status:
      funded >= reward
        ? prev?.finder
          ? "FinderSet"
          : "Funded"
        : "PartiallyFunded",
    fundedAtomic: funded,
    rewardAtomic: reward,
  });
  return tx;
}

export async function setFinder(params: {
  caseId: string;
  finder: string;
  wallet: WalletLike | null;
}): Promise<EscrowTxResult> {
  if (!isChainReady()) throw new Error(chainReadinessMessage());
  const wallet = requireWallet(params.wallet);
  const tx = await setFinderOnChain({
    wallet,
    caseId: params.caseId,
    finder: new PublicKey(params.finder),
  });
  const prev = localMirror.get(params.caseId);
  touch(params.caseId, {
    finder: params.finder,
    status:
      prev && prev.fundedAtomic >= prev.rewardAtomic && prev.rewardAtomic > 0
        ? "FinderSet"
        : prev?.status ?? "Unfunded",
  });
  return tx;
}

export async function lockForHandover(params: {
  caseId: string;
  otp: string;
  wallet: WalletLike | null;
}): Promise<EscrowTxResult> {
  if (!isChainReady()) throw new Error(chainReadinessMessage());
  const wallet = requireWallet(params.wallet);
  const tx = await lockForHandoverOnChain({
    authority: wallet,
    caseId: params.caseId,
    otp: params.otp,
  });
  touch(params.caseId, { status: "Locked" });
  return tx;
}

export async function releaseReward(params: {
  caseId: string;
  otp: string;
  wallet: WalletLike | null;
  finder: string;
  owner: string;
}): Promise<EscrowTxResult> {
  if (!isChainReady()) throw new Error(chainReadinessMessage());
  const wallet = requireWallet(params.wallet);
  const tx = await releaseRewardOnChain({
    authority: wallet,
    caseId: params.caseId,
    otp: params.otp,
    finder: new PublicKey(params.finder),
    owner: new PublicKey(params.owner),
  });
  touch(params.caseId, { status: "Released" });
  return tx;
}

export async function refundOwner(_params: {
  caseId: string;
  wallet: WalletLike | null;
}): Promise<EscrowTxResult> {
  throw new Error("refund_owner: dùng script CLI hoặc SafePoint staff key");
}

/** Seed UI mirror only — does NOT create on-chain accounts. */
export function seedDemoEscrow(params: {
  caseId: string;
  rewardUi: number;
  owner: string;
  status: OnChainEscrowStatus;
  finder?: string;
}): void {
  touch(params.caseId, {
    status: params.status,
    owner: params.owner,
    finder: params.finder ?? null,
    rewardAtomic: BigInt(Math.round(params.rewardUi * 1e6)),
    fundedAtomic:
      params.status === "Unfunded" || params.status === "PartiallyFunded"
        ? BigInt(0)
        : BigInt(Math.round(params.rewardUi * 1e6)),
  });
}

export const programMeta = {
  name: "safereturn_escrow",
  programId: PROGRAM_ID,
  cluster: "devnet" as const,
  live: SOLANA_LIVE,
  mint: MOCK_USDC_MINT || null,
  ready: isChainReady(),
  instructions: [
    "initialize_case",
    "fund_escrow",
    "set_finder",
    "lock_for_handover",
    "release_reward",
    "refund_owner",
    "open_dispute",
  ] as const,
};

export { explorerTxUrl };
