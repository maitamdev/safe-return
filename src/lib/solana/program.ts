/**
 * Real SafeReturn escrow client — builds & sends Anchor-compatible instructions
 * on Solana Devnet. No mock signatures.
 */

import {
  Connection,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
  Keypair,
  type Commitment,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from "@solana/spl-token";
import {
  PROGRAM_ID,
  SOLANA_RPC,
  MOCK_USDC_MINT,
  SAFEPOINT_AUTHORITY,
  toAtomicUsdc,
  explorerTxUrl,
} from "./config";

export const PROGRAM_PK = new PublicKey(PROGRAM_ID);
export const ESCROW_SEED = Buffer.from("escrow");
export const VAULT_SEED = Buffer.from("vault");

/** Anchor global instruction discriminators (sha256("global:<name>")[0..8]) */
export const IX = {
  initialize_case: Buffer.from([9, 26, 237, 193, 224, 164, 59, 208]),
  fund_escrow: Buffer.from([155, 18, 218, 141, 182, 213, 69, 201]),
  set_finder: Buffer.from([195, 58, 13, 189, 225, 13, 54, 119]),
  lock_for_handover: Buffer.from([246, 12, 108, 181, 193, 118, 44, 188]),
  release_reward: Buffer.from([109, 168, 217, 34, 229, 21, 86, 77]),
  refund_owner: Buffer.from([69, 147, 71, 155, 27, 152, 244, 153]),
  open_dispute: Buffer.from([137, 25, 99, 119, 23, 223, 161, 42]),
} as const;

export type WalletLike = {
  publicKey: PublicKey;
  signTransaction: <T extends Transaction>(tx: T) => Promise<T>;
};

export function getConnection(commitment: Commitment = "confirmed") {
  return new Connection(SOLANA_RPC, commitment);
}

export function requireMint(): PublicKey {
  if (!MOCK_USDC_MINT) {
    throw new Error(
      "MOCK_USDC_MINT chưa set. Chạy: node scripts/setup-devnet.mjs"
    );
  }
  return new PublicKey(MOCK_USDC_MINT);
}

export function requireAuthority(fallback?: PublicKey): PublicKey {
  if (SAFEPOINT_AUTHORITY) return new PublicKey(SAFEPOINT_AUTHORITY);
  if (fallback) return fallback;
  throw new Error("SAFEPOINT_AUTHORITY chưa set trong .env.local");
}

export function escrowPda(caseId: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [ESCROW_SEED, Buffer.from(caseId)],
    PROGRAM_PK
  );
}

export function vaultAuthorityPda(caseId: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [VAULT_SEED, Buffer.from(caseId)],
    PROGRAM_PK
  );
}

function encodeString(s: string): Buffer {
  const body = Buffer.from(s, "utf8");
  const len = Buffer.alloc(4);
  len.writeUInt32LE(body.length, 0);
  return Buffer.concat([len, body]);
}

function encodeU64(n: bigint): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(n, 0);
  return b;
}

function encodePubkey(pk: PublicKey): Buffer {
  return Buffer.from(pk.toBytes());
}

export async function sha256Bytes(data: Uint8Array): Promise<Uint8Array> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
  );
  return new Uint8Array(buf);
}

export function otpToBytes32(otp: string): Uint8Array {
  const out = new Uint8Array(32);
  const enc = new TextEncoder().encode(otp);
  out.set(enc.slice(0, 32));
  return out;
}

export type SendResult = {
  signature: string;
  explorerUrl: string;
  mode: "live";
  programId: string;
  instruction: string;
  caseId: string;
  detail?: string;
  pda?: string;
};

async function sendWithWallet(
  connection: Connection,
  wallet: WalletLike,
  ixs: TransactionInstruction[],
  meta: { instruction: string; caseId: string; detail?: string; pda?: string }
): Promise<SendResult> {
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({
    feePayer: wallet.publicKey,
    blockhash,
    lastValidBlockHeight,
  }).add(...ixs);

  const signed = await wallet.signTransaction(tx);
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });
  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed"
  );

  return {
    signature,
    explorerUrl: explorerTxUrl(signature),
    mode: "live",
    programId: PROGRAM_ID,
    instruction: meta.instruction,
    caseId: meta.caseId,
    detail: meta.detail,
    pda: meta.pda,
  };
}

/** Server-side send with keypair (SafePoint staff / deployer). */
export async function sendWithKeypair(
  connection: Connection,
  payer: Keypair,
  ixs: TransactionInstruction[],
  meta: { instruction: string; caseId: string; detail?: string; pda?: string }
): Promise<SendResult> {
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({
    feePayer: payer.publicKey,
    blockhash,
    lastValidBlockHeight,
  }).add(...ixs);
  tx.sign(payer);
  const signature = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });
  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed"
  );
  return {
    signature,
    explorerUrl: explorerTxUrl(signature),
    mode: "live",
    programId: PROGRAM_ID,
    instruction: meta.instruction,
    caseId: meta.caseId,
    detail: meta.detail,
    pda: meta.pda,
  };
}

export async function ensureAtaIx(
  connection: Connection,
  payer: PublicKey,
  owner: PublicKey,
  mint: PublicKey
): Promise<{ ata: PublicKey; ix: TransactionInstruction | null }> {
  const ata = getAssociatedTokenAddressSync(mint, owner, false);
  try {
    await getAccount(connection, ata);
    return { ata, ix: null };
  } catch {
    return {
      ata,
      ix: createAssociatedTokenAccountInstruction(payer, ata, owner, mint),
    };
  }
}

export async function initializeCaseOnChain(params: {
  wallet: WalletLike;
  caseId: string;
  rewardUi: number;
  authority?: PublicKey;
}): Promise<SendResult> {
  if (params.caseId.length === 0 || params.caseId.length > 32) {
    throw new Error("caseId must be 1..32 chars");
  }
  const connection = getConnection();
  const mint = requireMint();
  const authority = params.authority ?? requireAuthority(params.wallet.publicKey);
  const [escrow, ,] = escrowPda(params.caseId);
  const [vaultAuth] = vaultAuthorityPda(params.caseId);
  const vaultAta = getAssociatedTokenAddressSync(mint, vaultAuth, true);

  const data = Buffer.concat([
    IX.initialize_case,
    encodeString(params.caseId),
    encodeU64(toAtomicUsdc(params.rewardUi)),
  ]);

  const ix = new TransactionInstruction({
    programId: PROGRAM_PK,
    keys: [
      { pubkey: params.wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: authority, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: escrow, isSigner: false, isWritable: true },
      { pubkey: vaultAuth, isSigner: false, isWritable: false },
      { pubkey: vaultAta, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data,
  });

  return sendWithWallet(connection, params.wallet, [ix], {
    instruction: "initialize_case",
    caseId: params.caseId,
    detail: `reward ${params.rewardUi} USDC`,
    pda: escrow.toBase58(),
  });
}

export async function fundEscrowOnChain(params: {
  wallet: WalletLike;
  caseId: string;
  amountUi: number;
}): Promise<SendResult> {
  const connection = getConnection();
  const mint = requireMint();
  const [escrow] = escrowPda(params.caseId);
  const [vaultAuth] = vaultAuthorityPda(params.caseId);
  const vaultAta = getAssociatedTokenAddressSync(mint, vaultAuth, true);
  const ownerAta = getAssociatedTokenAddressSync(
    mint,
    params.wallet.publicKey,
    false
  );

  const data = Buffer.concat([
    IX.fund_escrow,
    encodeU64(toAtomicUsdc(params.amountUi)),
  ]);

  const ix = new TransactionInstruction({
    programId: PROGRAM_PK,
    keys: [
      { pubkey: params.wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: escrow, isSigner: false, isWritable: true },
      { pubkey: ownerAta, isSigner: false, isWritable: true },
      { pubkey: vaultAuth, isSigner: false, isWritable: false },
      { pubkey: vaultAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data,
  });

  return sendWithWallet(connection, params.wallet, [ix], {
    instruction: "fund_escrow",
    caseId: params.caseId,
    detail: `+${params.amountUi} USDC`,
    pda: escrow.toBase58(),
  });
}

export async function setFinderOnChain(params: {
  wallet: WalletLike;
  caseId: string;
  finder: PublicKey;
}): Promise<SendResult> {
  const connection = getConnection();
  const [escrow] = escrowPda(params.caseId);
  const data = Buffer.concat([IX.set_finder, encodePubkey(params.finder)]);

  const ix = new TransactionInstruction({
    programId: PROGRAM_PK,
    keys: [
      { pubkey: params.wallet.publicKey, isSigner: true, isWritable: false },
      { pubkey: escrow, isSigner: false, isWritable: true },
    ],
    data,
  });

  return sendWithWallet(connection, params.wallet, [ix], {
    instruction: "set_finder",
    caseId: params.caseId,
    detail: params.finder.toBase58().slice(0, 8) + "…",
    pda: escrow.toBase58(),
  });
}

export async function lockForHandoverOnChain(params: {
  authority: WalletLike | Keypair;
  caseId: string;
  otp: string;
}): Promise<SendResult> {
  const connection = getConnection();
  const [escrow] = escrowPda(params.caseId);
  const otpHash = await sha256Bytes(otpToBytes32(params.otp));
  const data = Buffer.concat([IX.lock_for_handover, Buffer.from(otpHash)]);

  const authPk =
    "publicKey" in params.authority &&
    typeof (params.authority as WalletLike).signTransaction === "function"
      ? (params.authority as WalletLike).publicKey
      : (params.authority as Keypair).publicKey;

  const ix = new TransactionInstruction({
    programId: PROGRAM_PK,
    keys: [
      { pubkey: authPk, isSigner: true, isWritable: false },
      { pubkey: escrow, isSigner: false, isWritable: true },
    ],
    data,
  });

  if ("signTransaction" in params.authority) {
    return sendWithWallet(connection, params.authority as WalletLike, [ix], {
      instruction: "lock_for_handover",
      caseId: params.caseId,
      detail: `otp_hash ${Buffer.from(otpHash).toString("hex").slice(0, 12)}…`,
      pda: escrow.toBase58(),
    });
  }
  return sendWithKeypair(connection, params.authority as Keypair, [ix], {
    instruction: "lock_for_handover",
    caseId: params.caseId,
    detail: `otp_hash ${Buffer.from(otpHash).toString("hex").slice(0, 12)}…`,
    pda: escrow.toBase58(),
  });
}

export async function releaseRewardOnChain(params: {
  authority: WalletLike | Keypair;
  caseId: string;
  otp: string;
  finder: PublicKey;
  owner: PublicKey;
}): Promise<SendResult> {
  const connection = getConnection();
  const mint = requireMint();
  const [escrow] = escrowPda(params.caseId);
  const [vaultAuth] = vaultAuthorityPda(params.caseId);
  const vaultAta = getAssociatedTokenAddressSync(mint, vaultAuth, true);
  const finderAta = getAssociatedTokenAddressSync(mint, params.finder, false);
  const ownerAta = getAssociatedTokenAddressSync(mint, params.owner, false);

  const preimage = otpToBytes32(params.otp);
  const data = Buffer.concat([IX.release_reward, Buffer.from(preimage)]);

  const authPk =
    "signTransaction" in params.authority
      ? (params.authority as WalletLike).publicKey
      : (params.authority as Keypair).publicKey;

  const ixs: TransactionInstruction[] = [];

  // Ensure finder ATA exists (payer = authority)
  try {
    await getAccount(connection, finderAta);
  } catch {
    ixs.push(
      createAssociatedTokenAccountInstruction(
        authPk,
        finderAta,
        params.finder,
        mint
      )
    );
  }

  ixs.push(
    new TransactionInstruction({
      programId: PROGRAM_PK,
      keys: [
        { pubkey: authPk, isSigner: true, isWritable: false },
        { pubkey: escrow, isSigner: false, isWritable: true },
        { pubkey: vaultAuth, isSigner: false, isWritable: false },
        { pubkey: vaultAta, isSigner: false, isWritable: true },
        { pubkey: finderAta, isSigner: false, isWritable: true },
        { pubkey: ownerAta, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data,
    })
  );

  if ("signTransaction" in params.authority) {
    return sendWithWallet(connection, params.authority as WalletLike, ixs, {
      instruction: "release_reward",
      caseId: params.caseId,
      pda: escrow.toBase58(),
    });
  }
  return sendWithKeypair(connection, params.authority as Keypair, ixs, {
    instruction: "release_reward",
    caseId: params.caseId,
    pda: escrow.toBase58(),
  });
}

export function shortPk(pk: string | PublicKey) {
  const s = typeof pk === "string" ? pk : pk.toBase58();
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}
