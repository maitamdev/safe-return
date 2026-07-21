//! Program events.
use anchor_lang::prelude::*;
use crate::state::BountyStatus;

#[event]
pub struct BountyCreated {
    pub bounty: Pubkey,
    pub owner: Pubkey,
    pub bounty_id: String,
    pub reward_amount: u64,
    pub deadline: i64,
}

#[event]
pub struct BountyFunded {
    pub bounty: Pubkey,
    pub amount: u64,
    pub total_funded: u64,
    pub status: BountyStatus,
}

#[event]
pub struct ClaimSubmitted {
    pub bounty: Pubkey,
    pub finder: Pubkey,
    pub evidence_hash: [u8; 32],
}

#[event]
pub struct ClaimV2Submitted {
    pub bounty: Pubkey,
    pub claim: Pubkey,
    pub finder: Pubkey,
    pub evidence_hash: [u8; 32],
}

#[event]
pub struct AiReviewRecorded {
    pub bounty: Pubkey,
    pub score: u8,
    pub risk_level: u8,
    pub decision: u8,
    pub explanation_hash: [u8; 32],
}

#[event]
pub struct ClaimV2AiReviewed {
    pub bounty: Pubkey,
    pub claim: Pubkey,
    pub score: u8,
    pub risk_level: u8,
    pub decision: u8,
    pub input_hash: [u8; 32],
    pub report_hash: [u8; 32],
    pub model_hash: [u8; 32],
}

#[event]
pub struct ClaimV2Rejected {
    pub bounty: Pubkey,
    pub claim: Pubkey,
}

#[event]
pub struct ClaimV2Disputed {
    pub bounty: Pubkey,
    pub claim: Pubkey,
    pub opened_by: Pubkey,
}

#[event]
pub struct ClaimV2Settled {
    pub bounty: Pubkey,
    pub claim: Pubkey,
    pub finder: Pubkey,
    pub amount: u64,
    pub via_arbitration: bool,
}

#[event]
pub struct SettlementAttested {
    pub attestation: Pubkey,
    pub bounty: Pubkey,
    pub claim: Pubkey,
    pub owner: Pubkey,
    pub finder: Pubkey,
    pub reward_amount: u64,
}

#[event]
pub struct ArbitrationPanelConfigured {
    pub bounty: Pubkey,
    pub panel: Pubkey,
    pub arbiters: [Pubkey; 3],
    pub quorum: u8,
}

#[event]
pub struct QuorumDisputeOpened {
    pub bounty: Pubkey,
    pub claim: Pubkey,
    pub dispute_case: Pubkey,
    pub opened_by: Pubkey,
}

#[event]
pub struct ArbitrationVoteCast {
    pub dispute_case: Pubkey,
    pub vote: Pubkey,
    pub arbiter: Pubkey,
    pub release_to_finder: bool,
    pub release_votes: u8,
    pub reject_votes: u8,
    pub decision: u8,
}

#[event]
pub struct QuorumDisputeFinalized {
    pub dispute_case: Pubkey,
    pub decision: u8,
}

#[event]
pub struct ClaimAccepted {
    pub bounty: Pubkey,
    pub finder: Pubkey,
    pub amount: u64,
}

#[event]
pub struct ClaimRejected {
    pub bounty: Pubkey,
}

#[event]
pub struct BountyRefunded {
    pub bounty: Pubkey,
    pub amount: u64,
}

#[event]
pub struct BountyCancelled {
    pub bounty: Pubkey,
}

#[event]
pub struct DisputeOpened {
    pub bounty: Pubkey,
}

#[event]
pub struct DisputeResolved {
    pub bounty: Pubkey,
    pub release_to_finder: bool,
}

