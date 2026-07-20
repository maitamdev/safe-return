/**
 * Safe, resumable FindBack upgrade for Solana Devnet.
 *
 * The buffer signer is persisted under target/deploy so a throttled upload can
 * be resumed by running this command again. This script never rewrites source,
 * program IDs, or environment files and it verifies the deployed bytes.
 */
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = { ...readEnv(path.join(root, ".env.local")), ...process.env };
const args = new Set(process.argv.slice(2));
const skipBuild = args.has("--skip-build");
const verifyOnly = args.has("--verify-only");
const expectedGenesis = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
const programDir = path.join(root, "programs", "findback");
const programKeypair = path.join(root, "target", "deploy", "findback-keypair.json");
const binary = path.join(root, "target", "deploy", "findback.so");
const bufferKeypair =
  env.SOLANA_DEPLOY_BUFFER_KEYPAIR ||
  path.join(root, "target", "deploy", ".findback-upgrade-buffer.json");
const authorityKeypair =
  env.SOLANA_WALLET || path.join(os.homedir(), ".config", "solana", "id.json");
const rpc = env.SOLANA_DEPLOY_RPC || env.NEXT_PUBLIC_SOLANA_RPC || "https://api.devnet.solana.com";
const solana = findTool("solana");
const keygen = findTool("solana-keygen");
const cargoBuildSbf = findTool("cargo-build-sbf");

function readEnv(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1).trim()];
      }),
  );
}

function findTool(name) {
  const extension = process.platform === "win32" ? ".exe" : "";
  const activeRelease = path.join(
    os.homedir(),
    ".local",
    "share",
    "solana",
    "install",
    "active_release",
    "bin",
    `${name}${extension}`,
  );
  return fs.existsSync(activeRelease) ? activeRelease : name;
}

function displayArg(value) {
  if (!/^https?:\/\//i.test(value)) return value.includes(" ") ? JSON.stringify(value) : value;
  try {
    const parsed = new URL(value);
    return `${parsed.origin}${parsed.pathname}${parsed.search ? "?[redacted]" : ""}`;
  } catch {
    return "[rpc-url]";
  }
}

function run(command, commandArgs, options = {}) {
  console.log(`> ${path.basename(command)} ${commandArgs.map(displayArg).join(" ")}`);
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    encoding: options.capture ? "utf8" : undefined,
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const details = options.capture ? (result.stderr || result.stdout || "").trim() : "";
    throw new Error(`${path.basename(command)} exited with ${result.status}${details ? `: ${details}` : ""}`);
  }
  return options.capture ? result.stdout.trim() : "";
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(contents) {
  return crypto.createHash("sha256").update(contents).digest("hex");
}

function verifyDeployedBytes(programId, localBytes) {
  const dump = path.join(os.tmpdir(), `findback-${process.pid}-${Date.now()}.so`);
  try {
    run(solana, ["program", "dump", programId, dump, "--url", rpc]);
    const deployed = fs.readFileSync(dump);
    const samePrefix =
      deployed.length >= localBytes.length && deployed.subarray(0, localBytes.length).equals(localBytes);
    const zeroPadding = deployed.subarray(localBytes.length).every((byte) => byte === 0);
    assert(
      samePrefix && zeroPadding,
      `On-chain bytecode mismatch (local ${sha256(localBytes)}, deployed ${sha256(deployed)}).`,
    );
    console.log(`Verified on-chain bytecode: ${sha256(localBytes)}`);
  } finally {
    fs.rmSync(dump, { force: true });
  }
}

console.log("SafeReturn FindBack — guarded Devnet upgrade");
assert(env.NEXT_PUBLIC_SOLANA_CLUSTER === "devnet", "NEXT_PUBLIC_SOLANA_CLUSTER must be devnet.");
assert(fs.existsSync(programKeypair), `Missing ${programKeypair}`);
assert(fs.existsSync(authorityKeypair), `Missing authority keypair ${authorityKeypair}`);

const genesis = run(solana, ["genesis-hash", "--url", rpc], { capture: true });
assert(genesis === expectedGenesis, `Refusing non-Devnet cluster with genesis ${genesis}.`);

const programId = run(keygen, ["pubkey", programKeypair], { capture: true });
const authority = run(keygen, ["pubkey", authorityKeypair], { capture: true });
assert(
  programId === env.NEXT_PUBLIC_FINDBACK_PROGRAM_ID,
  "Program keypair does not match NEXT_PUBLIC_FINDBACK_PROGRAM_ID.",
);

const rust = fs.readFileSync(path.join(programDir, "src", "lib.rs"), "utf8");
const declared = rust.match(/declare_id!\("([^"]+)"\)/)?.[1];
assert(declared === programId, `Rust declare_id ${declared || "missing"} does not match ${programId}.`);

const programInfo = run(solana, ["program", "show", programId, "--url", rpc], { capture: true });
const onChainAuthority = programInfo.match(/Authority:\s+(\S+)/)?.[1];
assert(onChainAuthority === authority, `Upgrade authority mismatch: ${onChainAuthority || "missing"}.`);

if (!skipBuild && !verifyOnly) {
  run(cargoBuildSbf, [
    "--manifest-path",
    path.join(programDir, "Cargo.toml"),
    "--sbf-out-dir",
    path.join(root, "target", "deploy"),
  ]);
}
assert(fs.existsSync(binary), `Missing compiled program ${binary}`);
const localBytes = fs.readFileSync(binary);
console.log(`Program ${programId}`);
console.log(`Authority ${authority}`);
console.log(`Binary ${localBytes.length} bytes · sha256 ${sha256(localBytes)}`);

if (verifyOnly) {
  verifyDeployedBytes(programId, localBytes);
  process.exit(0);
}

assert(
  env.CONFIRM_DEVNET_DEPLOY === "1",
  "Set CONFIRM_DEVNET_DEPLOY=1 to authorize this Devnet upgrade.",
);

fs.mkdirSync(path.dirname(bufferKeypair), { recursive: true });
if (!fs.existsSync(bufferKeypair)) {
  run(keygen, [
    "new",
    "--no-bip39-passphrase",
    "--silent",
    "--force",
    "--outfile",
    bufferKeypair,
  ]);
}
const bufferAddress = run(keygen, ["pubkey", bufferKeypair], { capture: true });
console.log(`Resumable buffer ${bufferAddress}`);

try {
  run(solana, [
    "program",
    "deploy",
    binary,
    "--program-id",
    programId,
    "--buffer",
    bufferKeypair,
    "--upgrade-authority",
    authorityKeypair,
    "--fee-payer",
    authorityKeypair,
    "--max-sign-attempts",
    "20",
    "--no-auto-extend",
    "--url",
    rpc,
  ]);
} catch (error) {
  console.error(`\nUpgrade paused. Buffer ${bufferAddress} and its signer were retained.`);
  console.error("Run the same command again to resume without allocating another buffer.");
  throw error;
}

// Loader-v3 activates an upgrade one slot later; a short read delay avoids a
// false mismatch from a stale cache/RPC node.
await new Promise((resolve) => setTimeout(resolve, 2_500));
verifyDeployedBytes(programId, localBytes);
console.log("Devnet upgrade completed and byte-for-byte verified.");
