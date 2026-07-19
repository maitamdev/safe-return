/**
 * Deploy safereturn_escrow.so to Solana Devnet (real chain).
 *
 * Prereq:
 *   - Solana CLI on PATH
 *   - Deployer keypair funded with ~3+ SOL on Devnet
 *   - Built .so at target/deploy/safereturn_escrow.so
 *
 * Usage:
 *   node scripts/deploy-devnet.mjs
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const so = path.join(root, "target", "deploy", "safereturn_escrow.so");
const kp = path.join(root, "target", "deploy", "safereturn_escrow-keypair.json");
const envPath = path.join(root, ".env.local");

function sh(cmd) {
  console.log(">", cmd);
  return execSync(cmd, { encoding: "utf8", stdio: ["inherit", "pipe", "pipe"] }).trim();
}

function shOut(cmd) {
  console.log(">", cmd);
  execSync(cmd, { stdio: "inherit" });
}

if (!fs.existsSync(so)) {
  console.error("Missing", so, "— run cargo-build-sbf first");
  process.exit(1);
}
if (!fs.existsSync(kp)) {
  console.error("Missing program keypair", kp);
  process.exit(1);
}

const programId = sh(`solana-keygen pubkey "${kp}"`);
const deployer = sh("solana address");
const balance = sh("solana balance");
console.log("Program ID:", programId);
console.log("Deployer  :", deployer);
console.log("Balance   :", balance);

const balNum = parseFloat(balance);
if (!(balNum >= 2.5)) {
  console.error("\nNeed ~3 SOL on Devnet to deploy (rent ~2 SOL + fees).");
  console.error("Fund this address then re-run:");
  console.error(" ", deployer);
  console.error("\nOptions:");
  console.error(" 1) Phantom → Devnet → https://faucet.solana.com (sign in GitHub)");
  console.error(" 2) Transfer SOL from another Devnet wallet");
  console.error(" 3) solana airdrop 2  (when public faucet recovers)");
  process.exit(2);
}

shOut(`solana config set --url https://api.devnet.solana.com`);
shOut(
  `solana program deploy "${so}" --program-id "${kp}" --url https://api.devnet.solana.com`
);

// Write / merge .env.local
let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
function upsert(key, val) {
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(env)) env = env.replace(re, `${key}=${val}`);
  else env += (env.endsWith("\n") || env === "" ? "" : "\n") + `${key}=${val}\n`;
}
upsert("NEXT_PUBLIC_SOLANA_CLUSTER", "devnet");
upsert("NEXT_PUBLIC_SOLANA_RPC", "https://api.devnet.solana.com");
upsert("NEXT_PUBLIC_SOLANA_LIVE", "1");
upsert("NEXT_PUBLIC_SAFERETURN_PROGRAM_ID", programId);
upsert("NEXT_PUBLIC_SAFEPOINT_AUTHORITY", deployer);

fs.writeFileSync(envPath, env);
console.log("\nUpdated", envPath);
console.log("Next: node scripts/setup-devnet.mjs  (create mock USDC mint + fund ATA)");
console.log("Explorer:", `https://explorer.solana.com/address/${programId}?cluster=devnet`);
