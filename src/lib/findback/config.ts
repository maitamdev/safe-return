/** FindBack AI — Solana Devnet config */

export const SOLANA_CLUSTER = "devnet" as const;

export const SOLANA_RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.devnet.solana.com";

/** FindBack program (target/deploy/findback-keypair.json) */
export const FINDBACK_PROGRAM_ID =
  process.env.NEXT_PUBLIC_FINDBACK_PROGRAM_ID ||
  "3hLzzJDHvbuKFPKweKEJ3ZAQEijoLLejkvi9ZPmByWna";

/**
 * FIND Reward Token — Devnet SPL test mint (NOT real USDC).
 * Created by scripts/setup-findback-devnet.mjs
 */
export const FIND_MINT =
  process.env.NEXT_PUBLIC_FIND_MINT ||
  process.env.NEXT_PUBLIC_MOCK_USDC_MINT ||
  "9F6hBVk5V6HgdcRCsgApoGLU2n68qTYjHKESBoCKRmCy";

export const FIND_DECIMALS = 6;
export const FIND_SYMBOL = "FIND";
export const FIND_NAME = "FIND Reward Token";

/** Default arbiter (deployer) for dispute resolve */
export const ARBITER =
  process.env.NEXT_PUBLIC_ARBITER ||
  process.env.NEXT_PUBLIC_SAFEPOINT_AUTHORITY ||
  "DoNrsajZ2Yo8C1biPb8BiB2z3S5ZwZ9VWuFMwF8R2CUa";

export const SOLANA_LIVE =
  process.env.NEXT_PUBLIC_SOLANA_LIVE !== "0" &&
  process.env.NEXT_PUBLIC_SOLANA_LIVE !== "false";

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
