/**
 * Push reviewed SafeReturn migrations to the configured Supabase database.
 *
 * Required in .env.local (never commit it):
 *   SUPABASE_DB_URL=postgresql://...
 * Set CONFIRM_SUPABASE_MIGRATE=1 for the write step. Without it, this command
 * performs only the remote dry-run.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = { ...readEnv(path.join(root, ".env.local")), ...process.env };
const dbUrl = env.SUPABASE_DB_URL?.trim();
const projectUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

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

function fail(message) {
  console.error(message);
  process.exit(1);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

if (!dbUrl) {
  fail("Thiếu SUPABASE_DB_URL trong .env.local. Lấy URI tại Supabase Dashboard > Connect.");
}
if (!projectUrl) fail("Thiếu NEXT_PUBLIC_SUPABASE_URL trong .env.local.");

let database;
let project;
try {
  database = new URL(dbUrl);
  project = new URL(projectUrl);
} catch {
  fail("SUPABASE_DB_URL hoặc NEXT_PUBLIC_SUPABASE_URL không phải URL hợp lệ.");
}

if (!["postgres:", "postgresql:"].includes(database.protocol)) {
  fail("SUPABASE_DB_URL phải là PostgreSQL connection string.");
}
if (project.protocol !== "https:" || !project.hostname.endsWith(".supabase.co")) {
  fail("NEXT_PUBLIC_SUPABASE_URL không phải Supabase project URL hợp lệ.");
}

const projectRef = project.hostname.split(".")[0];
const databaseIdentity = `${database.hostname}:${decodeURIComponent(database.username)}`;
if (!databaseIdentity.includes(projectRef)) {
  fail(`Connection string không thuộc project ${projectRef}; migration đã bị chặn.`);
}

const migrationArgs = [
  "supabase",
  "db",
  "push",
  "--db-url",
  dbUrl,
  "--include-all",
  "--yes",
];

console.log(`Supabase project: ${projectRef}`);
console.log("Đang kiểm tra migration bằng remote dry-run (connection string được ẩn)...");
run(npx, [...migrationArgs, "--dry-run"]);

if (env.CONFIRM_SUPABASE_MIGRATE !== "1") {
  console.log("Dry-run hoàn tất. Đặt CONFIRM_SUPABASE_MIGRATE=1 rồi chạy lại để áp dụng.");
  process.exit(0);
}

console.log("Đang áp dụng các migration đã review...");
run(npx, migrationArgs);
console.log("Migration hoàn tất. Đang bắt buộc xác minh protocol v2 và SafeTag từ API công khai...");
run(process.execPath, [
  path.join(root, "scripts", "check-release-readiness.mjs"),
  "--require-v2-ready",
]);
