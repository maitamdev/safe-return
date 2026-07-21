import { Connection, PublicKey, type Commitment } from "@solana/web3.js";
import { SOLANA_RPC, SOLANA_RPC_ENDPOINTS, FIND_MINT, ARBITER } from "../config";
import { withRpcEndpointFailover, withRpcReadRetry } from "@/lib/solana/rpc-read";

const CONNECTIONS = new Map<string, Connection>();

function connectionKey(endpoint: string, commitment: Commitment) {
  return `${endpoint}::${commitment}`;
}

export function getConnection(
  commitment: Commitment = "confirmed",
  endpoint: string = SOLANA_RPC,
) {
  const key = connectionKey(endpoint, commitment);
  const existing = CONNECTIONS.get(key);
  if (existing) return existing;
  const connection = new Connection(endpoint, {
    commitment,
    disableRetryOnRateLimit: false,
    confirmTransactionInitialTimeout: 60_000,
  });
  CONNECTIONS.set(key, connection);
  return connection;
}

/** Prefer the primary RPC; callers that need failover should use withConnectionFailover. */
export async function withConnectionFailover<T>(
  run: (connection: Connection) => Promise<T>,
  commitment: Commitment = "confirmed",
): Promise<T> {
  return withRpcEndpointFailover(
    async (endpoint) => run(getConnection(commitment, endpoint)),
    { endpoints: SOLANA_RPC_ENDPOINTS },
  );
}

export async function fetchSignatureStatus(signature: string) {
  return withConnectionFailover(async (connection) => {
    const response = await connection.getSignatureStatuses([signature], {
      searchTransactionHistory: true,
    });
    return response.value[0];
  });
}

export async function readAccountInfo(address: PublicKey) {
  return withConnectionFailover((connection) =>
    connection.getAccountInfo(address, "confirmed"),
  );
}

export function requireMint(): PublicKey {
  if (!FIND_MINT) {
    throw new Error("FIND_MINT not set. Run: npm run findback:setup");
  }
  return new PublicKey(FIND_MINT);
}

export function requireArbiter(): PublicKey {
  if (!ARBITER) throw new Error("ARBITER not configured");
  return new PublicKey(ARBITER);
}

/** Kept for call sites that still wrap a single connection with retry. */
export { withRpcReadRetry };
