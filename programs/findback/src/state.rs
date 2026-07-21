//! On-chain account layouts and status enums.
use anchor_lang::prelude::*;

use crate::constants::MAX_ID_LEN;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum BountyStatus {
    Draft,
    Funded,
    ClaimSubmitted,
    AiReviewed,
    Accepted,
    Released,
    Rejected,
    Disputed,
    Refunded,
    Expired,
    Cancelled,
}

impl Default for BountyStatus {
    fn default() -> Self {
        BountyStatus::Draft
    }
}

#[account]
pub struct Bounty {
    pub owner: Pubkey,
    pub finder: Pubkey,
    pub arbiter: Pubkey,
    pub mint: Pubkey,
    pub bounty_id: String,
    pub reward_amount: u64,
    pub amount_funded: u64,
    pub deadline: i64,
    pub status: BountyStatus,
    pub metadata_hash: [u8; 32],
    pub evidence_hash: [u8; 32],
    pub ai_score: u8,
    pub ai_risk: u8,
    pub ai_decision: u8,
    pub ai_explanation_hash: [u8; 32],
    pub bump: u8,
    pub vault_bump: u8,
    pub created_at: i64,
    pub updated_at: i64,
    /// 0/1 are legacy single-claim accounts; 2 uses finder-scoped ClaimV2 PDAs.
    /// Existing accounts have zeroed padding here, so upgrades remain readable.
    pub protocol_version: u8,
    /// 0 = legacy single arbiter, 1 = configured 2-of-3 panel.
    pub arbitration_mode: u8,
    /// Number of unresolved ClaimV2 accounts for workflow-enabled bounties.
    pub active_claims: u32,
    /// 0 = legacy behavior, 1 = rejection window + refund/liveness guards.
    pub workflow_version: u8,
}

impl Bounty {
    // 32*4 + 4+32 + 8*3 + 1 + 32*3 + 1*5 + 8*2 + padding
    pub const SPACE: usize = 8
        + 32 * 4
        + (4 + MAX_ID_LEN)
        + 8
        + 8
        + 8
        + 1
        + 32
        + 32
        + 1
        + 1
        + 1
        + 32
        + 1
        + 1
        + 8
        + 8
        + 64;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum ClaimV2Status {
    Submitted,
    AiReviewed,
    Rejected,
    Disputed,
    Settled,
    /// Owner requested rejection; finder may still escalate before deadline.
    RejectionPending,
}

impl Default for ClaimV2Status {
    fn default() -> Self {
        ClaimV2Status::Submitted
    }
}

#[account]
pub struct ClaimV2 {
    pub bounty: Pubkey,
    pub finder: Pubkey,
    pub evidence_hash: [u8; 32],
    pub ai_input_hash: [u8; 32],
    pub ai_report_hash: [u8; 32],
    pub ai_model_hash: [u8; 32],
    pub ai_score: u8,
    pub ai_risk: u8,
    pub ai_decision: u8,
    pub status: ClaimV2Status,
    pub bump: u8,
    pub created_at: i64,
    pub updated_at: i64,
    pub dispute_deadline: i64,
    pub resolution_deadline: i64,
    pub workflow_version: u8,
}

impl ClaimV2 {
    pub const SPACE: usize = 8 + 32 * 6 + 1 * 5 + 8 * 2 + 32;
}

#[account]
pub struct Reputation {
    pub wallet: Pubkey,
    pub successful_returns: u32,
    pub rewards_earned: u64,
    pub rewards_paid: u64,
    pub last_activity: i64,
    pub bump: u8,
}

impl Reputation {
    pub const SPACE: usize = 8 + 32 + 4 + 8 * 3 + 1 + 32;
}

#[account]
pub struct ReturnAttestation {
    pub bounty: Pubkey,
    pub claim: Pubkey,
    pub owner: Pubkey,
    pub finder: Pubkey,
    pub reward_amount: u64,
    pub ai_score: u8,
    pub settled_at: i64,
    pub bump: u8,
}

#[account]
pub struct ArbitrationPanel {
    pub bounty: Pubkey,
    pub arbiters: [Pubkey; 3],
    pub quorum: u8,
    pub bump: u8,
    pub created_at: i64,
}

impl ArbitrationPanel {
    pub const SPACE: usize = 8 + 32 + 32 * 3 + 1 + 1 + 8 + 32;
}

#[account]
pub struct DisputeCase {
    pub bounty: Pubkey,
    pub claim: Pubkey,
    pub panel: Pubkey,
    pub release_votes: u8,
    pub reject_votes: u8,
    /// 0 = open, 1 = release, 2 = reject.
    pub decision: u8,
    pub finalized: bool,
    pub bump: u8,
    pub created_at: i64,
    pub resolved_at: i64,
}

impl DisputeCase {
    pub const SPACE: usize = 8 + 32 * 3 + 1 * 5 + 8 * 2 + 32;
}

#[account]
pub struct ArbitrationVote {
    pub dispute_case: Pubkey,
    pub arbiter: Pubkey,
    pub release_to_finder: bool,
    pub bump: u8,
    pub voted_at: i64,
}

impl ArbitrationVote {
    pub const SPACE: usize = 8 + 32 * 2 + 1 + 1 + 8 + 16;
}

impl ReturnAttestation {
    pub const SPACE: usize = 8 + 32 * 4 + 8 + 1 + 8 + 1 + 32;
}

