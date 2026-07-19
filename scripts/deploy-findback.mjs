/**
 * Build + deploy FindBack program to Solana Devnet.
 * Requires: cargo-build-sbf, solana CLI, funded id.json
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const programDir = path.join(root, "programs", "findback");
const keypair = path.join(root, "target", "deploy", "findback-keypair.json");
const soOut = path.join(root, "target", "deploy", "findback.so");

function run(cmd, opts = {}) {
  console.log("\n>", cmd);
  execSync(cmd, { stdio: "inherit", cwd: root, ...opts });
}

function pubkey(kp) {
  return execSync(`solana-keygen pubkey "${kp}"`, { encoding: "utf8" }).trim();
}

console.log("=== FindBack deploy (Devnet) ===");
if (!fs.existsSync(keypair)) {
  console.error("Missing", keypair);
  process.exit(1);
}

const programId = pubkey(keypair);
console.log("Program ID:", programId);

// Ensure declare_id matches
const libRs = path.join(programDir, "src", "lib.rs");
let src = fs.readFileSync(libRs, "utf8");
src = src.replace(
  /declare_id!\("[^"]+"\);/,
  `declare_id!("${programId}");`
);
fs.writeFileSync(libRs, src);

run(
  `cargo-build-sbf --manifest-path "${path.join(programDir, "Cargo.toml")}" --sbf-out-dir "${path.join(root, "target", "deploy")}"`
);

if (!fs.existsSync(soOut)) {
  // cargo-build-sbf may name after crate
  const alt = path.join(root, "target", "deploy", "findback.so");
  if (!fs.existsSync(alt)) {
    console.error("findback.so not found after build");
    process.exit(1);
  }
}

run(`solana program deploy "${soOut}" --program-id "${keypair}" --url devnet`);

// Update env files
function upsertEnv(file, key, val) {
  let t = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(t)) t = t.replace(re, `${key}=${val}`);
  else t = t.trimEnd() + `\n${key}=${val}\n`;
  fs.writeFileSync(file, t);
}

const envLocal = path.join(root, ".env.local");
upsertEnv(envLocal, "NEXT_PUBLIC_FINDBACK_PROGRAM_ID", programId);
upsertEnv(envLocal, "NEXT_PUBLIC_SOLANA_LIVE", "1");
upsertEnv(envLocal, "NEXT_PUBLIC_SOLANA_CLUSTER", "devnet");

fs.writeFileSync(path.join(root, ".findback-program-id"), programId + "\n");

console.log("\nDeployed FindBack:", programId);
console.log(
  "Explorer:",
  `https://explorer.solana.com/address/${programId}?cluster=devnet`
);
console.log("Next: npm run findback:setup");
