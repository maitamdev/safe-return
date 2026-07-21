import { PublicKey } from "@solana/web3.js";
import {
  PROGRAM_PK,
  BOUNTY_SEED,
  VAULT_SEED,
  CLAIM_V2_SEED,
  REPUTATION_SEED,
  RETURN_ATTESTATION_SEED,
  ARBITRATION_PANEL_SEED,
  DISPUTE_CASE_SEED,
  ARBITRATION_VOTE_SEED,
} from "./constants";

export function bountyPda(bountyId: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [BOUNTY_SEED, Buffer.from(bountyId)],
    PROGRAM_PK,
  );
}

export function vaultAuthorityPda(bountyId: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [VAULT_SEED, Buffer.from(bountyId)],
    PROGRAM_PK,
  );
}

export function claimV2Pda(
  bountyId: string,
  finder: PublicKey,
): [PublicKey, number] {
  const [bounty] = bountyPda(bountyId);
  return PublicKey.findProgramAddressSync(
    [CLAIM_V2_SEED, bounty.toBuffer(), finder.toBuffer()],
    PROGRAM_PK,
  );
}

export function reputationPda(wallet: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [REPUTATION_SEED, wallet.toBuffer()],
    PROGRAM_PK,
  );
}

export function returnAttestationPda(
  bountyId: string,
  finder: PublicKey,
): [PublicKey, number] {
  const [bounty] = bountyPda(bountyId);
  const [claim] = claimV2Pda(bountyId, finder);
  return PublicKey.findProgramAddressSync(
    [RETURN_ATTESTATION_SEED, bounty.toBuffer(), claim.toBuffer()],
    PROGRAM_PK,
  );
}

export function arbitrationPanelPda(bountyId: string): [PublicKey, number] {
  const [bounty] = bountyPda(bountyId);
  return PublicKey.findProgramAddressSync(
    [ARBITRATION_PANEL_SEED, bounty.toBuffer()],
    PROGRAM_PK
  );
}

export function disputeCasePda(
  bountyId: string,
  finder: PublicKey
): [PublicKey, number] {
  const [claim] = claimV2Pda(bountyId, finder);
  return PublicKey.findProgramAddressSync(
    [DISPUTE_CASE_SEED, claim.toBuffer()],
    PROGRAM_PK
  );
}

export function arbitrationVotePda(
  bountyId: string,
  finder: PublicKey,
  arbiter: PublicKey
): [PublicKey, number] {
  const [disputeCase] = disputeCasePda(bountyId, finder);
  return PublicKey.findProgramAddressSync(
    [ARBITRATION_VOTE_SEED, disputeCase.toBuffer(), arbiter.toBuffer()],
    PROGRAM_PK
  );
}
