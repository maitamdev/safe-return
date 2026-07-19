/**
 * End-to-end smoke on Devnet with deployer keypair:
 * create → fund → claim (2nd key or same skipped) → ai review → accept OR refund path note
 *
 * Usage: node scripts/smoke-findback.mjs
 */
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  clusterApiUrl,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from "@solana/spl-token";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function loadKp(p) {
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(p, "utf8")))
  );
}
function env(k, d = "") {
  const f = path.join(root, ".env.local");
  if (!fs.existsSync(f)) return d;
  const m = fs.readFileSync(f, "utf8").match(new RegExp(`^${k}=(.*)$`, "m"));
  return m ? m[1].trim() : d;
}

const IX = {
  create_bounty: Buffer.from([122, 90, 14, 143, 8, 125, 200, 2]),
  fund_bounty: Buffer.from([36, 148, 139, 239, 172, 37, 58, 255]),
  submit_claim: Buffer.from([163, 108, 111, 46, 220, 82, 77, 212]),
  record_ai_review: Buffer.from([124, 116, 24, 236, 214, 167, 231, 54]),
  accept_claim: Buffer.from([139, 66, 180, 182, 209, 194, 173, 87]),
};

function encStr(s) {
  const b = Buffer.from(s);
  const o = Buffer.alloc(4 + b.length);
  o.writeUInt32LE(b.length);
  b.copy(o, 4);
  return o;
}
function encU64(n) {
  const o = Buffer.alloc(8);
  o.writeBigUInt64LE(BigInt(n));
  return o;
}
function encI64(n) {
  const o = Buffer.alloc(8);
  o.writeBigInt64LE(BigInt(n));
  return o;
}

const payer = loadKp(
  process.env.SOLANA_WALLET ||
    path.join(os.homedir(), ".config", "solana", "id.json")
);
const programId = new PublicKey(
  env("NEXT_PUBLIC_FINDBACK_PROGRAM_ID", "3hLzzJDHvbuKFPKweKEJ3ZAQEijoLLejkvi9ZPmByWna")
);
const mint = new PublicKey(env("NEXT_PUBLIC_FIND_MINT"));
const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

const bountyId = `SMK${Date.now().toString(36).slice(-6).toUpperCase()}`;
const [bountyPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("bounty"), Buffer.from(bountyId)],
  programId
);
const [vaultAuth] = PublicKey.findProgramAddressSync(
  [Buffer.from("vault"), Buffer.from(bountyId)],
  programId
);

const reward = 5_000_000n; // 5 FIND
const deadline = Math.floor(Date.now() / 1000) + 86400 * 3;
const metaHash = crypto.createHash("sha256").update("smoke").digest();

console.log("Smoke FindBack");
console.log("Program", programId.toBase58());
console.log("Mint", mint.toBase58());
console.log("Bounty", bountyId, bountyPda.toBase58());

// finder = second keypair
const finder = Keypair.generate();
// fund finder SOL for fees
{
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: finder.publicKey,
      lamports: 0.05 * 1e9,
    })
  );
  await sendAndConfirmTransaction(connection, tx, [payer]);
}

// create
{
  const data = Buffer.concat([
    IX.create_bounty,
    encStr(bountyId),
    encU64(reward),
    encI64(deadline),
    metaHash,
  ]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: payer.publicKey, isSigner: false, isWritable: false }, // arbiter
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: bountyPda, isSigner: false, isWritable: true },
      { pubkey: vaultAuth, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
  const sig = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(ix),
    [payer]
  );
  console.log("create_bounty", sig);
}

// fund
{
  const ownerAta = getAssociatedTokenAddressSync(mint, payer.publicKey);
  const vaultAta = getAssociatedTokenAddressSync(mint, vaultAuth, true);
  const data = Buffer.concat([IX.fund_bounty, encU64(reward)]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: bountyPda, isSigner: false, isWritable: true },
      { pubkey: vaultAuth, isSigner: false, isWritable: false },
      { pubkey: ownerAta, isSigner: false, isWritable: true },
      { pubkey: vaultAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
  const sig = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(ix),
    [payer]
  );
  console.log("fund_bounty", sig);
}

// claim
{
  const ev = crypto.createHash("sha256").update("evidence-smoke").digest();
  const data = Buffer.concat([IX.submit_claim, ev]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: finder.publicKey, isSigner: true, isWritable: false },
      { pubkey: bountyPda, isSigner: false, isWritable: true },
    ],
    data,
  });
  const sig = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(ix),
    [finder]
  );
  console.log("submit_claim", sig);
}

// ai review
{
  const expl = crypto.createHash("sha256").update("ai-94").digest();
  const data = Buffer.concat([
    IX.record_ai_review,
    Buffer.from([94, 0, 0]),
    expl,
  ]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: payer.publicKey, isSigner: true, isWritable: false },
      { pubkey: bountyPda, isSigner: false, isWritable: true },
    ],
    data,
  });
  const sig = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(ix),
    [payer]
  );
  console.log("record_ai_review", sig);
}

// accept
{
  const vaultAta = getAssociatedTokenAddressSync(mint, vaultAuth, true);
  const finderAta = getAssociatedTokenAddressSync(mint, finder.publicKey);
  const ixs = [];
  try {
    await getAccount(connection, finderAta);
  } catch {
    ixs.push(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        finderAta,
        finder.publicKey,
        mint
      )
    );
  }
  ixs.push(
    new TransactionInstruction({
      programId,
      keys: [
        { pubkey: payer.publicKey, isSigner: true, isWritable: true },
        { pubkey: finder.publicKey, isSigner: false, isWritable: false },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: bountyPda, isSigner: false, isWritable: true },
        { pubkey: vaultAuth, isSigner: false, isWritable: false },
        { pubkey: vaultAta, isSigner: false, isWritable: true },
        { pubkey: finderAta, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: Buffer.from(IX.accept_claim),
    })
  );
  const sig = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(...ixs),
    [payer]
  );
  console.log("accept_claim", sig);
  console.log(
    "Explorer",
    `https://explorer.solana.com/tx/${sig}?cluster=devnet`
  );
}

console.log("SMOKE OK");
