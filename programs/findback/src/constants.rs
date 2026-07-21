//! PDA seeds and protocol timing constants.

pub const BOUNTY_SEED: &[u8] = b"bounty";
pub const VAULT_SEED: &[u8] = b"vault";
pub const CLAIM_V2_SEED: &[u8] = b"claim_v2";
pub const REPUTATION_SEED: &[u8] = b"reputation";
pub const RETURN_ATTESTATION_SEED: &[u8] = b"return_attestation";
pub const ARBITRATION_PANEL_SEED: &[u8] = b"arbitration_panel";
pub const DISPUTE_CASE_SEED: &[u8] = b"dispute_case";
pub const ARBITRATION_VOTE_SEED: &[u8] = b"arbitration_vote";
pub const MAX_ID_LEN: usize = 32;
pub const REJECTION_DISPUTE_WINDOW_SECONDS: i64 = 2 * 24 * 60 * 60;
pub const DISPUTE_RESOLUTION_WINDOW_SECONDS: i64 = 14 * 24 * 60 * 60;
