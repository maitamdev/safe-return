//! Shared instruction helpers (funding, claims, reputation, disputes).
use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::FbError;
use crate::events::*;
use crate::state::*;

#[allow(clippy::too_many_arguments)]
pub(crate) fn initialize_bounty(
    bounty: &mut Account<Bounty>,
    owner: Pubkey,
    arbiter: Pubkey,
    mint: Pubkey,
    bounty_id: String,
    reward_amount: u64,
    deadline: i64,
    metadata_hash: [u8; 32],
    bump: u8,
    vault_bump: u8,
    protocol_version: u8,
) -> Result<()> {
    require!(
        !bounty_id.is_empty() && bounty_id.len() <= MAX_ID_LEN,
        FbError::InvalidId
    );
    require!(reward_amount > 0, FbError::ZeroReward);
    require!(arbiter != Pubkey::default(), FbError::InvalidArbiter);
    require!(arbiter != owner, FbError::PartyCannotArbitrate);
    require!(
        matches!(protocol_version, 1 | 2),
        FbError::ProtocolVersionMismatch
    );
    // Protocol v2 is the content-addressed path. Do not allow a zero
    // commitment to make it on-chain: a zero hash cannot be verified against
    // any metadata payload and would silently bypass the integrity contract.
    // Legacy v1 accounts remain backwards-compatible and may still use the
    // historical zero value.
    require_metadata_hash(protocol_version, metadata_hash)?;
    let now = Clock::get()?.unix_timestamp;
    require!(deadline > now, FbError::InvalidDeadline);

    bounty.owner = owner;
    bounty.finder = Pubkey::default();
    bounty.arbiter = arbiter;
    bounty.mint = mint;
    bounty.bounty_id = bounty_id;
    bounty.reward_amount = reward_amount;
    bounty.amount_funded = 0;
    bounty.deadline = deadline;
    bounty.status = BountyStatus::Draft;
    bounty.metadata_hash = metadata_hash;
    bounty.evidence_hash = [0u8; 32];
    bounty.ai_score = 0;
    bounty.ai_risk = 0;
    bounty.ai_decision = 0;
    bounty.ai_explanation_hash = [0u8; 32];
    bounty.bump = bump;
    bounty.vault_bump = vault_bump;
    bounty.created_at = now;
    bounty.updated_at = now;
    bounty.protocol_version = protocol_version;
    bounty.arbitration_mode = 0;
    bounty.active_claims = 0;
    bounty.workflow_version = u8::from(protocol_version >= 2);

    emit!(BountyCreated {
        bounty: bounty.key(),
        owner,
        bounty_id: bounty.bounty_id.clone(),
        reward_amount,
        deadline,
    });
    Ok(())
}

pub(crate) fn validate_funding(
    bounty: &Account<Bounty>,
    owner: Pubkey,
    mint: Pubkey,
    amount: u64,
) -> Result<()> {
    require_keys_eq!(bounty.owner, owner, FbError::Unauthorized);
    require!(
        matches!(bounty.status, BountyStatus::Draft | BountyStatus::Funded),
        FbError::InvalidStatus
    );
    require!(amount > 0, FbError::ZeroReward);
    require_keys_eq!(bounty.mint, mint, FbError::InvalidMint);
    let remaining = remaining_funding(bounty.reward_amount, bounty.amount_funded)
        .ok_or(FbError::MathOverflow)?;
    require!(amount <= remaining, FbError::FundingExceedsReward);
    Ok(())
}

pub(crate) fn apply_funding(bounty: &mut Account<Bounty>, amount: u64) -> Result<()> {
    bounty.amount_funded = bounty
        .amount_funded
        .checked_add(amount)
        .ok_or(FbError::MathOverflow)?;
    if bounty.amount_funded >= bounty.reward_amount {
        bounty.status = BountyStatus::Funded;
    }
    bounty.updated_at = Clock::get()?.unix_timestamp;
    emit!(BountyFunded {
        bounty: bounty.key(),
        amount,
        total_funded: bounty.amount_funded,
        status: bounty.status,
    });
    Ok(())
}

pub(crate) fn initialize_claim_v2(
    bounty: &mut Account<Bounty>,
    claim: &mut Account<ClaimV2>,
    finder: Pubkey,
    evidence_hash: [u8; 32],
    bump: u8,
) -> Result<()> {
    require!(
        bounty.protocol_version >= 2,
        FbError::ProtocolVersionMismatch
    );
    require!(
        bounty.status == BountyStatus::Funded,
        FbError::InvalidStatus
    );
    require!(
        bounty.amount_funded >= bounty.reward_amount,
        FbError::NotFullyFunded
    );
    let now = Clock::get()?.unix_timestamp;
    require!(now <= bounty.deadline, FbError::PastDeadline);
    require!(finder != bounty.owner, FbError::OwnerCannotClaim);
    require!(evidence_hash != [0u8; 32], FbError::EmptyEvidence);

    claim.bounty = bounty.key();
    claim.finder = finder;
    claim.evidence_hash = evidence_hash;
    claim.ai_input_hash = [0u8; 32];
    claim.ai_report_hash = [0u8; 32];
    claim.ai_model_hash = [0u8; 32];
    claim.ai_score = 0;
    claim.ai_risk = 0;
    claim.ai_decision = 1;
    claim.status = ClaimV2Status::Submitted;
    claim.bump = bump;
    claim.created_at = now;
    claim.updated_at = now;
    claim.dispute_deadline = 0;
    claim.resolution_deadline = 0;
    claim.workflow_version = bounty.workflow_version;
    if bounty.workflow_version >= 1 {
        bounty.active_claims = bounty
            .active_claims
            .checked_add(1)
            .ok_or(FbError::MathOverflow)?;
        bounty.updated_at = now;
    }
    emit!(ClaimV2Submitted {
        bounty: bounty.key(),
        claim: claim.key(),
        finder,
        evidence_hash,
    });
    Ok(())
}

pub(crate) fn remaining_funding(reward_amount: u64, amount_funded: u64) -> Option<u64> {
    reward_amount.checked_sub(amount_funded)
}

pub(crate) fn decrement_active_claims(bounty: &mut Account<Bounty>, workflow_version: u8) -> Result<()> {
    if bounty.workflow_version >= 1 && workflow_version >= 1 {
        bounty.active_claims = bounty
            .active_claims
            .checked_sub(1)
            .ok_or(FbError::MathOverflow)?;
    }
    Ok(())
}

pub(crate) fn close_all_active_claims(bounty: &mut Account<Bounty>, workflow_version: u8) {
    if bounty.workflow_version >= 1 && workflow_version >= 1 {
        bounty.active_claims = 0;
    }
}

pub(crate) fn require_metadata_hash(protocol_version: u8, metadata_hash: [u8; 32]) -> Result<()> {
    if protocol_version >= 2 {
        require!(metadata_hash != [0u8; 32], FbError::EmptyEvidence);
    }
    Ok(())
}

pub(crate) fn lock_for_v2_dispute(status: BountyStatus) -> Option<BountyStatus> {
    (status == BountyStatus::Funded).then_some(BountyStatus::Disputed)
}

pub(crate) fn resume_after_v2_reject(status: BountyStatus) -> Option<BountyStatus> {
    (status == BountyStatus::Disputed).then_some(BountyStatus::Funded)
}

pub(crate) fn update_reputation(
    reputation: &mut Account<Reputation>,
    wallet: Pubkey,
    reward_amount: u64,
    earned: bool,
    now: i64,
    bump: u8,
) -> Result<()> {
    if reputation.wallet == Pubkey::default() {
        reputation.wallet = wallet;
        reputation.bump = bump;
    }
    require_keys_eq!(reputation.wallet, wallet, FbError::Unauthorized);
    reputation.successful_returns = reputation
        .successful_returns
        .checked_add(1)
        .ok_or(FbError::MathOverflow)?;
    if earned {
        reputation.rewards_earned = reputation
            .rewards_earned
            .checked_add(reward_amount)
            .ok_or(FbError::MathOverflow)?;
    } else {
        reputation.rewards_paid = reputation
            .rewards_paid
            .checked_add(reward_amount)
            .ok_or(FbError::MathOverflow)?;
    }
    reputation.last_activity = now;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        lock_for_v2_dispute, remaining_funding, require_metadata_hash,
        resume_after_v2_reject, BountyStatus, ClaimV2, ClaimV2Status,
    };
    use anchor_lang::AnchorSerialize;

    #[test]
    fn remaining_funding_handles_partial_and_complete_escrow() {
        assert_eq!(remaining_funding(100, 0), Some(100));
        assert_eq!(remaining_funding(100, 40), Some(60));
        assert_eq!(remaining_funding(100, 100), Some(0));
    }

    #[test]
    fn remaining_funding_rejects_corrupt_overfunded_state() {
        assert_eq!(remaining_funding(100, 101), None);
    }

    #[test]
    fn v2_dispute_locks_refund_and_resumes_only_after_rejection() {
        assert!(matches!(
            lock_for_v2_dispute(BountyStatus::Funded),
            Some(BountyStatus::Disputed)
        ));
        assert!(lock_for_v2_dispute(BountyStatus::Disputed).is_none());
        assert!(lock_for_v2_dispute(BountyStatus::Refunded).is_none());
        assert!(matches!(
            resume_after_v2_reject(BountyStatus::Disputed),
            Some(BountyStatus::Funded)
        ));
        assert!(resume_after_v2_reject(BountyStatus::Funded).is_none());
    }

    #[test]
    fn v2_requires_a_nonzero_metadata_commitment_but_v1_is_compatible() {
        assert!(require_metadata_hash(1, [0u8; 32]).is_ok());
        assert!(require_metadata_hash(2, [0u8; 32]).is_err());
        assert!(require_metadata_hash(2, [7u8; 32]).is_ok());
    }

    #[test]
    fn claim_v2_upgrade_preserves_account_size_and_existing_status_indices() {
        assert_eq!(ClaimV2::SPACE, 253);
        let statuses = [
            ClaimV2Status::Submitted,
            ClaimV2Status::AiReviewed,
            ClaimV2Status::Rejected,
            ClaimV2Status::Disputed,
            ClaimV2Status::Settled,
            ClaimV2Status::RejectionPending,
        ];
        for (expected, status) in statuses.into_iter().enumerate() {
            let bytes = status.try_to_vec().expect("status must serialize");
            assert_eq!(bytes, vec![expected as u8]);
        }
    }

    #[test]
    fn protocol_constants_match_documented_windows() {
        assert_eq!(super::REJECTION_DISPUTE_WINDOW_SECONDS, 2 * 24 * 60 * 60);
        assert_eq!(super::DISPUTE_RESOLUTION_WINDOW_SECONDS, 14 * 24 * 60 * 60);
        assert_eq!(super::MAX_ID_LEN, 32);
        assert_eq!(super::BOUNTY_SEED, b"bounty");
        assert_eq!(super::CLAIM_V2_SEED, b"claim_v2");
        assert_eq!(super::VAULT_SEED, b"vault");
    }

    #[test]
    fn remaining_funding_zero_reward_is_fully_funded() {
        assert_eq!(remaining_funding(0, 0), Some(0));
    }
}
