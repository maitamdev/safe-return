import { createHash } from "node:crypto";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import idl from "../../../target/idl/findback.json";
import {
  ARBITRATION_PANEL_SEED,
  ARBITRATION_VOTE_SEED,
  BOUNTY_SEED,
  CLAIM_V2_SEED,
  DISPUTE_CASE_SEED,
  IX,
  PROGRAM_PK,
  REPUTATION_SEED,
  RETURN_ATTESTATION_SEED,
  arbitrationPanelPda,
  arbitrationVotePda,
  bountyPda,
  buildCreateAndFundBountyInstructions,
  claimV2Pda,
  createBountySponsoredInstruction,
  disputeCasePda,
  fundBountySponsoredInstruction,
  reputationPda,
  returnAttestationPda,
  submitClaimV2SponsoredInstruction,
} from "./program";

type IdlInstruction = { name: string; discriminator: number[] };
type IdlAccount = { name: string; discriminator: number[] };

const instructions = idl.instructions as IdlInstruction[];
const accounts = idl.accounts as IdlAccount[];

function discriminator(namespace: "global" | "account", name: string) {
  return createHash("sha256")
    .update(`${namespace}:${name}`)
    .digest()
    .subarray(0, 8);
}

describe("FindBack generated IDL contract", () => {
  it.each(Object.entries(IX))(
    "keeps %s aligned with the generated IDL",
    (name, bytes) => {
      const generated = instructions.find(
        (instruction) => instruction.name === name,
      );
      expect(
        generated,
        `${name} is missing from target/idl/findback.json`,
      ).toBeDefined();
      expect(Buffer.from(generated!.discriminator)).toEqual(bytes);
      expect(bytes).toEqual(discriminator("global", name));
    },
  );

  it.each([
    "ClaimV2",
    "Reputation",
    "ReturnAttestation",
    "ArbitrationPanel",
    "DisputeCase",
    "ArbitrationVote",
  ])(
    "keeps the %s account discriminator deterministic",
    (name) => {
      const account = accounts.find((candidate) => candidate.name === name);
      expect(account).toBeDefined();
      expect(Buffer.from(account!.discriminator)).toEqual(
        discriminator("account", name),
      );
    },
  );

  it("derives one independent claim PDA per bounty and finder", () => {
    const bountyId = "claim-v2-pda-test";
    const [bounty] = bountyPda(bountyId);
    const finderA = Keypair.generate().publicKey;
    const finderB = Keypair.generate().publicKey;
    const [claimA] = claimV2Pda(bountyId, finderA);
    const [claimB] = claimV2Pda(bountyId, finderB);
    const [expectedA] = PublicKey.findProgramAddressSync(
      [CLAIM_V2_SEED, bounty.toBuffer(), finderA.toBuffer()],
      PROGRAM_PK,
    );

    expect(claimA.equals(expectedA)).toBe(true);
    expect(claimA.equals(claimB)).toBe(false);
    expect(
      bounty.equals(
        PublicKey.findProgramAddressSync(
          [BOUNTY_SEED, Buffer.from(bountyId)],
          PROGRAM_PK,
        )[0],
      ),
    ).toBe(true);
  });

  it("packs bounty creation and funding into one wallet signature", () => {
    const owner = Keypair.generate().publicKey;
    const instructions = buildCreateAndFundBountyInstructions(
      owner,
      {
        bountyId: "one-signature-bounty",
        rewardUi: 10,
        deadlineUnix: 2_000_000_000,
        metadataHash: new Uint8Array(32).fill(7),
      },
      true,
    );
    const transaction = new Transaction({
      feePayer: owner,
      recentBlockhash: Keypair.generate().publicKey.toBase58(),
    }).add(...instructions);

    expect(instructions).toHaveLength(2);
    expect(instructions[0]?.data.subarray(0, 8)).toEqual(IX.create_bounty_v2);
    expect(instructions[1]?.data.subarray(0, 8)).toEqual(IX.fund_bounty);
    expect(transaction.compileMessage().header.numRequiredSignatures).toBe(1);
    expect(
      transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      }).length,
    ).toBeLessThanOrEqual(1232);
  });

  it("derives reputation and settlement attestation PDAs from immutable actors", () => {
    const bountyId = "attestation-pda-test";
    const owner = Keypair.generate().publicKey;
    const finder = Keypair.generate().publicKey;
    const [bounty] = bountyPda(bountyId);
    const [claim] = claimV2Pda(bountyId, finder);
    const [reputation] = reputationPda(owner);
    const [attestation] = returnAttestationPda(bountyId, finder);

    expect(reputation).toEqual(
      PublicKey.findProgramAddressSync(
        [REPUTATION_SEED, owner.toBuffer()],
        PROGRAM_PK,
      )[0],
    );
    expect(attestation).toEqual(
      PublicKey.findProgramAddressSync(
        [RETURN_ATTESTATION_SEED, bounty.toBuffer(), claim.toBuffer()],
        PROGRAM_PK,
      )[0],
    );
  });

  it("derives an immutable panel, case, and one vote PDA per arbiter", () => {
    const bountyId = "quorum-pda-test";
    const finder = Keypair.generate().publicKey;
    const arbiterA = Keypair.generate().publicKey;
    const arbiterB = Keypair.generate().publicKey;
    const [bounty] = bountyPda(bountyId);
    const [claim] = claimV2Pda(bountyId, finder);
    const [panel] = arbitrationPanelPda(bountyId);
    const [disputeCase] = disputeCasePda(bountyId, finder);
    const [voteA] = arbitrationVotePda(bountyId, finder, arbiterA);
    const [voteB] = arbitrationVotePda(bountyId, finder, arbiterB);

    expect(panel).toEqual(
      PublicKey.findProgramAddressSync(
        [ARBITRATION_PANEL_SEED, bounty.toBuffer()],
        PROGRAM_PK,
      )[0],
    );
    expect(disputeCase).toEqual(
      PublicKey.findProgramAddressSync(
        [DISPUTE_CASE_SEED, claim.toBuffer()],
        PROGRAM_PK,
      )[0],
    );
    expect(voteA).toEqual(
      PublicKey.findProgramAddressSync(
        [ARBITRATION_VOTE_SEED, disputeCase.toBuffer(), arbiterA.toBuffer()],
        PROGRAM_PK,
      )[0],
    );
    expect(voteA.equals(voteB)).toBe(false);
  });

  it("keeps sponsored instructions restricted to the user and sponsor signers", () => {
    const owner = Keypair.generate().publicKey;
    const sponsor = Keypair.generate().publicKey;
    const bountyId = "sponsored-test";
    const instructionsToCheck = [
      createBountySponsoredInstruction({
        owner,
        sponsor,
        bountyId,
        rewardAmount: BigInt(1_000_000),
        deadlineUnix: 2_000_000_000,
        metadataHash: new Uint8Array(32).fill(1),
      }),
      fundBountySponsoredInstruction({
        owner,
        sponsor,
        bountyId,
        amount: BigInt(1_000_000),
      }),
      submitClaimV2SponsoredInstruction({
        finder: owner,
        sponsor,
        bountyId,
        evidenceHash: new Uint8Array(32).fill(2),
      }),
    ];

    for (const instruction of instructionsToCheck) {
      const signers = instruction.keys.filter((key) => key.isSigner);
      expect(instruction.programId).toEqual(PROGRAM_PK);
      expect(signers).toHaveLength(2);
      expect(signers.some((key) => key.pubkey.equals(owner))).toBe(true);
      expect(signers.some((key) => key.pubkey.equals(sponsor) && key.isWritable)).toBe(true);
    }
  });
});
