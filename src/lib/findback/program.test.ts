import { createHash } from "node:crypto";
import { Keypair, PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import idl from "../../../target/idl/findback.json";
import { BOUNTY_SEED, CLAIM_V2_SEED, IX, PROGRAM_PK, bountyPda, claimV2Pda } from "./program";

type IdlInstruction = { name: string; discriminator: number[] };
type IdlAccount = { name: string; discriminator: number[] };

const instructions = idl.instructions as IdlInstruction[];
const accounts = idl.accounts as IdlAccount[];

function discriminator(namespace: "global" | "account", name: string) {
  return createHash("sha256").update(`${namespace}:${name}`).digest().subarray(0, 8);
}

describe("FindBack generated IDL contract", () => {
  it.each(Object.entries(IX))("keeps %s aligned with the generated IDL", (name, bytes) => {
    const generated = instructions.find((instruction) => instruction.name === name);
    expect(generated, `${name} is missing from target/idl/findback.json`).toBeDefined();
    expect(Buffer.from(generated!.discriminator)).toEqual(bytes);
    expect(bytes).toEqual(discriminator("global", name));
  });

  it("keeps the ClaimV2 account discriminator deterministic", () => {
    const claim = accounts.find((account) => account.name === "ClaimV2");
    expect(claim).toBeDefined();
    expect(Buffer.from(claim!.discriminator)).toEqual(discriminator("account", "ClaimV2"));
  });

  it("derives one independent claim PDA per bounty and finder", () => {
    const bountyId = "claim-v2-pda-test";
    const [bounty] = bountyPda(bountyId);
    const finderA = Keypair.generate().publicKey;
    const finderB = Keypair.generate().publicKey;
    const [claimA] = claimV2Pda(bountyId, finderA);
    const [claimB] = claimV2Pda(bountyId, finderB);
    const [expectedA] = PublicKey.findProgramAddressSync(
      [CLAIM_V2_SEED, bounty.toBuffer(), finderA.toBuffer()],
      PROGRAM_PK
    );

    expect(claimA.equals(expectedA)).toBe(true);
    expect(claimA.equals(claimB)).toBe(false);
    expect(bounty.equals(PublicKey.findProgramAddressSync(
      [BOUNTY_SEED, Buffer.from(bountyId)],
      PROGRAM_PK
    )[0])).toBe(true);
  });
});
