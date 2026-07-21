import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FINDBACK_PROGRAM_ID } from "./config";

type IdlLike = {
  address: string;
  metadata?: { name?: string; version?: string };
  instructions: Array<{ name: string }>;
  accounts?: Array<{ name: string }>;
};

const REQUIRED_INSTRUCTIONS = [
  "create_bounty",
  "create_bounty_v2",
  "fund_bounty",
  "submit_claim_v2",
  "record_ai_review_v2",
  "accept_claim_v2",
  "reject_claim_v2",
  "refund_after_expiry",
  "configure_arbitration_panel",
  "cast_arbitration_vote",
  "attest_settlement",
];

describe("committed Anchor IDL contract", () => {
  const idlPath = resolve(process.cwd(), "target/idl/findback.json");
  const idl = JSON.parse(readFileSync(idlPath, "utf8")) as IdlLike;

  it("matches the configured Devnet program id", () => {
    expect(idl.address).toBe(FINDBACK_PROGRAM_ID);
    expect(idl.metadata?.name || "").toMatch(/findback/i);
  });

  it("exposes the multi-claim and arbitration surface", () => {
    const names = new Set(idl.instructions.map((ix) => ix.name));
    for (const required of REQUIRED_INSTRUCTIONS) {
      expect(names.has(required), `missing instruction ${required}`).toBe(true);
    }
  });

  it("declares the core account types used by the client", () => {
    const accounts = new Set((idl.accounts || []).map((account) => account.name));
    for (const name of ["Bounty", "ClaimV2", "Reputation", "DisputeCase", "ArbitrationPanel"]) {
      expect(accounts.has(name), `missing account ${name}`).toBe(true);
    }
  });
});
