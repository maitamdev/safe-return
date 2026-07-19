/**
 * End-to-end smoke test on Devnet with the deployer keypair.
 * initialize_case → fund_escrow → set_finder
 */
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
  clusterApiUrl,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function loadEnv() {
  const p = path.join(root, ".env.local");
  const out = {};
  if (!fs.existsSync(p)) return out;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) out[m[1].trim()] = m[2].trim();
  }
  return out;
}

const env = loadEnv();
const PROGRAM_ID = new PublicKey(
  env.NEXT_PUBLIC_SAFERETURN_PROGRAM_ID ||
    "8aPk563iNTtCP95gZ5EhdWJhTiL1cgKypcDUJikf3H6c"
);
const MINT = new PublicKey(env.NEXT_PUBLIC_MOCK_USDC_MINT);
const AUTHORITY = new PublicKey(
  env.NEXT_PUBLIC_SAFEPOINT_AUTHORITY ||
    "DoNrsajZ2Yo8C1biPb8BiB2z3S5ZwZ9VWuFMwF8R2CUa"
);
const RPC = env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl("devnet");

const IX = {
  initialize_case: Buffer.from([9, 26, 237, 193, 224, 164, 59, 208]),
  fund_escrow: Buffer.from([155, 18, 218, 141, 182, 213, 69, 201]),
  set_finder: Buffer.from([195, 58, 13, 189, 225, 13, 54, 119]),
};

function loadKeypair(p) {
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(p, "utf8")))
  );
}

function encodeString(s) {
  const body = Buffer.from(s, "utf8");
  const len = Buffer.alloc(4);
  len.writeUInt32LE(body.length, 0);
  return Buffer.concat([len, body]);
}
function encodeU64(n) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(n), 0);
  return b;
}
function encodePubkey(pk) {
  return Buffer.from(pk.toBytes());
}

const payer = loadKeypair(
  process.env.SOLANA_KEYPAIR ||
    path.join(os.homedir(), ".config", "solana", "id.json")
);
const connection = new Connection(RPC, "confirmed");
const caseId = `smoke-${Date.now().toString(36)}`.slice(0, 32);
const rewardAtomic = 5_000_000n; // 5 mock USDC

const [escrow] = PublicKey.findProgramAddressSync(
  [Buffer.from("escrow"), Buffer.from(caseId)],
  PROGRAM_ID
);
const [vaultAuthority] = PublicKey.findProgramAddressSync(
  [Buffer.from("vault"), Buffer.from(caseId)],
  PROGRAM_ID
);
const vaultAta = getAssociatedTokenAddressSync(MINT, vaultAuthority, true);
const ownerAta = getAssociatedTokenAddressSync(MINT, payer.publicKey);

console.log("Program :", PROGRAM_ID.toBase58());
console.log("Mint    :", MINT.toBase58());
console.log("Payer   :", payer.publicKey.toBase58());
console.log("Case ID :", caseId);
console.log("Escrow  :", escrow.toBase58());

async function send(ixs, label) {
  const tx = new Transaction().add(...ixs);
  tx.feePayer = payer.publicKey;
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.sign(payer);
  const sig = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
  });
  await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed"
  );
  console.log(
    `✓ ${label}: https://explorer.solana.com/tx/${sig}?cluster=devnet`
  );
  return sig;
}

// 1) initialize_case — account order matches Anchor InitializeCase
{
  const data = Buffer.concat([
    IX.initialize_case,
    encodeString(caseId),
    encodeU64(rewardAtomic),
  ]);
  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: AUTHORITY, isSigner: false, isWritable: false },
      { pubkey: MINT, isSigner: false, isWritable: false },
      { pubkey: escrow, isSigner: false, isWritable: true },
      { pubkey: vaultAuthority, isSigner: false, isWritable: false },
      { pubkey: vaultAta, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      {
        pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data,
  });
  await send([ix], "initialize_case");
}

// 2) fund_escrow
{
  const data = Buffer.concat([IX.fund_escrow, encodeU64(rewardAtomic)]);
  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: escrow, isSigner: false, isWritable: true },
      { pubkey: ownerAta, isSigner: false, isWritable: true },
      { pubkey: vaultAuthority, isSigner: false, isWritable: false },
      { pubkey: vaultAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data,
  });
  await send([ix], "fund_escrow");
}

// 3) set_finder
{
  const finder = Keypair.generate().publicKey;
  const data = Buffer.concat([IX.set_finder, encodePubkey(finder)]);
  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: payer.publicKey, isSigner: true, isWritable: false },
      { pubkey: escrow, isSigner: false, isWritable: true },
    ],
    data,
  });
  await send([ix], "set_finder");
  console.log("Finder :", finder.toBase58());
}

const info = await connection.getAccountInfo(escrow);
console.log("\nEscrow account exists:", !!info, "bytes:", info?.data?.length);
console.log(
  "Escrow explorer:",
  `https://explorer.solana.com/address/${escrow.toBase58()}?cluster=devnet`
);
console.log("\nSMOKE OK — real Devnet txs confirmed.");
