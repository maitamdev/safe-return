#!/usr/bin/env node
/**
 * Fails CI/local gates when the committed Anchor IDL is missing or drifts
 * from Anchor.toml / NEXT_PUBLIC_FINDBACK_PROGRAM_ID defaults.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const idlPath = resolve(root, "target/idl/findback.json");
const anchorPath = resolve(root, "Anchor.toml");

if (!existsSync(idlPath)) {
  console.error("Missing target/idl/findback.json — restore from git or rebuild the program.");
  process.exit(1);
}

const idl = JSON.parse(readFileSync(idlPath, "utf8"));
const toml = readFileSync(anchorPath, "utf8");
const match = toml.match(/findback\s*=\s*"([^"]+)"/);
if (!match) {
  console.error("Could not parse findback program id from Anchor.toml");
  process.exit(1);
}

if (idl.address !== match[1]) {
  console.error(`IDL address ${idl.address} does not match Anchor.toml ${match[1]}`);
  process.exit(1);
}

if (!Array.isArray(idl.instructions) || idl.instructions.length < 10) {
  console.error("IDL looks incomplete (too few instructions).");
  process.exit(1);
}

console.log(`IDL OK — ${idl.address} (${idl.instructions.length} instructions)`);
