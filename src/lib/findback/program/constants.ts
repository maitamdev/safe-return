import { PublicKey } from "@solana/web3.js";
import { FINDBACK_PROGRAM_ID } from "../config";

export const PROGRAM_PK = new PublicKey(FINDBACK_PROGRAM_ID);
export const BOUNTY_SEED = Buffer.from("bounty");
export const VAULT_SEED = Buffer.from("vault");
export const CLAIM_V2_SEED = Buffer.from("claim_v2");
export const REPUTATION_SEED = Buffer.from("reputation");
export const RETURN_ATTESTATION_SEED = Buffer.from("return_attestation");
export const ARBITRATION_PANEL_SEED = Buffer.from("arbitration_panel");
export const DISPUTE_CASE_SEED = Buffer.from("dispute_case");
export const ARBITRATION_VOTE_SEED = Buffer.from("arbitration_vote");

/** sha256("global:<name>")[0..8] */
export const IX = {
  create_bounty: Buffer.from([122, 90, 14, 143, 8, 125, 200, 2]),
  create_bounty_v2: Buffer.from([251, 239, 2, 223, 130, 60, 86, 29]),
  fund_bounty: Buffer.from([36, 148, 139, 239, 172, 37, 58, 255]),
  submit_claim: Buffer.from([163, 108, 111, 46, 220, 82, 77, 212]),
  record_ai_review: Buffer.from([124, 116, 24, 236, 214, 167, 231, 54]),
  accept_claim: Buffer.from([139, 66, 180, 182, 209, 194, 173, 87]),
  reject_claim: Buffer.from([238, 185, 227, 8, 51, 188, 35, 182]),
  refund_after_expiry: Buffer.from([210, 2, 52, 232, 49, 218, 178, 59]),
  cancel_bounty: Buffer.from([79, 65, 107, 143, 128, 165, 135, 46]),
  open_dispute: Buffer.from([137, 25, 99, 119, 23, 223, 161, 42]),
  resolve_dispute: Buffer.from([231, 6, 202, 6, 96, 103, 12, 230]),
  submit_claim_v2: Buffer.from([11, 80, 192, 135, 76, 136, 80, 39]),
  record_ai_review_v2: Buffer.from([26, 254, 147, 241, 70, 209, 216, 6]),
  accept_claim_v2: Buffer.from([162, 165, 30, 224, 250, 107, 148, 218]),
  reject_claim_v2: Buffer.from([178, 62, 173, 231, 192, 12, 42, 112]),
  finalize_rejection_v2: Buffer.from([12, 38, 251, 74, 146, 28, 233, 22]),
  timeout_dispute_v2: Buffer.from([205, 220, 89, 130, 156, 79, 55, 150]),
  open_dispute_v2: Buffer.from([61, 105, 238, 185, 222, 78, 48, 138]),
  resolve_dispute_v2: Buffer.from([35, 255, 241, 246, 120, 1, 194, 73]),
  attest_settlement: Buffer.from([139, 194, 42, 227, 36, 121, 240, 227]),
  create_bounty_sponsored: Buffer.from([60, 19, 90, 70, 98, 64, 136, 4]),
  fund_bounty_sponsored: Buffer.from([84, 28, 214, 201, 200, 21, 52, 48]),
  submit_claim_v2_sponsored: Buffer.from([88, 167, 40, 12, 141, 217, 243, 23]),
  configure_arbitration_panel: Buffer.from([103, 173, 78, 35, 189, 128, 231, 69]),
  open_dispute_v3: Buffer.from([226, 175, 136, 76, 202, 96, 200, 102]),
  cast_arbitration_vote: Buffer.from([240, 213, 221, 193, 161, 207, 1, 252]),
  finalize_dispute_release: Buffer.from([34, 134, 74, 54, 225, 183, 18, 47]),
  finalize_dispute_reject: Buffer.from([171, 128, 196, 66, 131, 203, 114, 117]),
} as const;

export const CLAIM_V2_DISCRIMINATOR = Buffer.from([91, 3, 14, 101, 67, 160, 222, 63]);
export const CLAIM_V2_ACCOUNT_SIZE = 253;
export const REPUTATION_DISCRIMINATOR = Buffer.from([
  55, 148, 90, 71, 68, 183, 193, 28,
]);
export const RETURN_ATTESTATION_DISCRIMINATOR = Buffer.from([
  186, 34, 108, 39, 171, 28, 141, 60,
]);
export const ARBITRATION_PANEL_DISCRIMINATOR = Buffer.from([
  127, 28, 248, 19, 204, 212, 112, 66,
]);
export const DISPUTE_CASE_DISCRIMINATOR = Buffer.from([
  164, 200, 54, 239, 94, 76, 51, 130,
]);
export const ARBITRATION_VOTE_DISCRIMINATOR = Buffer.from([
  250, 100, 186, 28, 204, 26, 41, 91,
]);

