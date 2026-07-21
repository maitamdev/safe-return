/**
 * Devnet RPC endpoint list with primary + public fallbacks.
 * Prefer NEXT_PUBLIC_SOLANA_RPC (Helius/QuickNode/Alchemy) when set.
 */

const PUBLIC_DEVNET_FALLBACKS = [
  "https://api.devnet.solana.com",
  "https://rpc.ankr.com/solana_devnet",
] as const;

function normalizeRpcUrl(url: string) {
  return url.trim().replace(/\/+$/, "");
}

/** Ordered unique RPC URLs: primary first, then fallbacks. */
export function resolveSolanaRpcEndpoints(
  primary = process.env.NEXT_PUBLIC_SOLANA_RPC,
  extra = process.env.NEXT_PUBLIC_SOLANA_RPC_FALLBACKS,
): string[] {
  const list: string[] = [];
  const push = (raw?: string | null) => {
    if (!raw) return;
    for (const part of raw.split(",")) {
      const url = normalizeRpcUrl(part);
      if (!url) continue;
      if (!list.includes(url)) list.push(url);
    }
  };

  push(primary);
  push(extra);
  for (const fb of PUBLIC_DEVNET_FALLBACKS) push(fb);

  return list.length > 0 ? list : [...PUBLIC_DEVNET_FALLBACKS];
}

export function primarySolanaRpc(): string {
  return resolveSolanaRpcEndpoints()[0];
}
