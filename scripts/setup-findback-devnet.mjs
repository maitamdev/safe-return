/**
 * Create FIND Reward Token (SPL) on Devnet, mint to deployer, update .env.local
 */
import {
  Connection,
  Keypair,
  PublicKey,
  clusterApiUrl,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function loadKeypair(p) {
  const raw = JSON.parse(fs.readFileSync(p, "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

function upsertEnv(file, key, val) {
  let t = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(t)) t = t.replace(re, `${key}=${val}`);
  else t = t.trimEnd() + `\n${key}=${val}\n`;
  fs.writeFileSync(file, t);
}

const walletPath =
  process.env.SOLANA_WALLET ||
  path.join(os.homedir(), ".config", "solana", "id.json");
const payer = loadKeypair(walletPath);
const connection = new Connection(
  process.env.SOLANA_RPC || clusterApiUrl("devnet"),
  "confirmed"
);

const bal = await connection.getBalance(payer.publicKey);
console.log("Payer:", payer.publicKey.toBase58());
console.log("SOL:", bal / 1e9);
if (bal < 0.5e9) {
  console.error("Need ≥0.5 SOL on Devnet for mint + ATAs");
  process.exit(1);
}

const decimals = 6;
console.log("Creating FIND mint…");
const mint = await createMint(
  connection,
  payer,
  payer.publicKey,
  payer.publicKey,
  decimals,
  undefined,
  undefined,
  TOKEN_PROGRAM_ID
);
console.log("FIND mint:", mint.toBase58());

const ata = await getOrCreateAssociatedTokenAccount(
  connection,
  payer,
  mint,
  payer.publicKey
);

const amount = BigInt(1_000_000) * BigInt(10 ** decimals); // 1,000,000 FIND
await mintTo(connection, payer, mint, ata.address, payer, amount);
console.log("Minted 1,000,000 FIND to", ata.address.toBase58());

const envLocal = path.join(root, ".env.local");
upsertEnv(envLocal, "NEXT_PUBLIC_FIND_MINT", mint.toBase58());
upsertEnv(envLocal, "NEXT_PUBLIC_ARBITER", payer.publicKey.toBase58());

const recipients = process.argv.slice(2);
for (const addr of recipients) {
  try {
    const pk = new PublicKey(addr);
    const rAta = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      mint,
      pk
    );
    const send = BigInt(10_000) * BigInt(10 ** decimals);
    await mintTo(connection, payer, mint, rAta.address, payer, send);
    console.log("Sent 10,000 FIND →", addr);
  } catch (e) {
    console.warn("Skip recipient", addr, e.message);
  }
}

fs.writeFileSync(path.join(root, ".find-mint"), mint.toBase58() + "\n");

console.log("\n=== FIND Reward Token (Devnet test SPL) ===");
console.log("Mint:", mint.toBase58());
console.log(
  "Explorer:",
  `https://explorer.solana.com/address/${mint.toBase58()}?cluster=devnet`
);
console.log(
  "Import in Phantom: Manage token list → Import custom token → paste mint"
);
console.log("Optional: node scripts/setup-findback-devnet.mjs <PHANTOM_PUBKEY>");
