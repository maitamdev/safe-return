/**
 * SafeReturn — real Solana client (Anchor discriminators, no fake txs).
 */

import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  VersionedTransaction,
  type Commitment,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";
import {
  FINDBACK_PROGRAM_ID,
  SOLANA_RPC,
  FIND_MINT,
  ARBITER,
  toAtomic,
  explorerTxUrl,
} from "./config";
import { withRpcReadRetry } from "@/lib/solana/rpc-read";

export const PROGRAM_PK = new PublicKey(FINDBACK_PROGRAM_ID);
export const BOUNTY_SEED = Buffer.from("bounty");
export const VAULT_SEED = Buffer.from("vault");
export const CLAIM_V2_SEED = Buffer.from("claim_v2");
export const REPUTATION_SEED = Buffer.from("reputation");
export const RETURN_ATTESTATION_SEED = Buffer.from("return_attestation");
export const ARBITRATION_PANEL_SEED = Buffer.from("arbitration_panel");
export const DISPUTE_CASE_SEED = Buffer.from("dispute_case");
export const ARBITRATION_VOTE_SEED = Buffer.from("arbitration_vote");

/** sha256("global:<name>")[0..8] */
export const IX = {
  create_bounty: Buffer.from([122, 90, 14, 143, 8, 125, 200, 2]),
  create_bounty_v2: Buffer.from([251, 239, 2, 223, 130, 60, 86, 29]),
  fund_bounty: Buffer.from([36, 148, 139, 239, 172, 37, 58, 255]),
  submit_claim: Buffer.from([163, 108, 111, 46, 220, 82, 77, 212]),
  record_ai_review: Buffer.from([124, 116, 24, 236, 214, 167, 231, 54]),
  accept_claim: Buffer.from([139, 66, 180, 182, 209, 194, 173, 87]),
  reject_claim: Buffer.from([238, 185, 227, 8, 51, 188, 35, 182]),
  refund_after_expiry: Buffer.from([210, 2, 52, 232, 49, 218, 178, 59]),
  cancel_bounty: Buffer.from([79, 65, 107, 143, 128, 165, 135, 46]),
  open_dispute: Buffer.from([137, 25, 99, 119, 23, 223, 161, 42]),
  resolve_dispute: Buffer.from([231, 6, 202, 6, 96, 103, 12, 230]),
  submit_claim_v2: Buffer.from([11, 80, 192, 135, 76, 136, 80, 39]),
  record_ai_review_v2: Buffer.from([26, 254, 147, 241, 70, 209, 216, 6]),
  accept_claim_v2: Buffer.from([162, 165, 30, 224, 250, 107, 148, 218]),
  reject_claim_v2: Buffer.from([178, 62, 173, 231, 192, 12, 42, 112]),
  open_dispute_v2: Buffer.from([61, 105, 238, 185, 222, 78, 48, 138]),
  resolve_dispute_v2: Buffer.from([35, 255, 241, 246, 120, 1, 194, 73]),
  attest_settlement: Buffer.from([139, 194, 42, 227, 36, 121, 240, 227]),
  create_bounty_sponsored: Buffer.from([60, 19, 90, 70, 98, 64, 136, 4]),
  fund_bounty_sponsored: Buffer.from([84, 28, 214, 201, 200, 21, 52, 48]),
  submit_claim_v2_sponsored: Buffer.from([88, 167, 40, 12, 141, 217, 243, 23]),
  configure_arbitration_panel: Buffer.from([103, 173, 78, 35, 189, 128, 231, 69]),
  open_dispute_v3: Buffer.from([226, 175, 136, 76, 202, 96, 200, 102]),
  cast_arbitration_vote: Buffer.from([240, 213, 221, 193, 161, 207, 1, 252]),
  finalize_dispute_release: Buffer.from([34, 134, 74, 54, 225, 183, 18, 47]),
  finalize_dispute_reject: Buffer.from([171, 128, 196, 66, 131, 203, 114, 117]),
} as const;

const CLAIM_V2_DISCRIMINATOR = Buffer.from([91, 3, 14, 101, 67, 160, 222, 63]);
const CLAIM_V2_ACCOUNT_SIZE = 253;
const REPUTATION_DISCRIMINATOR = Buffer.from([
  55, 148, 90, 71, 68, 183, 193, 28,
]);
const RETURN_ATTESTATION_DISCRIMINATOR = Buffer.from([
  186, 34, 108, 39, 171, 28, 141, 60,
]);
const ARBITRATION_PANEL_DISCRIMINATOR = Buffer.from([
  127, 28, 248, 19, 204, 212, 112, 66,
]);
const DISPUTE_CASE_DISCRIMINATOR = Buffer.from([
  164, 200, 54, 239, 94, 76, 51, 130,
]);
const ARBITRATION_VOTE_DISCRIMINATOR = Buffer.from([
  250, 100, 186, 28, 204, 26, 41, 91,
]);

export type WalletLike = {
  publicKey: PublicKey;
  signTransaction: <T extends Transaction>(tx: T) => Promise<T>;
};

export type BountyStatusName =
  | "Draft"
  | "Funded"
  | "ClaimSubmitted"
  | "AiReviewed"
  | "Accepted"
  | "Released"
  | "Rejected"
  | "Disputed"
  | "Refunded"
  | "Expired"
  | "Cancelled"
  | "Unknown";

const STATUS_MAP: BountyStatusName[] = [
  "Draft",
  "Funded",
  "ClaimSubmitted",
  "AiReviewed",
  "Accepted",
  "Released",
  "Rejected",
  "Disputed",
  "Refunded",
  "Expired",
  "Cancelled",
];

export type OnChainBounty = {
  address: string;
  owner: string;
  finder: string;
  arbiter: string;
  mint: string;
  bountyId: string;
  rewardAmount: bigint;
  amountFunded: bigint;
  deadline: number;
  status: BountyStatusName;
  metadataHash: Uint8Array;
  evidenceHash: Uint8Array;
  aiScore: number;
  aiRisk: number;
  aiDecision: number;
  aiExplanationHash: Uint8Array;
  createdAt: number;
  updatedAt: number;
  protocolVersion: number;
  arbitrationMode: number;
};

export type ClaimV2StatusName =
  "Submitted" | "AiReviewed" | "Rejected" | "Disputed" | "Settled" | "Unknown";

const CLAIM_V2_STATUS_MAP: ClaimV2StatusName[] = [
  "Submitted",
  "AiReviewed",
  "Rejected",
  "Disputed",
  "Settled",
];

export type OnChainClaimV2 = {
  address: string;
  bounty: string;
  finder: string;
  evidenceHash: Uint8Array;
  aiInputHash: Uint8Array;
  aiReportHash: Uint8Array;
  aiModelHash: Uint8Array;
  aiScore: number;
  aiRisk: number;
  aiDecision: number;
  status: ClaimV2StatusName;
  createdAt: number;
  updatedAt: number;
};

export type OnChainReputation = {
  address: string;
  wallet: string;
  successfulReturns: number;
  rewardsEarned: bigint;
  rewardsPaid: bigint;
  lastActivity: number;
};

export type OnChainReturnAttestation = {
  address: string;
  bounty: string;
  claim: string;
  owner: string;
  finder: string;
  rewardAmount: bigint;
  aiScore: number;
  settledAt: number;
};

export type OnChainArbitrationPanel = {
  address: string;
  bounty: string;
  arbiters: [string, string, string];
  quorum: number;
  createdAt: number;
};

export type OnChainDisputeCase = {
  address: string;
  bounty: string;
  claim: string;
  panel: string;
  releaseVotes: number;
  rejectVotes: number;
  decision: 0 | 1 | 2;
  finalized: boolean;
  createdAt: number;
  resolvedAt: number;
};

export type OnChainArbitrationVote = {
  address: string;
  disputeCase: string;
  arbiter: string;
  releaseToFinder: boolean;
  votedAt: number;
};

const CONNECTIONS = new Map<Commitment, Connection>();

export function getConnection(commitment: Commitment = "confirmed") {
  const existing = CONNECTIONS.get(commitment);
  if (existing) return existing;
  const connection = new Connection(SOLANA_RPC, {
    commitment,
    disableRetryOnRateLimit: false,
    confirmTransactionInitialTimeout: 60_000,
  });
  CONNECTIONS.set(commitment, connection);
  return connection;
}

export async function fetchSignatureStatus(signature: string) {
  const response = await withRpcReadRetry(() =>
    getConnection().getSignatureStatuses([signature], {
      searchTransactionHistory: true,
    }),
  );
  return response.value[0];
}

async function readAccountInfo(address: PublicKey) {
  return withRpcReadRetry(() =>
    getConnection().getAccountInfo(address, "confirmed"),
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

export function bountyPda(bountyId: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [BOUNTY_SEED, Buffer.from(bountyId)],
    PROGRAM_PK,
  );
}

export function vaultAuthorityPda(bountyId: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [VAULT_SEED, Buffer.from(bountyId)],
    PROGRAM_PK,
  );
}

export function claimV2Pda(
  bountyId: string,
  finder: PublicKey,
): [PublicKey, number] {
  const [bounty] = bountyPda(bountyId);
  return PublicKey.findProgramAddressSync(
    [CLAIM_V2_SEED, bounty.toBuffer(), finder.toBuffer()],
    PROGRAM_PK,
  );
}

export function reputationPda(wallet: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [REPUTATION_SEED, wallet.toBuffer()],
    PROGRAM_PK,
  );
}

export function returnAttestationPda(
  bountyId: string,
  finder: PublicKey,
): [PublicKey, number] {
  const [bounty] = bountyPda(bountyId);
  const [claim] = claimV2Pda(bountyId, finder);
  return PublicKey.findProgramAddressSync(
    [RETURN_ATTESTATION_SEED, bounty.toBuffer(), claim.toBuffer()],
    PROGRAM_PK,
  );
}

export function arbitrationPanelPda(bountyId: string): [PublicKey, number] {
  const [bounty] = bountyPda(bountyId);
  return PublicKey.findProgramAddressSync(
    [ARBITRATION_PANEL_SEED, bounty.toBuffer()],
    PROGRAM_PK
  );
}

export function disputeCasePda(
  bountyId: string,
  finder: PublicKey
): [PublicKey, number] {
  const [claim] = claimV2Pda(bountyId, finder);
  return PublicKey.findProgramAddressSync(
    [DISPUTE_CASE_SEED, claim.toBuffer()],
    PROGRAM_PK
  );
}

export function arbitrationVotePda(
  bountyId: string,
  finder: PublicKey,
  arbiter: PublicKey
): [PublicKey, number] {
  const [disputeCase] = disputeCasePda(bountyId, finder);
  return PublicKey.findProgramAddressSync(
    [ARBITRATION_VOTE_SEED, disputeCase.toBuffer(), arbiter.toBuffer()],
    PROGRAM_PK
  );
}

function attestSettlementInstruction(args: {
  payer: PublicKey;
  owner: PublicKey;
  finder: PublicKey;
  bountyId: string;
}): TransactionInstruction {
  const [bounty] = bountyPda(args.bountyId);
  const [claim] = claimV2Pda(args.bountyId, args.finder);
  const [attestation] = returnAttestationPda(args.bountyId, args.finder);
  const [ownerReputation] = reputationPda(args.owner);
  const [finderReputation] = reputationPda(args.finder);
  return new TransactionInstruction({
    programId: PROGRAM_PK,
    keys: [
      { pubkey: args.payer, isSigner: true, isWritable: true },
      { pubkey: args.owner, isSigner: false, isWritable: false },
      { pubkey: args.finder, isSigner: false, isWritable: false },
      { pubkey: bounty, isSigner: false, isWritable: false },
      { pubkey: claim, isSigner: false, isWritable: false },
      { pubkey: attestation, isSigner: false, isWritable: true },
      { pubkey: ownerReputation, isSigner: false, isWritable: true },
      { pubkey: finderReputation, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(IX.attest_settlement),
  });
}

function encodeString(s: string): Buffer {
  const body = Buffer.from(s, "utf8");
  const out = Buffer.alloc(4 + body.length);
  out.writeUInt32LE(body.length, 0);
  body.copy(out, 4);
  return out;
}

function encodeU64(n: bigint | number): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(n));
  return b;
}

function encodeI64(n: number): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigInt64LE(BigInt(n));
  return b;
}

function encodeBytes32(h: Uint8Array | Buffer): Buffer {
  const b = Buffer.alloc(32);
  Buffer.from(h).copy(b, 0, 0, 32);
  return b;
}

export function createBountySponsoredInstruction(args: {
  owner: PublicKey;
  sponsor: PublicKey;
  bountyId: string;
  rewardAmount: bigint;
  deadlineUnix: number;
  metadataHash: Uint8Array;
}): TransactionInstruction {
  const mint = requireMint();
  const arbiter = requireArbiter();
  const [bounty] = bountyPda(args.bountyId);
  const [vaultAuthority] = vaultAuthorityPda(args.bountyId);
  return new TransactionInstruction({
    programId: PROGRAM_PK,
    keys: [
      { pubkey: args.owner, isSigner: true, isWritable: false },
      { pubkey: args.sponsor, isSigner: true, isWritable: true },
      { pubkey: arbiter, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: bounty, isSigner: false, isWritable: true },
      { pubkey: vaultAuthority, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([
      IX.create_bounty_sponsored,
      encodeString(args.bountyId),
      encodeU64(args.rewardAmount),
      encodeI64(args.deadlineUnix),
      encodeBytes32(args.metadataHash),
    ]),
  });
}

export function fundBountySponsoredInstruction(args: {
  owner: PublicKey;
  sponsor: PublicKey;
  bountyId: string;
  amount: bigint;
}): TransactionInstruction {
  const mint = requireMint();
  const [bounty] = bountyPda(args.bountyId);
  const [vaultAuthority] = vaultAuthorityPda(args.bountyId);
  const ownerToken = getAssociatedTokenAddressSync(mint, args.owner);
  const vaultToken = getAssociatedTokenAddressSync(mint, vaultAuthority, true);
  return new TransactionInstruction({
    programId: PROGRAM_PK,
    keys: [
      { pubkey: args.owner, isSigner: true, isWritable: false },
      { pubkey: args.sponsor, isSigner: true, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: bounty, isSigner: false, isWritable: true },
      { pubkey: vaultAuthority, isSigner: false, isWritable: false },
      { pubkey: ownerToken, isSigner: false, isWritable: true },
      { pubkey: vaultToken, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([IX.fund_bounty_sponsored, encodeU64(args.amount)]),
  });
}

export function submitClaimV2SponsoredInstruction(args: {
  finder: PublicKey;
  sponsor: PublicKey;
  bountyId: string;
  evidenceHash: Uint8Array;
}): TransactionInstruction {
  const [bounty] = bountyPda(args.bountyId);
  const [claim] = claimV2Pda(args.bountyId, args.finder);
  return new TransactionInstruction({
    programId: PROGRAM_PK,
    keys: [
      { pubkey: args.finder, isSigner: true, isWritable: false },
      { pubkey: args.sponsor, isSigner: true, isWritable: true },
      { pubkey: bounty, isSigner: false, isWritable: false },
      { pubkey: claim, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([
      IX.submit_claim_v2_sponsored,
      encodeBytes32(args.evidenceHash),
    ]),
  });
}

async function sendIx(
  wallet: WalletLike,
  ixs: TransactionInstruction[],
  label: string,
): Promise<{ signature: string; url: string }> {
  const connection = getConnection();
  const { blockhash, lastValidBlockHeight } =
    await withRpcReadRetry(() => connection.getLatestBlockhash("confirmed"));
  const tx = new Transaction({
    feePayer: wallet.publicKey,
    blockhash,
    lastValidBlockHeight,
  });
  for (const ix of ixs) tx.add(ix);

  const message = tx.compileMessage();
  if (message.header.numRequiredSignatures !== 1) {
    throw new Error(
      `${label}: giao dịch phải chỉ có một ví ký, nhưng đang yêu cầu ${message.header.numRequiredSignatures} chữ ký.`,
    );
  }

  const wireSize = tx.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  }).length;
  if (wireSize > 1232) {
    throw new Error(
      `${label}: giao dịch dài ${wireSize} byte, vượt giới hạn 1232 byte của Solana.`,
    );
  }

  // Phantom recommends simulating with sigVerify=false before requesting a
  // wallet signature. A VersionedTransaction lets web3.js pass that option
  // explicitly while the wallet can still sign the familiar legacy tx.
  const simulation = await withRpcReadRetry(() =>
    connection.simulateTransaction(new VersionedTransaction(message), {
      commitment: "confirmed",
      sigVerify: false,
    }),
  );
  if (simulation.value.err) {
    const logs =
      simulation.value.logs?.slice(-8).join(" | ") || "Không có log RPC";
    const simulationError = JSON.stringify(
      simulation.value.err,
      (_key, value) => (typeof value === "bigint" ? value.toString() : value),
    );
    throw new Error(
      `${label}: mô phỏng Devnet thất bại (${simulationError}). ${logs}`,
    );
  }

  const signed = await wallet.signTransaction(tx);
  // Retrying the exact same signed bytes is idempotent: Solana derives the
  // same signature, so a lost/429 response cannot create a second payment.
  const wire = signed.serialize();
  const sig = await withRpcReadRetry(() =>
    connection.sendRawTransaction(wire, {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    }),
  );
  await withRpcReadRetry(() =>
    connection.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight },
      "confirmed",
    ),
  );
  return { signature: sig, url: explorerTxUrl(sig) };
}

function createAtaIx(
  payer: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
): TransactionInstruction {
  const ata = getAssociatedTokenAddressSync(mint, owner, true);
  // No getAccountInfo round-trip: this is a no-op when the ATA exists.
  return createAssociatedTokenAccountIdempotentInstruction(
    payer,
    ata,
    owner,
    mint,
  );
}

export async function createBountyOnChain(
  wallet: WalletLike,
  args: {
    bountyId: string;
    rewardUi: number;
    deadlineUnix: number;
    metadataHash: Uint8Array;
  },
) {
  const mint = requireMint();
  const arbiter = requireArbiter();
  const [bounty] = bountyPda(args.bountyId);
  const [vaultAuth] = vaultAuthorityPda(args.bountyId);
  const data = Buffer.concat([
    IX.create_bounty,
    encodeString(args.bountyId),
    encodeU64(toAtomic(args.rewardUi)),
    encodeI64(args.deadlineUnix),
    encodeBytes32(args.metadataHash),
  ]);
  const ix = new TransactionInstruction({
    programId: PROGRAM_PK,
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: arbiter, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: bounty, isSigner: false, isWritable: true },
      { pubkey: vaultAuth, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
  return sendIx(wallet, [ix], "create_bounty");
}

export async function createBountyV2OnChain(
  wallet: WalletLike,
  args: {
    bountyId: string;
    rewardUi: number;
    deadlineUnix: number;
    metadataHash: Uint8Array;
  },
) {
  const mint = requireMint();
  const arbiter = requireArbiter();
  const [bounty] = bountyPda(args.bountyId);
  const [vaultAuth] = vaultAuthorityPda(args.bountyId);
  const data = Buffer.concat([
    IX.create_bounty_v2,
    encodeString(args.bountyId),
    encodeU64(toAtomic(args.rewardUi)),
    encodeI64(args.deadlineUnix),
    encodeBytes32(args.metadataHash),
  ]);
  const ix = new TransactionInstruction({
    programId: PROGRAM_PK,
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: arbiter, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: bounty, isSigner: false, isWritable: true },
      { pubkey: vaultAuth, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
  return sendIx(wallet, [ix], "create_bounty_v2");
}

export async function fundBountyOnChain(
  wallet: WalletLike,
  bountyId: string,
  amountUi: number,
) {
  const mint = requireMint();
  const [bounty] = bountyPda(bountyId);
  const [vaultAuth] = vaultAuthorityPda(bountyId);
  const ownerAta = getAssociatedTokenAddressSync(mint, wallet.publicKey);
  const vaultAta = getAssociatedTokenAddressSync(mint, vaultAuth, true);

  const data = Buffer.concat([IX.fund_bounty, encodeU64(toAtomic(amountUi))]);
  const ixs = [
    new TransactionInstruction({
      programId: PROGRAM_PK,
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: bounty, isSigner: false, isWritable: true },
        { pubkey: vaultAuth, isSigner: false, isWritable: false },
        { pubkey: ownerAta, isSigner: false, isWritable: true },
        { pubkey: vaultAta, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        {
          pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,
          isSigner: false,
          isWritable: false,
        },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    }),
  ];
  return sendIx(wallet, ixs, "fund_bounty");
}

export async function submitClaimOnChain(
  wallet: WalletLike,
  bountyId: string,
  evidenceHash: Uint8Array,
) {
  const [bounty] = bountyPda(bountyId);
  const data = Buffer.concat([IX.submit_claim, encodeBytes32(evidenceHash)]);
  const ix = new TransactionInstruction({
    programId: PROGRAM_PK,
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
      { pubkey: bounty, isSigner: false, isWritable: true },
    ],
    data,
  });
  return sendIx(wallet, [ix], "submit_claim");
}

export async function submitClaimV2OnChain(
  wallet: WalletLike,
  bountyId: string,
  evidenceHash: Uint8Array,
) {
  const [bounty] = bountyPda(bountyId);
  const [claim] = claimV2Pda(bountyId, wallet.publicKey);
  const ix = new TransactionInstruction({
    programId: PROGRAM_PK,
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: bounty, isSigner: false, isWritable: false },
      { pubkey: claim, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([IX.submit_claim_v2, encodeBytes32(evidenceHash)]),
  });
  const result = await sendIx(wallet, [ix], "submit_claim_v2");
  return { ...result, claimPda: claim.toBase58() };
}

export async function recordAiReviewOnChain(
  wallet: WalletLike,
  bountyId: string,
  args: {
    score: number;
    riskLevel: number;
    decision: number;
    explanationHash: Uint8Array;
  },
) {
  const [bounty] = bountyPda(bountyId);
  const data = Buffer.concat([
    IX.record_ai_review,
    Buffer.from([args.score & 0xff]),
    Buffer.from([args.riskLevel & 0xff]),
    Buffer.from([args.decision & 0xff]),
    encodeBytes32(args.explanationHash),
  ]);
  const ix = new TransactionInstruction({
    programId: PROGRAM_PK,
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
      { pubkey: bounty, isSigner: false, isWritable: true },
    ],
    data,
  });
  return sendIx(wallet, [ix], "record_ai_review");
}

export async function recordAiReviewV2OnChain(
  wallet: WalletLike,
  bountyId: string,
  finder: PublicKey,
  args: {
    score: number;
    riskLevel: number;
    decision: number;
    inputHash: Uint8Array;
    reportHash: Uint8Array;
    modelHash: Uint8Array;
  },
) {
  const [bounty] = bountyPda(bountyId);
  const [claim] = claimV2Pda(bountyId, finder);
  const ix = new TransactionInstruction({
    programId: PROGRAM_PK,
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
      { pubkey: bounty, isSigner: false, isWritable: false },
      { pubkey: claim, isSigner: false, isWritable: true },
    ],
    data: Buffer.concat([
      IX.record_ai_review_v2,
      Buffer.from([
        args.score & 0xff,
        args.riskLevel & 0xff,
        args.decision & 0xff,
      ]),
      encodeBytes32(args.inputHash),
      encodeBytes32(args.reportHash),
      encodeBytes32(args.modelHash),
    ]),
  });
  return sendIx(wallet, [ix], "record_ai_review_v2");
}

export async function acceptClaimOnChain(
  wallet: WalletLike,
  bountyId: string,
  finder: PublicKey,
) {
  const mint = requireMint();
  const [bounty] = bountyPda(bountyId);
  const [vaultAuth] = vaultAuthorityPda(bountyId);
  const vaultAta = getAssociatedTokenAddressSync(mint, vaultAuth, true);
  const finderAta = getAssociatedTokenAddressSync(mint, finder, true);

  const data = Buffer.from(IX.accept_claim);
  const ix = new TransactionInstruction({
    programId: PROGRAM_PK,
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: finder, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: bounty, isSigner: false, isWritable: true },
      { pubkey: vaultAuth, isSigner: false, isWritable: false },
      { pubkey: vaultAta, isSigner: false, isWritable: true },
      { pubkey: finderAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      {
        pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
  return sendIx(wallet, [ix], "accept_claim");
}

export async function acceptClaimV2OnChain(
  wallet: WalletLike,
  bountyId: string,
  finder: PublicKey,
) {
  const mint = requireMint();
  const [bounty] = bountyPda(bountyId);
  const [claim] = claimV2Pda(bountyId, finder);
  const [vaultAuth] = vaultAuthorityPda(bountyId);
  const vaultAta = getAssociatedTokenAddressSync(mint, vaultAuth, true);
  const finderAta = getAssociatedTokenAddressSync(mint, finder, true);
  const ix = new TransactionInstruction({
    programId: PROGRAM_PK,
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: finder, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: bounty, isSigner: false, isWritable: true },
      { pubkey: claim, isSigner: false, isWritable: true },
      { pubkey: vaultAuth, isSigner: false, isWritable: false },
      { pubkey: vaultAta, isSigner: false, isWritable: true },
      { pubkey: finderAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      {
        pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(IX.accept_claim_v2),
  });
  const attestIx = attestSettlementInstruction({
    payer: wallet.publicKey,
    owner: wallet.publicKey,
    finder,
    bountyId,
  });
  return sendIx(wallet, [ix, attestIx], "accept_claim_v2 + attest_settlement");
}

export async function rejectClaimOnChain(wallet: WalletLike, bountyId: string) {
  const [bounty] = bountyPda(bountyId);
  const ix = new TransactionInstruction({
    programId: PROGRAM_PK,
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
      { pubkey: bounty, isSigner: false, isWritable: true },
    ],
    data: Buffer.from(IX.reject_claim),
  });
  return sendIx(wallet, [ix], "reject_claim");
}

export async function rejectClaimV2OnChain(
  wallet: WalletLike,
  bountyId: string,
  finder: PublicKey,
) {
  const [bounty] = bountyPda(bountyId);
  const [claim] = claimV2Pda(bountyId, finder);
  const ix = new TransactionInstruction({
    programId: PROGRAM_PK,
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
      { pubkey: bounty, isSigner: false, isWritable: false },
      { pubkey: claim, isSigner: false, isWritable: true },
    ],
    data: Buffer.from(IX.reject_claim_v2),
  });
  return sendIx(wallet, [ix], "reject_claim_v2");
}

export async function refundAfterExpiryOnChain(
  wallet: WalletLike,
  bountyId: string,
) {
  const mint = requireMint();
  const [bounty] = bountyPda(bountyId);
  const [vaultAuth] = vaultAuthorityPda(bountyId);
  const vaultAta = getAssociatedTokenAddressSync(mint, vaultAuth, true);
  const ownerAta = getAssociatedTokenAddressSync(mint, wallet.publicKey);

  const ix = new TransactionInstruction({
    programId: PROGRAM_PK,
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: bounty, isSigner: false, isWritable: true },
      { pubkey: vaultAuth, isSigner: false, isWritable: false },
      { pubkey: vaultAta, isSigner: false, isWritable: true },
      { pubkey: ownerAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(IX.refund_after_expiry),
  });
  return sendIx(wallet, [ix], "refund_after_expiry");
}

export async function openDisputeOnChain(wallet: WalletLike, bountyId: string) {
  const [bounty] = bountyPda(bountyId);
  const ix = new TransactionInstruction({
    programId: PROGRAM_PK,
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
      { pubkey: bounty, isSigner: false, isWritable: true },
    ],
    data: Buffer.from(IX.open_dispute),
  });
  return sendIx(wallet, [ix], "open_dispute");
}

export async function openDisputeV2OnChain(
  wallet: WalletLike,
  bountyId: string,
  finder: PublicKey,
) {
  const [bounty] = bountyPda(bountyId);
  const [claim] = claimV2Pda(bountyId, finder);
  const ix = new TransactionInstruction({
    programId: PROGRAM_PK,
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
      { pubkey: bounty, isSigner: false, isWritable: false },
      { pubkey: claim, isSigner: false, isWritable: true },
    ],
    data: Buffer.from(IX.open_dispute_v2),
  });
  return sendIx(wallet, [ix], "open_dispute_v2");
}

export async function configureArbitrationPanelOnChain(
  wallet: WalletLike,
  bountyId: string,
  arbiters: [PublicKey, PublicKey, PublicKey]
) {
  const [bounty] = bountyPda(bountyId);
  const [panel] = arbitrationPanelPda(bountyId);
  const ix = new TransactionInstruction({
    programId: PROGRAM_PK,
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: bounty, isSigner: false, isWritable: true },
      { pubkey: panel, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([
      IX.configure_arbitration_panel,
      ...arbiters.map((arbiter) => arbiter.toBuffer()),
      Buffer.from([2]),
    ]),
  });
  const result = await sendIx(wallet, [ix], "configure_arbitration_panel");
  return { ...result, panelPda: panel.toBase58() };
}

export async function openDisputeV3OnChain(
  wallet: WalletLike,
  bountyId: string,
  finder: PublicKey
) {
  const [bounty] = bountyPda(bountyId);
  const [claim] = claimV2Pda(bountyId, finder);
  const [panel] = arbitrationPanelPda(bountyId);
  const [disputeCase] = disputeCasePda(bountyId, finder);
  const ix = new TransactionInstruction({
    programId: PROGRAM_PK,
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: bounty, isSigner: false, isWritable: false },
      { pubkey: claim, isSigner: false, isWritable: true },
      { pubkey: panel, isSigner: false, isWritable: false },
      { pubkey: disputeCase, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(IX.open_dispute_v3),
  });
  const result = await sendIx(wallet, [ix], "open_dispute_v3");
  return { ...result, disputeCasePda: disputeCase.toBase58() };
}

export async function castArbitrationVoteOnChain(
  wallet: WalletLike,
  bountyId: string,
  finder: PublicKey,
  releaseToFinder: boolean
) {
  const [panel] = arbitrationPanelPda(bountyId);
  const [claim] = claimV2Pda(bountyId, finder);
  const [disputeCase] = disputeCasePda(bountyId, finder);
  const [vote] = arbitrationVotePda(bountyId, finder, wallet.publicKey);
  const ix = new TransactionInstruction({
    programId: PROGRAM_PK,
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: panel, isSigner: false, isWritable: false },
      { pubkey: disputeCase, isSigner: false, isWritable: true },
      { pubkey: claim, isSigner: false, isWritable: false },
      { pubkey: vote, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([
      IX.cast_arbitration_vote,
      Buffer.from([releaseToFinder ? 1 : 0]),
    ]),
  });
  return sendIx(wallet, [ix], "cast_arbitration_vote");
}

export async function finalizeDisputeReleaseOnChain(
  wallet: WalletLike,
  bountyId: string,
  finder: PublicKey
) {
  const mint = requireMint();
  const onChainBounty = await fetchBounty(bountyId);
  if (!onChainBounty) throw new Error("Không đọc được bounty từ Solana Devnet.");
  const owner = new PublicKey(onChainBounty.owner);
  const [bounty] = bountyPda(bountyId);
  const [claim] = claimV2Pda(bountyId, finder);
  const [panel] = arbitrationPanelPda(bountyId);
  const [disputeCase] = disputeCasePda(bountyId, finder);
  const [vaultAuthority] = vaultAuthorityPda(bountyId);
  const vaultToken = getAssociatedTokenAddressSync(mint, vaultAuthority, true);
  const finderToken = getAssociatedTokenAddressSync(mint, finder, true);
  const settleIx = new TransactionInstruction({
    programId: PROGRAM_PK,
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: finder, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: bounty, isSigner: false, isWritable: true },
      { pubkey: claim, isSigner: false, isWritable: true },
      { pubkey: panel, isSigner: false, isWritable: false },
      { pubkey: disputeCase, isSigner: false, isWritable: true },
      { pubkey: vaultAuthority, isSigner: false, isWritable: false },
      { pubkey: vaultToken, isSigner: false, isWritable: true },
      { pubkey: finderToken, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(IX.finalize_dispute_release),
  });
  const attestIx = attestSettlementInstruction({
    payer: wallet.publicKey,
    owner,
    finder,
    bountyId,
  });
  return sendIx(
    wallet,
    [settleIx, attestIx],
    "finalize_dispute_release + attest_settlement"
  );
}

export async function finalizeDisputeRejectOnChain(
  wallet: WalletLike,
  bountyId: string,
  finder: PublicKey
) {
  const [bounty] = bountyPda(bountyId);
  const [claim] = claimV2Pda(bountyId, finder);
  const [panel] = arbitrationPanelPda(bountyId);
  const [disputeCase] = disputeCasePda(bountyId, finder);
  const ix = new TransactionInstruction({
    programId: PROGRAM_PK,
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
      { pubkey: bounty, isSigner: false, isWritable: false },
      { pubkey: claim, isSigner: false, isWritable: true },
      { pubkey: panel, isSigner: false, isWritable: false },
      { pubkey: disputeCase, isSigner: false, isWritable: true },
    ],
    data: Buffer.from(IX.finalize_dispute_reject),
  });
  return sendIx(wallet, [ix], "finalize_dispute_reject");
}

export async function cancelBountyOnChain(
  wallet: WalletLike,
  bountyId: string,
) {
  const [bounty] = bountyPda(bountyId);
  const ix = new TransactionInstruction({
    programId: PROGRAM_PK,
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
      { pubkey: bounty, isSigner: false, isWritable: true },
    ],
    data: Buffer.from(IX.cancel_bounty),
  });
  return sendIx(wallet, [ix], "cancel_bounty");
}

export async function resolveDisputeOnChain(
  wallet: WalletLike,
  bountyId: string,
  counterparty: PublicKey,
  releaseToFinder: boolean,
) {
  const mint = requireMint();
  const [bounty] = bountyPda(bountyId);
  const [vaultAuth] = vaultAuthorityPda(bountyId);
  const vaultAta = getAssociatedTokenAddressSync(mint, vaultAuth, true);
  const counterpartyAta = getAssociatedTokenAddressSync(
    mint,
    counterparty,
    true,
  );
  const createAta = createAtaIx(
    wallet.publicKey,
    counterparty,
    mint,
  );
  const ix = new TransactionInstruction({
    programId: PROGRAM_PK,
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
      { pubkey: counterparty, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: bounty, isSigner: false, isWritable: true },
      { pubkey: vaultAuth, isSigner: false, isWritable: false },
      { pubkey: vaultAta, isSigner: false, isWritable: true },
      { pubkey: counterpartyAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([
      IX.resolve_dispute,
      Buffer.from([releaseToFinder ? 1 : 0]),
    ]),
  });
  return sendIx(wallet, [createAta, ix], "resolve_dispute");
}

export async function resolveDisputeV2OnChain(
  wallet: WalletLike,
  bountyId: string,
  finder: PublicKey,
  releaseToFinder: boolean,
) {
  const mint = requireMint();
  const [bounty] = bountyPda(bountyId);
  const [claim] = claimV2Pda(bountyId, finder);
  const [vaultAuth] = vaultAuthorityPda(bountyId);
  const vaultAta = getAssociatedTokenAddressSync(mint, vaultAuth, true);
  const finderAta = getAssociatedTokenAddressSync(mint, finder, true);
  const createAta = createAtaIx(
    wallet.publicKey,
    finder,
    mint,
  );
  const ix = new TransactionInstruction({
    programId: PROGRAM_PK,
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
      { pubkey: finder, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: bounty, isSigner: false, isWritable: true },
      { pubkey: claim, isSigner: false, isWritable: true },
      { pubkey: vaultAuth, isSigner: false, isWritable: false },
      { pubkey: vaultAta, isSigner: false, isWritable: true },
      { pubkey: finderAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([
      IX.resolve_dispute_v2,
      Buffer.from([releaseToFinder ? 1 : 0]),
    ]),
  });
  const ixs = [createAta, ix];
  if (releaseToFinder) {
    const onChainBounty = await fetchBounty(bountyId);
    if (!onChainBounty)
      throw new Error("Không đọc được bounty từ Solana Devnet.");
    ixs.push(
      attestSettlementInstruction({
        payer: wallet.publicKey,
        owner: new PublicKey(onChainBounty.owner),
        finder,
        bountyId,
      }),
    );
  }
  return sendIx(wallet, ixs, "resolve_dispute_v2");
}

/** Manual Borsh-ish decode of Bounty account (Anchor layout). */
export function decodeBountyAccount(data: Buffer): OnChainBounty | null {
  try {
    if (data.length < 8) return null;
    let o = 8; // discriminator
    const readPk = () => {
      const pk = new PublicKey(data.subarray(o, o + 32));
      o += 32;
      return pk.toBase58();
    };
    const owner = readPk();
    const finder = readPk();
    const arbiter = readPk();
    const mint = readPk();
    const idLen = data.readUInt32LE(o);
    o += 4;
    const bountyId = data.subarray(o, o + idLen).toString("utf8");
    o += idLen;
    const rewardAmount = data.readBigUInt64LE(o);
    o += 8;
    const amountFunded = data.readBigUInt64LE(o);
    o += 8;
    const deadline = Number(data.readBigInt64LE(o));
    o += 8;
    const statusIdx = data[o];
    o += 1;
    const metadataHash = data.subarray(o, o + 32);
    o += 32;
    const evidenceHash = data.subarray(o, o + 32);
    o += 32;
    const aiScore = data[o++];
    const aiRisk = data[o++];
    const aiDecision = data[o++];
    const aiExplanationHash = data.subarray(o, o + 32);
    o += 32;
    o += 1; // bump
    o += 1; // vault_bump
    const createdAt = Number(data.readBigInt64LE(o));
    o += 8;
    const updatedAt = Number(data.readBigInt64LE(o));
    o += 8;
    const protocolVersion = data[o++] ?? 0;
    const arbitrationMode = data[o] ?? 0;

    return {
      address: "",
      owner,
      finder,
      arbiter,
      mint,
      bountyId,
      rewardAmount,
      amountFunded,
      deadline,
      status: STATUS_MAP[statusIdx] ?? "Unknown",
      metadataHash: new Uint8Array(metadataHash),
      evidenceHash: new Uint8Array(evidenceHash),
      aiScore,
      aiRisk,
      aiDecision,
      aiExplanationHash: new Uint8Array(aiExplanationHash),
      createdAt,
      updatedAt,
      protocolVersion,
      arbitrationMode,
    };
  } catch {
    return null;
  }
}

export function decodeClaimV2Account(data: Buffer): OnChainClaimV2 | null {
  try {
    if (
      data.length < CLAIM_V2_ACCOUNT_SIZE ||
      !data.subarray(0, 8).equals(CLAIM_V2_DISCRIMINATOR)
    ) {
      return null;
    }
    let offset = 8;
    const readPublicKey = () => {
      const value = new PublicKey(
        data.subarray(offset, offset + 32),
      ).toBase58();
      offset += 32;
      return value;
    };
    const readHash = () => {
      const value = new Uint8Array(data.subarray(offset, offset + 32));
      offset += 32;
      return value;
    };
    const bounty = readPublicKey();
    const finder = readPublicKey();
    const evidenceHash = readHash();
    const aiInputHash = readHash();
    const aiReportHash = readHash();
    const aiModelHash = readHash();
    const aiScore = data[offset++];
    const aiRisk = data[offset++];
    const aiDecision = data[offset++];
    const status = CLAIM_V2_STATUS_MAP[data[offset++]] ?? "Unknown";
    offset += 1; // bump
    const createdAt = Number(data.readBigInt64LE(offset));
    offset += 8;
    const updatedAt = Number(data.readBigInt64LE(offset));

    return {
      address: "",
      bounty,
      finder,
      evidenceHash,
      aiInputHash,
      aiReportHash,
      aiModelHash,
      aiScore,
      aiRisk,
      aiDecision,
      status,
      createdAt,
      updatedAt,
    };
  } catch {
    return null;
  }
}

export function decodeReputationAccount(
  data: Buffer,
): OnChainReputation | null {
  try {
    if (
      data.length < 69 ||
      !data.subarray(0, 8).equals(REPUTATION_DISCRIMINATOR)
    ) {
      return null;
    }
    let offset = 8;
    const wallet = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
    offset += 32;
    const successfulReturns = data.readUInt32LE(offset);
    offset += 4;
    const rewardsEarned = data.readBigUInt64LE(offset);
    offset += 8;
    const rewardsPaid = data.readBigUInt64LE(offset);
    offset += 8;
    const lastActivity = Number(data.readBigInt64LE(offset));
    return {
      address: "",
      wallet,
      successfulReturns,
      rewardsEarned,
      rewardsPaid,
      lastActivity,
    };
  } catch {
    return null;
  }
}

export function decodeReturnAttestationAccount(
  data: Buffer,
): OnChainReturnAttestation | null {
  try {
    if (
      data.length < 154 ||
      !data.subarray(0, 8).equals(RETURN_ATTESTATION_DISCRIMINATOR)
    ) {
      return null;
    }
    let offset = 8;
    const readPublicKey = () => {
      const value = new PublicKey(
        data.subarray(offset, offset + 32),
      ).toBase58();
      offset += 32;
      return value;
    };
    const bounty = readPublicKey();
    const claim = readPublicKey();
    const owner = readPublicKey();
    const finder = readPublicKey();
    const rewardAmount = data.readBigUInt64LE(offset);
    offset += 8;
    const aiScore = data[offset++];
    const settledAt = Number(data.readBigInt64LE(offset));
    return {
      address: "",
      bounty,
      claim,
      owner,
      finder,
      rewardAmount,
      aiScore,
      settledAt,
    };
  } catch {
    return null;
  }
}

export function decodeArbitrationPanelAccount(
  data: Buffer
): OnChainArbitrationPanel | null {
  try {
    if (
      data.length < 146 ||
      !data.subarray(0, 8).equals(ARBITRATION_PANEL_DISCRIMINATOR)
    ) return null;
    let offset = 8;
    const readPublicKey = () => {
      const value = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
      offset += 32;
      return value;
    };
    const bounty = readPublicKey();
    const arbiters = [readPublicKey(), readPublicKey(), readPublicKey()] as [string, string, string];
    const quorum = data[offset++];
    offset += 1;
    const createdAt = Number(data.readBigInt64LE(offset));
    return { address: "", bounty, arbiters, quorum, createdAt };
  } catch {
    return null;
  }
}

export function decodeDisputeCaseAccount(data: Buffer): OnChainDisputeCase | null {
  try {
    if (
      data.length < 125 ||
      !data.subarray(0, 8).equals(DISPUTE_CASE_DISCRIMINATOR)
    ) return null;
    let offset = 8;
    const readPublicKey = () => {
      const value = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
      offset += 32;
      return value;
    };
    const bounty = readPublicKey();
    const claim = readPublicKey();
    const panel = readPublicKey();
    const releaseVotes = data[offset++];
    const rejectVotes = data[offset++];
    const decision = data[offset++] as 0 | 1 | 2;
    const finalized = data[offset++] === 1;
    offset += 1;
    const createdAt = Number(data.readBigInt64LE(offset));
    offset += 8;
    const resolvedAt = Number(data.readBigInt64LE(offset));
    return {
      address: "",
      bounty,
      claim,
      panel,
      releaseVotes,
      rejectVotes,
      decision,
      finalized,
      createdAt,
      resolvedAt,
    };
  } catch {
    return null;
  }
}

export function decodeArbitrationVoteAccount(
  data: Buffer
): OnChainArbitrationVote | null {
  try {
    if (
      data.length < 82 ||
      !data.subarray(0, 8).equals(ARBITRATION_VOTE_DISCRIMINATOR)
    ) return null;
    let offset = 8;
    const disputeCase = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
    offset += 32;
    const arbiter = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
    offset += 32;
    const releaseToFinder = data[offset++] === 1;
    offset += 1;
    const votedAt = Number(data.readBigInt64LE(offset));
    return { address: "", disputeCase, arbiter, releaseToFinder, votedAt };
  } catch {
    return null;
  }
}

export async function fetchArbitrationPanel(
  bountyId: string
): Promise<OnChainArbitrationPanel | null> {
  const [pda] = arbitrationPanelPda(bountyId);
  const info = await readAccountInfo(pda);
  if (!info?.data) return null;
  const decoded = decodeArbitrationPanelAccount(Buffer.from(info.data));
  if (!decoded) return null;
  decoded.address = pda.toBase58();
  return decoded;
}

export async function fetchDisputeCase(
  bountyId: string,
  finder: PublicKey
): Promise<OnChainDisputeCase | null> {
  const [pda] = disputeCasePda(bountyId, finder);
  const info = await readAccountInfo(pda);
  if (!info?.data) return null;
  const decoded = decodeDisputeCaseAccount(Buffer.from(info.data));
  if (!decoded) return null;
  decoded.address = pda.toBase58();
  return decoded;
}

export async function fetchArbitrationVote(
  bountyId: string,
  finder: PublicKey,
  arbiter: PublicKey
): Promise<OnChainArbitrationVote | null> {
  const [pda] = arbitrationVotePda(bountyId, finder, arbiter);
  const info = await readAccountInfo(pda);
  if (!info?.data) return null;
  const decoded = decodeArbitrationVoteAccount(Buffer.from(info.data));
  if (!decoded) return null;
  decoded.address = pda.toBase58();
  return decoded;
}

export async function fetchReputation(
  wallet: PublicKey,
): Promise<OnChainReputation | null> {
  const [pda] = reputationPda(wallet);
  const info = await readAccountInfo(pda);
  if (!info?.data) return null;
  const decoded = decodeReputationAccount(Buffer.from(info.data));
  if (!decoded) return null;
  decoded.address = pda.toBase58();
  return decoded;
}

export async function fetchReturnAttestation(
  bountyId: string,
  finder: PublicKey,
): Promise<OnChainReturnAttestation | null> {
  const [pda] = returnAttestationPda(bountyId, finder);
  const info = await readAccountInfo(pda);
  if (!info?.data) return null;
  const decoded = decodeReturnAttestationAccount(Buffer.from(info.data));
  if (!decoded) return null;
  decoded.address = pda.toBase58();
  return decoded;
}

export async function fetchClaimV2(
  bountyId: string,
  finder: PublicKey,
): Promise<OnChainClaimV2 | null> {
  const [pda] = claimV2Pda(bountyId, finder);
  const info = await readAccountInfo(pda);
  if (!info?.data) return null;
  const decoded = decodeClaimV2Account(Buffer.from(info.data));
  if (!decoded) return null;
  decoded.address = pda.toBase58();
  return decoded;
}

export async function fetchClaimsV2ForBounty(
  bountyId: string,
): Promise<OnChainClaimV2[]> {
  const connection = getConnection();
  const [bounty] = bountyPda(bountyId);
  const accounts = await withRpcReadRetry(() =>
    connection.getProgramAccounts(PROGRAM_PK, {
      commitment: "confirmed",
      filters: [
        { dataSize: CLAIM_V2_ACCOUNT_SIZE },
        { memcmp: { offset: 8, bytes: bounty.toBase58() } },
      ],
    }),
  );
  return accounts.flatMap(({ pubkey, account }) => {
    const decoded = decodeClaimV2Account(Buffer.from(account.data));
    if (!decoded) return [];
    decoded.address = pubkey.toBase58();
    return [decoded];
  });
}

export async function fetchBounty(
  bountyId: string,
): Promise<OnChainBounty | null> {
  const [pda] = bountyPda(bountyId);
  const info = await readAccountInfo(pda);
  if (!info?.data) return null;
  const decoded = decodeBountyAccount(Buffer.from(info.data));
  if (!decoded) return null;
  decoded.address = pda.toBase58();
  return decoded;
}

export function decisionLabel(d: number): "ACCEPT" | "REVIEW" | "REJECT" {
  if (d === 0) return "ACCEPT";
  if (d === 2) return "REJECT";
  return "REVIEW";
}

export function riskLabel(r: number): "low" | "medium" | "high" {
  if (r === 0) return "low";
  if (r === 2) return "high";
  return "medium";
}
