/**
 * SafeReturn Solana Devnet config — real chain, no mock mode by default.
 */

export const SOLANA_CLUSTER = "devnet" as const;

export const SOLANA_RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.devnet.solana.com";

/** Deployed program id (keypair in target/deploy/). */
export const PROGRAM_ID =
  process.env.NEXT_PUBLIC_SAFERETURN_PROGRAM_ID ||
  "8aPk563iNTtCP95gZ5EhdWJhTiL1cgKypcDUJikf3H6c";

/**
 * Mock-USDC mint on Devnet (created by scripts/setup-devnet.mjs).
 * Override after running setup.
 */
export const MOCK_USDC_MINT =
  process.env.NEXT_PUBLIC_MOCK_USDC_MINT ||
  process.env.NEXT_PUBLIC_FIND_MINT ||
  "9F6hBVk5V6HgdcRCsgApoGLU2n68qTYjHKESBoCKRmCy";

/** SafePoint staff authority pubkey (can lock/release). Defaults to deployer. */
export const SAFEPOINT_AUTHORITY =
  process.env.NEXT_PUBLIC_SAFEPOINT_AUTHORITY ||
  "DoNrsajZ2Yo8C1biPb8BiB2z3S5ZwZ9VWuFMwF8R2CUa";

export const USDC_DECIMALS = 6;

/**
 * Live on-chain mode. Default TRUE — real Devnet txs when wallet connected.
 * Set NEXT_PUBLIC_SOLANA_LIVE=0 only for offline UI walkthrough.
 */
export const SOLANA_LIVE =
  process.env.NEXT_PUBLIC_SOLANA_LIVE !== "0" &&
  process.env.NEXT_PUBLIC_SOLANA_LIVE !== "false";

export function explorerTxUrl(sig: string) {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

export function explorerAddressUrl(address: string) {
  return `https://explorer.solana.com/address/${address}?cluster=devnet`;
}

export function toAtomicUsdc(uiAmount: number): bigint {
  return BigInt(Math.round(uiAmount * 10 ** USDC_DECIMALS));
}

export function fromAtomicUsdc(atomic: bigint | number): number {
  return Number(atomic) / 10 ** USDC_DECIMALS;
}

export const DEPLOYER_HINT =
  "DoNrsajZ2Yo8C1biPb8BiB2z3S5ZwZ9VWuFMwF8R2CUa";
