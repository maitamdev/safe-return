/**
 * Bankrun-style flow contract tests (no local validator required).
 *
 * Asserts the instruction surface, PDA uniqueness, and sponsored instruction
 * wiring a full bankrun suite would exercise. Pair with `npm run findback:smoke`
 * on Devnet for live program proof.
 */
import { Keypair } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import idl from "../../../target/idl/findback.json";
import {
  IX,
  PROGRAM_PK,
  arbitrationPanelPda,
  bountyPda,
  buildCreateAndFundBountyInstructions,
  claimV2Pda,
  createBountySponsoredInstruction,
  disputeCasePda,
  fundBountySponsoredInstruction,
  submitClaimV2Instruction,
  submitClaimV2SponsoredInstruction,
  vaultAuthorityPda,
} from "./program";

const V2_FLOW = [
  "create_bounty_v2",
  "fund_bounty",
  "submit_claim_v2",
  "record_ai_review_v2",
  "reject_claim_v2",
  "open_dispute_v3",
  "configure_arbitration_panel",
  "cast_arbitration_vote",
  "finalize_dispute_release",
  "accept_claim_v2",
] as const;

describe("bankrun-style multi-claim flow contract", () => {
  const names = new Set((idl.instructions as { name: string }[]).map((ix) => ix.name));

  it("exposes the full v2 happy-path instruction surface", () => {
    for (const name of V2_FLOW) {
      expect(names.has(name), `missing ${name}`).toBe(true);
      expect(IX[name as keyof typeof IX]).toBeInstanceOf(Buffer);
      expect(IX[name as keyof typeof IX]).toHaveLength(8);
    }
  });

  it("derives independent claim PDAs so three finders can claim one bounty", () => {
    const bountyId = "bankrun-multi-claim";
    const [bounty] = bountyPda(bountyId);
    const finders = [Keypair.generate(), Keypair.generate(), Keypair.generate()].map(
      (k) => k.publicKey,
    );
    const claims = finders.map((finder) => claimV2Pda(bountyId, finder)[0].toBase58());
    expect(new Set(claims).size).toBe(3);
    expect(bounty.toBase58()).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
  });

  it("keeps vault authority PDA distinct from bounty PDA", () => {
    const bountyId = "bankrun-vault";
    const [bounty] = bountyPda(bountyId);
    const [vault] = vaultAuthorityPda(bountyId);
    expect(bounty.equals(vault)).toBe(false);
  });

  it("builds create+fund instruction pair for atomic listing", () => {
    const owner = Keypair.generate().publicKey;
    const meta = new Uint8Array(32).fill(3);
    const ixs = buildCreateAndFundBountyInstructions(
      owner,
      {
        bountyId: "bankrun-cf",
        rewardUi: 1,
        deadlineUnix: Math.floor(Date.now() / 1000) + 86_400,
        metadataHash: meta,
      },
      true,
    );
    expect(ixs).toHaveLength(2);
    expect(ixs[0].programId.equals(PROGRAM_PK)).toBe(true);
    expect(ixs[1].programId.equals(PROGRAM_PK)).toBe(true);
  });

  it("wires sponsored create/fund/claim with fee-payer as extra signer", () => {
    const owner = Keypair.generate().publicKey;
    const sponsor = Keypair.generate().publicKey;
    const finder = Keypair.generate().publicKey;
    const meta = new Uint8Array(32).fill(7);
    const evidence = new Uint8Array(32).fill(9);

    const createIx = createBountySponsoredInstruction({
      owner,
      sponsor,
      bountyId: "sp-create",
      rewardAmount: BigInt(1_000_000),
      deadlineUnix: Math.floor(Date.now() / 1000) + 86_400,
      metadataHash: meta,
    });
    expect(createIx.keys.some((k) => k.pubkey.equals(sponsor) && k.isSigner)).toBe(true);
    expect(createIx.keys.some((k) => k.pubkey.equals(owner) && k.isSigner)).toBe(true);

    const fundIx = fundBountySponsoredInstruction({
      owner,
      sponsor,
      bountyId: "sp-fund",
      amount: BigInt(1_000_000),
    });
    expect(fundIx.keys.some((k) => k.pubkey.equals(sponsor) && k.isSigner)).toBe(true);

    const claimIx = submitClaimV2SponsoredInstruction({
      finder,
      sponsor,
      bountyId: "sp-claim",
      evidenceHash: evidence,
    });
    expect(claimIx.keys.some((k) => k.pubkey.equals(sponsor) && k.isSigner)).toBe(true);

    const selfPay = submitClaimV2Instruction({
      finder,
      bountyId: "sp-claim-self",
      evidenceHash: evidence,
    });
    expect(selfPay.programId.equals(PROGRAM_PK)).toBe(true);
  });

  it("derives dispute case PDA under panel for 2-of-3 arbitration", () => {
    const bountyId = "bankrun-arb";
    const finder = Keypair.generate().publicKey;
    const [panel] = arbitrationPanelPda(bountyId);
    const [dispute] = disputeCasePda(bountyId, finder);
    expect(panel.equals(dispute)).toBe(false);
  });
});
