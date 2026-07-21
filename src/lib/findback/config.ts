/** SafeReturn — Solana Devnet config */

import { primarySolanaRpc, resolveSolanaRpcEndpoints } from "@/lib/solana/rpc-endpoints";

export const SOLANA_CLUSTER = "devnet" as const;

/** Primary Devnet RPC (dedicated provider preferred via NEXT_PUBLIC_SOLANA_RPC). */
export const SOLANA_RPC = primarySolanaRpc();

/** Full failover list used by Connection pooling. */
export const SOLANA_RPC_ENDPOINTS = resolveSolanaRpcEndpoints();

/** SafeReturn program (technical Anchor artifact name: findback). */
export const FINDBACK_PROGRAM_ID =
  process.env.NEXT_PUBLIC_FINDBACK_PROGRAM_ID ||
  "3hLzzJDHvbuKFPKweKEJ3ZAQEijoLLejkvi9ZPmByWna";

/**
 * FIND Reward Token — a real SPL token deployed on Devnet.
 * It has no monetary value and is used only by the escrow program.
 * Created by scripts/setup-findback-devnet.mjs
 */
export const FIND_MINT =
  process.env.NEXT_PUBLIC_FIND_MINT ||
  "9F6hBVk5V6HgdcRCsgApoGLU2n68qTYjHKESBoCKRmCy";

export const FIND_DECIMALS = 6;
export const FIND_SYMBOL = "FIND";
export const FIND_NAME = "FIND Reward Token";

/** Default arbiter (deployer) for dispute resolve */
export const ARBITER =
  process.env.NEXT_PUBLIC_ARBITER ||
  "DoNrsajZ2Yo8C1biPb8BiB2z3S5ZwZ9VWuFMwF8R2CUa";

export const SOLANA_LIVE =
  process.env.NEXT_PUBLIC_SOLANA_LIVE !== "0" &&
  process.env.NEXT_PUBLIC_SOLANA_LIVE !== "false";

/**
 * Protocol v2 (multi-claim + arbitration panel).
 * Enable with NEXT_PUBLIC_PROTOCOL_V2=1 after program + Supabase are aligned
 * (`npm run release:check:v2`).
 */
export const PROTOCOL_V2_ENABLED = process.env.NEXT_PUBLIC_PROTOCOL_V2 === "1";

/**
 * Client opt-in for fee sponsorship. Requires explicit NEXT_PUBLIC_SPONSORED_FEES=1
 * so demos without a sponsor keypair still use self-pay. The API enables when
 * SPONSOR_KEYPAIR_JSON is present (or SPONSORED_FEES_ENABLED=1).
 */
export const SPONSORED_FEES_ENABLED =
  PROTOCOL_V2_ENABLED && process.env.NEXT_PUBLIC_SPONSORED_FEES === "1";

export function explorerTxUrl(sig: string) {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

export function explorerAddressUrl(address: string) {
  return `https://explorer.solana.com/address/${address}?cluster=devnet`;
}

/** Token balances tab for a wallet (never append /tokens onto a URL that already has ?query) */
export function explorerTokensUrl(address: string) {
  return `https://explorer.solana.com/address/${address}/tokens?cluster=devnet`;
}

export function toAtomic(uiAmount: number): bigint {
  return BigInt(Math.round(uiAmount * 10 ** FIND_DECIMALS));
}

export function fromAtomic(atomic: bigint | number): number {
  return Number(atomic) / 10 ** FIND_DECIMALS;
}
