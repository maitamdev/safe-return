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
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import {
  FINDBACK_PROGRAM_ID,
  SOLANA_RPC,
  FIND_MINT,
  ARBITER,
  toAtomic,
  explorerTxUrl,
} from "./config";

export const PROGRAM_PK = new PublicKey(FINDBACK_PROGRAM_ID);
export const BOUNTY_SEED = Buffer.from("bounty");
export const VAULT_SEED = Buffer.from("vault");

/** sha256("global:<name>")[0..8] */
export const IX = {
  create_bounty: Buffer.from([122, 90, 14, 143, 8, 125, 200, 2]),
  fund_bounty: Buffer.from([36, 148, 139, 239, 172, 37, 58, 255]),
  submit_claim: Buffer.from([163, 108, 111, 46, 220, 82, 77, 212]),
  record_ai_review: Buffer.from([124, 116, 24, 236, 214, 167, 231, 54]),
  accept_claim: Buffer.from([139, 66, 180, 182, 209, 194, 173, 87]),
  reject_claim: Buffer.from([238, 185, 227, 8, 51, 188, 35, 182]),
  refund_after_expiry: Buffer.from([210, 2, 52, 232, 49, 218, 178, 59]),
  cancel_bounty: Buffer.from([79, 65, 107, 143, 128, 165, 135, 46]),
  open_dispute: Buffer.from([137, 25, 99, 119, 23, 223, 161, 42]),
  resolve_dispute: Buffer.from([231, 6, 202, 6, 96, 103, 12, 230]),
} as const;

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
};

export function getConnection(commitment: Commitment = "confirmed") {
  return new Connection(SOLANA_RPC, commitment);
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
    PROGRAM_PK
  );
}

export function vaultAuthorityPda(bountyId: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [VAULT_SEED, Buffer.from(bountyId)],
    PROGRAM_PK
  );
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

async function sendIx(
  wallet: WalletLike,
  ixs: TransactionInstruction[],
  label: string
): Promise<{ signature: string; url: string }> {
  const connection = getConnection();
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({
    feePayer: wallet.publicKey,
    blockhash,
    lastValidBlockHeight,
  });
  for (const ix of ixs) tx.add(ix);

  const message = tx.compileMessage();
  if (message.header.numRequiredSignatures !== 1) {
    throw new Error(
      `${label}: giao dịch phải chỉ có một ví ký, nhưng đang yêu cầu ${message.header.numRequiredSignatures} chữ ký.`
    );
  }

  const wireSize = tx.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  }).length;
  if (wireSize > 1232) {
    throw new Error(
      `${label}: giao dịch dài ${wireSize} byte, vượt giới hạn 1232 byte của Solana.`
    );
  }

  // Phantom recommends simulating with sigVerify=false before requesting a
  // wallet signature. A VersionedTransaction lets web3.js pass that option
  // explicitly while the wallet can still sign the familiar legacy tx.
  const simulation = await connection.simulateTransaction(
    new VersionedTransaction(message),
    {
      commitment: "confirmed",
      sigVerify: false,
    }
  );
  if (simulation.value.err) {
    const logs = simulation.value.logs?.slice(-8).join(" | ") || "Không có log RPC";
    const simulationError = JSON.stringify(
      simulation.value.err,
      (_key, value) => (typeof value === "bigint" ? value.toString() : value)
    );
    throw new Error(
      `${label}: mô phỏng Devnet thất bại (${simulationError}). ${logs}`
    );
  }

  const signed = await wallet.signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });
  await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed"
  );
  return { signature: sig, url: explorerTxUrl(sig) };
}

async function ensureAtaIx(
  connection: Connection,
  payer: PublicKey,
  owner: PublicKey,
  mint: PublicKey
): Promise<TransactionInstruction | null> {
  const ata = getAssociatedTokenAddressSync(mint, owner, true);
  const info = await connection.getAccountInfo(ata);
  if (info) return null;
  return createAssociatedTokenAccountInstruction(payer, ata, owner, mint);
}

export async function createBountyOnChain(
  wallet: WalletLike,
  args: {
    bountyId: string;
    rewardUi: number;
    deadlineUnix: number;
    metadataHash: Uint8Array;
  }
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

export async function fundBountyOnChain(
  wallet: WalletLike,
  bountyId: string,
  amountUi: number
) {
  const connection = getConnection();
  const mint = requireMint();
  const [bounty] = bountyPda(bountyId);
  const [vaultAuth] = vaultAuthorityPda(bountyId);
  const ownerAta = getAssociatedTokenAddressSync(mint, wallet.publicKey);
  const vaultAta = getAssociatedTokenAddressSync(mint, vaultAuth, true);

  const ixs: TransactionInstruction[] = [];
  const maybeVault = await ensureAtaIx(
    connection,
    wallet.publicKey,
    vaultAuth,
    mint
  );
  // vault ATA is init_if_needed in program — still ok if missing, program creates
  void maybeVault;

  const data = Buffer.concat([
    IX.fund_bounty,
    encodeU64(toAtomic(amountUi)),
  ]);
  ixs.push(
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
    })
  );
  return sendIx(wallet, ixs, "fund_bounty");
}

export async function submitClaimOnChain(
  wallet: WalletLike,
  bountyId: string,
  evidenceHash: Uint8Array
) {
  const [bounty] = bountyPda(bountyId);
  const data = Buffer.concat([
    IX.submit_claim,
    encodeBytes32(evidenceHash),
  ]);
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

export async function recordAiReviewOnChain(
  wallet: WalletLike,
  bountyId: string,
  args: {
    score: number;
    riskLevel: number;
    decision: number;
    explanationHash: Uint8Array;
  }
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

export async function acceptClaimOnChain(
  wallet: WalletLike,
  bountyId: string,
  finder: PublicKey
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

export async function refundAfterExpiryOnChain(
  wallet: WalletLike,
  bountyId: string
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

export async function cancelBountyOnChain(wallet: WalletLike, bountyId: string) {
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
  releaseToFinder: boolean
) {
  const connection = getConnection();
  const mint = requireMint();
  const [bounty] = bountyPda(bountyId);
  const [vaultAuth] = vaultAuthorityPda(bountyId);
  const vaultAta = getAssociatedTokenAddressSync(mint, vaultAuth, true);
  const counterpartyAta = getAssociatedTokenAddressSync(mint, counterparty, true);
  const createAta = await ensureAtaIx(
    connection,
    wallet.publicKey,
    counterparty,
    mint
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
  return sendIx(wallet, createAta ? [createAta, ix] : [ix], "resolve_dispute");
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
    };
  } catch {
    return null;
  }
}

export async function fetchBounty(
  bountyId: string
): Promise<OnChainBounty | null> {
  const connection = getConnection();
  const [pda] = bountyPda(bountyId);
  const info = await connection.getAccountInfo(pda, "confirmed");
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
