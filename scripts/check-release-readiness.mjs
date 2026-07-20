/**
 * SafeReturn release preflight.
 *
 * This script never prints secret values. It verifies that public config,
 * Anchor artifacts, Solana Devnet and the Supabase schema agree before a v2
 * feature flag can be enabled.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import { getMint } from "@solana/spl-token";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const envFileArg = process.argv.find((value) => value.startsWith("--env-file="));
const envFile = envFileArg
  ? path.resolve(root, envFileArg.slice("--env-file=".length))
  : path.join(root, ".env.local");
const requireV2 = args.has("--require-v2-ready");
const production = args.has("--production");

const results = [];
const env = { ...readEnvFile(envFile), ...withoutUndefined(process.env) };

function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const parsed = {};
  for (const rawLine of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      try {
        value = JSON.parse(value);
      } catch {
        // Preserve the raw value; validation below will report a useful error.
      }
    }
    parsed[key] = value;
  }
  return parsed;
}

function withoutUndefined(source) {
  return Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined),
  );
}

function record(level, name, detail) {
  results.push({ level, name, detail });
  const icon = level === "pass" ? "PASS" : level === "warn" ? "WARN" : "FAIL";
  console.log(`[${icon}] ${name}: ${detail}`);
}

function requireValue(name, { secret = false } = {}) {
  const value = env[name]?.trim();
  const valid = Boolean(value && value !== "CHANGE_ME");
  record(
    valid ? "pass" : "fail",
    name,
    valid ? (secret ? "đã cấu hình (giá trị được ẩn)" : "đã cấu hình") : "đang thiếu",
  );
  return valid ? value : null;
}

function optionalSecret(name) {
  const value = env[name]?.trim();
  record(
    value && value !== "CHANGE_ME" ? "pass" : "warn",
    name,
    value && value !== "CHANGE_ME" ? "đã cấu hình (giá trị được ẩn)" : "chưa cấu hình",
  );
  return value && value !== "CHANGE_ME" ? value : null;
}

function publicKey(name) {
  const value = requireValue(name);
  if (!value) return null;
  try {
    return new PublicKey(value);
  } catch {
    record("fail", `${name} format`, "không phải Solana public key hợp lệ");
    return null;
  }
}

function parseSecretKey(name, raw) {
  if (!raw) return null;
  try {
    const bytes = JSON.parse(raw);
    if (!Array.isArray(bytes) || bytes.length !== 64) throw new Error();
    return Keypair.fromSecretKey(Uint8Array.from(bytes));
  } catch {
    record("fail", `${name} format`, "phải là mảng JSON gồm 64 số; giá trị không được in ra");
    return null;
  }
}

async function probeSupabase(url, key, table, columns) {
  const response = await fetch(
    `${url}/rest/v1/${table}?select=${encodeURIComponent(columns)}&limit=0`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (response.ok) return { ready: true, detail: "schema khả dụng" };
  const payload = await response.json().catch(() => ({}));
  return {
    ready: false,
    detail: typeof payload.message === "string" ? payload.message : `HTTP ${response.status}`,
  };
}

console.log("SafeReturn release readiness\n");
console.log(`Environment file: ${fs.existsSync(envFile) ? path.relative(root, envFile) || ".env.local" : "không có"}`);
console.log(`Mode: ${production ? "production" : "development"}${requireV2 ? ", require-v2-ready" : ""}\n`);

const cluster = requireValue("NEXT_PUBLIC_SOLANA_CLUSTER");
if (cluster && cluster !== "devnet") {
  record("fail", "Solana cluster", "SafeReturn chỉ cho phép devnet");
}
const rpc = requireValue("NEXT_PUBLIC_SOLANA_RPC");
const programId = publicKey("NEXT_PUBLIC_FINDBACK_PROGRAM_ID");
const mint = publicKey("NEXT_PUBLIC_FIND_MINT");
const arbiter = publicKey("NEXT_PUBLIC_ARBITER");
const supabaseUrl = requireValue("NEXT_PUBLIC_SUPABASE_URL");
const anonKey = requireValue("NEXT_PUBLIC_SUPABASE_ANON_KEY", { secret: true });

if (production) {
  const siteUrl = requireValue("NEXT_PUBLIC_SITE_URL");
  if (siteUrl) {
    try {
      const parsed = new URL(siteUrl);
      if (parsed.protocol !== "https:") throw new Error();
      record("pass", "Production URL", parsed.origin);
    } catch {
      record("fail", "Production URL", "phải là URL HTTPS hợp lệ");
    }
  }
  requireValue("SUPABASE_SERVICE_ROLE_KEY", { secret: true });
  const hasGroq = Boolean(env.GROQ_API_KEY?.trim());
  const hasOpenAi = Boolean(env.OPENAI_API_KEY?.trim());
  record(
    hasGroq || hasOpenAi ? "pass" : "fail",
    "AI provider",
    hasGroq || hasOpenAi ? "đã cấu hình provider thật (key được ẩn)" : "thiếu GROQ_API_KEY hoặc OPENAI_API_KEY",
  );
}

const idlPath = path.join(root, "target", "idl", "findback.json");
const sourcePath = path.join(root, "programs", "findback", "src", "lib.rs");
const programKeypairPath = path.join(root, "target", "deploy", "findback-keypair.json");
const programBinaryPath = path.join(root, "target", "deploy", "findback.so");
const migrationContracts = [
  {
    name: "2026072001_protocol_v2.sql",
    required: [
      /protocol_version/i,
      /claims_bounty_finder_unique/i,
      /claim_pda/i,
      /ai_input_hash/i,
      /chain_events/i,
      /claim-evidence/i,
      /enable row level security/i,
    ],
  },
  {
    name: "2026072002_safe_tags.sql",
    required: [
      /create table if not exists public\.safe_tags/i,
      /create table if not exists public\.safe_tag_reports/i,
      /reporter_fingerprint/i,
      /enable row level security/i,
      /revoke insert, update, delete/i,
    ],
  },
  {
    name: "2026072003_sponsored_fees.sql",
    required: [
      /create table if not exists public\.sponsored_transactions/i,
      /last_valid_block_height/i,
      /expires_at/i,
      /enable row level security/i,
      /revoke insert, update, delete/i,
    ],
  },
  {
    name: "2026072004_private_claim_evidence.sql",
    required: [
      /Participants read private claims/i,
      /auth\.uid\(\) = finder_id/i,
      /b\.owner_id = auth\.uid\(\)/i,
      /verified arbitration APIs/i,
      /notify pgrst/i,
    ],
  },
  {
    name: "2026072005_claim_handover.sql",
    required: [
      /workflow_status/i,
      /create table if not exists public\.claim_messages/i,
      /create table if not exists public\.claim_handovers/i,
      /Participants read claim messages/i,
      /Participants read claim handovers/i,
      /revoke insert, update, delete/i,
      /supabase_realtime/i,
      /notify pgrst/i,
    ],
  },
  {
    name: "2026072006_backfill_terminal_claim_workflows.sql",
    required: [
      /status = 'settled'/i,
      /status = 'rejected'/i,
      /status = 'disputed'/i,
      /workflow_status/i,
      /notify pgrst/i,
    ],
  },
];
for (const migration of migrationContracts) {
  const migrationPath = path.join(root, "supabase", "migrations", migration.name);
  const sql = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, "utf8") : "";
  const missingContracts = migration.required.filter((pattern) => !pattern.test(sql));
  record(
    sql && missingContracts.length === 0 ? "pass" : "fail",
    `Migration ${migration.name}`,
    !sql
      ? "bị thiếu"
      : missingContracts.length
        ? `thiếu ${missingContracts.length} invariant bắt buộc`
        : `${migration.required.length} invariant schema/RLS đều có`,
  );
}

if (!fs.existsSync(idlPath)) {
  record("fail", "Anchor IDL", "thiếu target/idl/findback.json");
} else {
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));
  const requiredInstructions = [
    "create_bounty_v2",
    "create_bounty_sponsored",
    "submit_claim_v2",
    "submit_claim_v2_sponsored",
    "record_ai_review_v2",
    "accept_claim_v2",
    "reject_claim_v2",
    "configure_arbitration_panel",
    "cast_arbitration_vote",
    "finalize_dispute_release",
    "finalize_dispute_reject",
    "attest_settlement",
  ];
  const names = new Set(idl.instructions?.map((instruction) => instruction.name));
  const missing = requiredInstructions.filter((name) => !names.has(name));
  record(
    missing.length === 0 ? "pass" : "fail",
    "Anchor IDL v2",
    missing.length === 0 ? `${requiredInstructions.length} instruction bắt buộc đều có` : `thiếu ${missing.join(", ")}`,
  );
  if (programId) {
    record(
      idl.address === programId.toBase58() ? "pass" : "fail",
      "IDL program address",
      idl.address === programId.toBase58() ? "khớp cấu hình" : "không khớp cấu hình",
    );
  }
}

if (fs.existsSync(sourcePath) && programId) {
  const declared = fs.readFileSync(sourcePath, "utf8").match(/declare_id!\("([^"]+)"\)/)?.[1];
  record(
    declared === programId.toBase58() ? "pass" : "fail",
    "Rust declare_id",
    declared === programId.toBase58() ? "khớp cấu hình" : "không khớp cấu hình",
  );
}

if (programId && fs.existsSync(programKeypairPath)) {
  try {
    const bytes = JSON.parse(fs.readFileSync(programKeypairPath, "utf8"));
    const keypairProgramId = Keypair.fromSecretKey(Uint8Array.from(bytes)).publicKey;
    record(
      keypairProgramId.equals(programId) ? "pass" : "fail",
      "Program keypair",
      keypairProgramId.equals(programId) ? "khớp cấu hình" : "không khớp cấu hình",
    );
  } catch {
    record("fail", "Program keypair", "artifact không hợp lệ");
  }
}

let chainV2Ready = false;
if (rpc && programId && mint) {
  try {
    const connection = new Connection(rpc, "confirmed");
    const [genesisHash, programInfo, mintInfo] = await Promise.all([
      connection.getGenesisHash(),
      connection.getAccountInfo(programId),
      getMint(connection, mint),
    ]);
    const devnetGenesis = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
    record(
      genesisHash === devnetGenesis ? "pass" : "fail",
      "RPC genesis",
      genesisHash === devnetGenesis ? "đúng Solana Devnet" : "không phải Devnet",
    );
    const loader = "BPFLoaderUpgradeab1e11111111111111111111111";
    let programDataSize = 0;
    let deployedProgramBytes = null;
    let upgradeAuthority = null;
    if (
      programInfo?.data.length === 36 &&
      programInfo.data.readUInt32LE(0) === 2
    ) {
      const programDataAddress = new PublicKey(programInfo.data.subarray(4, 36));
      const programDataInfo = await connection.getAccountInfo(programDataAddress);
      if (programDataInfo?.data.readUInt32LE(0) === 3) {
        const hasAuthority = programDataInfo.data[12] === 1;
        const metadataSize = hasAuthority ? 45 : 13;
        programDataSize = programDataInfo.data.length - metadataSize;
        deployedProgramBytes = programDataInfo.data.subarray(metadataSize);
        if (hasAuthority) {
          upgradeAuthority = new PublicKey(programDataInfo.data.subarray(13, 45));
        }
      }
    }
    const localProgramBytes = fs.existsSync(programBinaryPath)
      ? fs.readFileSync(programBinaryPath)
      : null;
    const localProgramSize = localProgramBytes?.length || 0;
    const bytecodeMatches = Boolean(
      localProgramBytes &&
      deployedProgramBytes &&
      deployedProgramBytes.length >= localProgramBytes.length &&
      deployedProgramBytes.subarray(0, localProgramBytes.length).equals(localProgramBytes) &&
      deployedProgramBytes.subarray(localProgramBytes.length).every((byte) => byte === 0),
    );
    chainV2Ready = Boolean(
      programInfo?.executable &&
      programInfo.owner.toBase58() === loader &&
      programDataSize > 0 &&
      localProgramSize > 0 &&
      bytecodeMatches,
    );
    record(
      chainV2Ready ? "pass" : "fail",
      "FindBack program",
      chainV2Ready
        ? `bytecode khớp artifact local (${localProgramSize}/${programDataSize} byte)`
        : "program executable/bytecode không khớp artifact local",
    );
    if (arbiter && upgradeAuthority) {
      record(
        upgradeAuthority.equals(arbiter) ? "pass" : "fail",
        "Upgrade authority",
        upgradeAuthority.equals(arbiter) ? "khớp NEXT_PUBLIC_ARBITER" : "không khớp NEXT_PUBLIC_ARBITER",
      );
    }
    const mintReady = mintInfo.decimals === 6 && mintInfo.isInitialized;
    record(
      mintReady ? "pass" : "fail",
      "FIND mint",
      mintReady ? "SPL Token Devnet, 6 decimals" : "mint chưa sẵn sàng hoặc sai decimals",
    );
  } catch (error) {
    record("fail", "Solana RPC", error instanceof Error ? error.message : String(error));
  }
}

let schemaV2Ready = false;
let safeTagReady = false;
let sponsorSchemaReady = false;
let workflowSchemaReady = false;
if (supabaseUrl && anonKey) {
  try {
    const probes = await Promise.all([
      probeSupabase(supabaseUrl, anonKey, "bounties", "protocol_version,image_storage_path,image_sha256"),
      probeSupabase(supabaseUrl, anonKey, "claims", "id,claim_pda,protocol_version,ai_input_hash,ai_report_hash"),
      probeSupabase(supabaseUrl, anonKey, "safe_tags", "id,public_code,status"),
      probeSupabase(supabaseUrl, anonKey, "safe_tag_reports", "id,tag_id,status"),
      probeSupabase(supabaseUrl, anonKey, "sponsored_transactions", "request_id,wallet,signature,status"),
      probeSupabase(supabaseUrl, anonKey, "claim_messages", "id,claim_id,sender_role,kind,created_at"),
      probeSupabase(supabaseUrl, anonKey, "claim_handovers", "claim_id,scheduled_at,status,finder_delivered_at,owner_received_at"),
    ]);
    schemaV2Ready = probes[0].ready && probes[1].ready;
    safeTagReady = probes[2].ready && probes[3].ready;
    sponsorSchemaReady = probes[4].ready;
    workflowSchemaReady = probes[5].ready && probes[6].ready;
    record(schemaV2Ready ? "pass" : "warn", "Supabase protocol v2", schemaV2Ready ? "schema khả dụng" : `${probes[0].detail}; ${probes[1].detail}`);
    record(safeTagReady ? "pass" : "warn", "Supabase SafeTag", safeTagReady ? "schema khả dụng" : `${probes[2].detail}; ${probes[3].detail}`);
    record(sponsorSchemaReady ? "pass" : "warn", "Supabase sponsored fees", sponsorSchemaReady ? "schema khả dụng" : probes[4].detail);
    record(workflowSchemaReady ? "pass" : "warn", "Supabase claim workflow", workflowSchemaReady ? "schema realtime khả dụng" : `${probes[5].detail}; ${probes[6].detail}`);
  } catch (error) {
    record("fail", "Supabase schema probe", error instanceof Error ? error.message : String(error));
  }
}

const protocolEnabled = env.NEXT_PUBLIC_PROTOCOL_V2 === "1";
if (protocolEnabled && (!chainV2Ready || !schemaV2Ready || !safeTagReady || !workflowSchemaReady)) {
  record("fail", "Protocol v2 gate", "đang bật nhưng on-chain/Supabase chưa đồng bộ");
} else if (protocolEnabled) {
  record("pass", "Protocol v2 gate", "đã bật và các dependency bắt buộc sẵn sàng");
} else {
  record("pass", "Protocol v2 gate", "đang tắt an toàn");
}

if (requireV2 && (!chainV2Ready || !schemaV2Ready || !safeTagReady || !workflowSchemaReady)) {
  record("fail", "V2 release requirement", "chưa đủ điều kiện bật protocol v2");
}

const publicSponsored = env.NEXT_PUBLIC_SPONSORED_FEES === "1";
const serverSponsored = env.SPONSORED_FEES_ENABLED === "1";
if (publicSponsored !== serverSponsored) {
  record("fail", "Sponsored fee flags", "client và server không đồng bộ");
} else if (publicSponsored) {
  const sponsorRaw = requireValue("SPONSOR_KEYPAIR_JSON", { secret: true });
  const sponsor = parseSecretKey("SPONSOR_KEYPAIR_JSON", sponsorRaw);
  const authority = parseSecretKey("SOLANA_KEYPAIR_JSON", optionalSecret("SOLANA_KEYPAIR_JSON"));
  const sponsorReady = Boolean(sponsor && sponsorSchemaReady && protocolEnabled);
  record(sponsorReady ? "pass" : "fail", "Sponsored fees gate", sponsorReady ? "sẵn sàng" : "thiếu signer/schema/protocol v2");
  if (sponsor && authority && sponsor.publicKey.equals(authority.publicKey)) {
    record("fail", "Sponsor separation", "fee sponsor không được dùng chung authority keypair");
  }
} else {
  record("pass", "Sponsored fees gate", "đang tắt an toàn");
}

if (arbiter && programId && arbiter.equals(programId)) {
  record("fail", "Arbiter", "arbiter không được là program address");
}

const failures = results.filter((result) => result.level === "fail");
const warnings = results.filter((result) => result.level === "warn");
console.log(`\nSummary: ${results.length - failures.length - warnings.length} pass, ${warnings.length} warning, ${failures.length} fail`);
if (failures.length > 0) process.exitCode = 1;
