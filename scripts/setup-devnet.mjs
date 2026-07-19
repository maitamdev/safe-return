/**
 * Create a real mock-USDC mint on Devnet and mint tokens to the deployer ATA.
 * Requires deployed program + funded deployer keypair.
 *
 * Usage:
 *   node scripts/setup-devnet.mjs
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
const envPath = path.join(root, ".env.local");

function loadKeypair(p) {
  const raw = JSON.parse(fs.readFileSync(p, "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

const kpPath =
  process.env.SOLANA_KEYPAIR ||
  path.join(os.homedir(), ".config", "solana", "id.json");
const payer = loadKeypair(kpPath);
const connection = new Connection(
  process.env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl("devnet"),
  "confirmed"
);

const bal = await connection.getBalance(payer.publicKey);
console.log("Payer:", payer.publicKey.toBase58());
console.log("Balance:", bal / 1e9, "SOL");
if (bal < 0.05 * 1e9) {
  console.error("Need a little SOL for mint rent. Fund the deployer first.");
  process.exit(2);
}

console.log("Creating mint (6 decimals)...");
const mint = await createMint(
  connection,
  payer,
  payer.publicKey,
  payer.publicKey,
  6,
  undefined,
  undefined,
  TOKEN_PROGRAM_ID
);
console.log("Mint:", mint.toBase58());

const ata = await getOrCreateAssociatedTokenAccount(
  connection,
  payer,
  mint,
  payer.publicKey
);
console.log("Deployer ATA:", ata.address.toBase58());

const amount = 1_000_000n * 1_000_000n; // 1,000,000 mock USDC
const sig = await mintTo(
  connection,
  payer,
  mint,
  ata.address,
  payer,
  amount
);
console.log("Minted 1,000,000 mock USDC · tx", sig);

// Optional second wallet (finder) from FINDER_KEYPAIR env
if (process.env.FINDER_PUBKEY) {
  const finder = new PublicKey(process.env.FINDER_PUBKEY);
  const fAta = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    finder
  );
  console.log("Finder ATA ready:", fAta.address.toBase58());
}

let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
function upsert(key, val) {
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(env)) env = env.replace(re, `${key}=${val}`);
  else env += (env.endsWith("\n") || env === "" ? "" : "\n") + `${key}=${val}\n`;
}
upsert("NEXT_PUBLIC_MOCK_USDC_MINT", mint.toBase58());
upsert("NEXT_PUBLIC_SAFEPOINT_AUTHORITY", payer.publicKey.toBase58());
upsert("NEXT_PUBLIC_SOLANA_LIVE", "1");
upsert("NEXT_PUBLIC_SOLANA_CLUSTER", "devnet");
fs.writeFileSync(envPath, env);
console.log("\nUpdated", envPath);
console.log("Mint explorer: https://explorer.solana.com/address/" + mint.toBase58() + "?cluster=devnet");
console.log("\nRestart npm run dev and connect Phantom on Devnet.");
