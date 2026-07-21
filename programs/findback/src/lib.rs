//! FindBack AI — Solana bounty escrow
//!
//! DRAFT → FUNDED → CLAIM_SUBMITTED → AI_REVIEWED → ACCEPTED → RELEASED
//! FUNDED → (after deadline) → REFUNDED
//! CLAIM_* → DISPUTED → RELEASED | REFUNDED
//!
//! AI never moves funds. Only owner accept / arbiter resolve / expiry refund.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer};

pub mod contexts;
pub mod constants;
pub mod errors;
pub mod events;
pub mod helpers;
pub mod state;

pub use contexts::*;
pub use constants::*;
pub use errors::*;
pub use events::*;
pub use state::*;

declare_id!("3hLzzJDHvbuKFPKweKEJ3ZAQEijoLLejkvi9ZPmByWna");

#[program]
pub mod findback {
    use super::*;
    use crate::helpers::*;

    pub fn create_bounty(
        ctx: Context<CreateBounty>,
        bounty_id: String,
        reward_amount: u64,
        deadline: i64,
        metadata_hash: [u8; 32],
    ) -> Result<()> {
        initialize_bounty(
            &mut ctx.accounts.bounty,
            ctx.accounts.owner.key(),
            ctx.accounts.arbiter.key(),
            ctx.accounts.mint.key(),
            bounty_id,
            reward_amount,
            deadline,
            metadata_hash,
            ctx.bumps.bounty,
            ctx.bumps.vault_authority,
            1,
        )
    }

    /// Creates a multi-claim bounty while keeping the original instruction
    /// backward compatible with protocol-v1 clients already in production.
    pub fn create_bounty_v2(
        ctx: Context<CreateBounty>,
        bounty_id: String,
        reward_amount: u64,
        deadline: i64,
        metadata_hash: [u8; 32],
    ) -> Result<()> {
        initialize_bounty(
            &mut ctx.accounts.bounty,
            ctx.accounts.owner.key(),
            ctx.accounts.arbiter.key(),
            ctx.accounts.mint.key(),
            bounty_id,
            reward_amount,
            deadline,
            metadata_hash,
            ctx.bumps.bounty,
            ctx.bumps.vault_authority,
            2,
        )
    }

    /// Gasless onboarding variant. The owner still authorizes the bounty while a restricted
    /// application sponsor pays only the account rent and transaction fee.
    pub fn create_bounty_sponsored(
        ctx: Context<CreateBountySponsored>,
        bounty_id: String,
        reward_amount: u64,
        deadline: i64,
        metadata_hash: [u8; 32],
    ) -> Result<()> {
        initialize_bounty(
            &mut ctx.accounts.bounty,
            ctx.accounts.owner.key(),
            ctx.accounts.arbiter.key(),
            ctx.accounts.mint.key(),
            bounty_id,
            reward_amount,
            deadline,
            metadata_hash,
            ctx.bumps.bounty,
            ctx.bumps.vault_authority,
            2,
        )
    }

    pub fn fund_bounty(ctx: Context<FundBounty>, amount: u64) -> Result<()> {
        let b = &mut ctx.accounts.bounty;
        require_keys_eq!(b.owner, ctx.accounts.owner.key(), FbError::Unauthorized);
        require!(
            matches!(b.status, BountyStatus::Draft | BountyStatus::Funded),
            FbError::InvalidStatus
        );
        require!(amount > 0, FbError::ZeroReward);
        require_keys_eq!(b.mint, ctx.accounts.mint.key(), FbError::InvalidMint);
        let remaining =
            remaining_funding(b.reward_amount, b.amount_funded).ok_or(FbError::MathOverflow)?;
        require!(amount <= remaining, FbError::FundingExceedsReward);

        let cpi = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.owner_token.to_account_info(),
                to: ctx.accounts.vault_token.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
        );
        token::transfer(cpi, amount)?;

        apply_funding(b, amount)
    }

    pub fn fund_bounty_sponsored(ctx: Context<FundBountySponsored>, amount: u64) -> Result<()> {
        let b = &mut ctx.accounts.bounty;
        validate_funding(b, ctx.accounts.owner.key(), ctx.accounts.mint.key(), amount)?;
        let cpi = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.owner_token.to_account_info(),
                to: ctx.accounts.vault_token.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
        );
        token::transfer(cpi, amount)?;
        apply_funding(b, amount)
    }

    pub fn submit_claim(ctx: Context<SubmitClaim>, evidence_hash: [u8; 32]) -> Result<()> {
        let b = &mut ctx.accounts.bounty;
        require!(b.protocol_version < 2, FbError::LegacyInstructionDisabled);
        require!(b.status == BountyStatus::Funded, FbError::InvalidStatus);
        require!(b.amount_funded >= b.reward_amount, FbError::NotFullyFunded);
        let now = Clock::get()?.unix_timestamp;
        require!(now <= b.deadline, FbError::PastDeadline);
        require!(
            ctx.accounts.finder.key() != b.owner,
            FbError::OwnerCannotClaim
        );
        require!(evidence_hash != [0u8; 32], FbError::EmptyEvidence);

        b.finder = ctx.accounts.finder.key();
        b.evidence_hash = evidence_hash;
        b.status = BountyStatus::ClaimSubmitted;
        b.updated_at = now;

        emit!(ClaimSubmitted {
            bounty: b.key(),
            finder: b.finder,
            evidence_hash,
        });
        Ok(())
    }

    /// Creates a finder-scoped claim without locking the bounty to one finder.
    /// Existing v1 bounty accounts remain readable and settle through their
    /// original instructions; all new multi-claim clients use this instruction.
    pub fn submit_claim_v2(ctx: Context<SubmitClaimV2>, evidence_hash: [u8; 32]) -> Result<()> {
        initialize_claim_v2(
            &mut ctx.accounts.bounty,
            &mut ctx.accounts.claim,
            ctx.accounts.finder.key(),
            evidence_hash,
            ctx.bumps.claim,
        )
    }

    pub fn submit_claim_v2_sponsored(
        ctx: Context<SubmitClaimV2Sponsored>,
        evidence_hash: [u8; 32],
    ) -> Result<()> {
        initialize_claim_v2(
            &mut ctx.accounts.bounty,
            &mut ctx.accounts.claim,
            ctx.accounts.finder.key(),
            evidence_hash,
            ctx.bumps.claim,
        )
    }

    /// Records off-chain AI result (hash + score). Does NOT move tokens.
    pub fn record_ai_review(
        ctx: Context<RecordAiReview>,
        score: u8,
        risk_level: u8,
        decision: u8,
        explanation_hash: [u8; 32],
    ) -> Result<()> {
        require!(score <= 100, FbError::InvalidScore);
        require!(risk_level <= 2, FbError::InvalidScore); // 0 low 1 med 2 high
        require!(decision <= 2, FbError::InvalidScore); // 0 ACCEPT 1 REVIEW 2 REJECT

        let b = &mut ctx.accounts.bounty;
        require!(b.protocol_version < 2, FbError::LegacyInstructionDisabled);
        require!(
            matches!(
                b.status,
                BountyStatus::ClaimSubmitted | BountyStatus::AiReviewed
            ),
            FbError::InvalidStatus
        );

        b.ai_score = score;
        b.ai_risk = risk_level;
        b.ai_decision = decision;
        b.ai_explanation_hash = explanation_hash;
        b.status = BountyStatus::AiReviewed;
        b.updated_at = Clock::get()?.unix_timestamp;

        emit!(AiReviewRecorded {
            bounty: b.key(),
            score,
            risk_level,
            decision,
            explanation_hash,
        });
        Ok(())
    }

    pub fn record_ai_review_v2(
        ctx: Context<RecordAiReviewV2>,
        score: u8,
        risk_level: u8,
        decision: u8,
        input_hash: [u8; 32],
        report_hash: [u8; 32],
        model_hash: [u8; 32],
    ) -> Result<()> {
        require!(
            ctx.accounts.bounty.protocol_version >= 2,
            FbError::ProtocolVersionMismatch
        );
        // Reviews belong to an active escrow window. A refunded/released
        // bounty must not accept new AI provenance records for stale claims.
        require!(
            ctx.accounts.bounty.status == BountyStatus::Funded,
            FbError::InvalidStatus
        );
        require!(score <= 100, FbError::InvalidScore);
        require!(risk_level <= 2, FbError::InvalidScore);
        require!(decision <= 2, FbError::InvalidScore);
        require!(input_hash != [0u8; 32], FbError::EmptyEvidence);
        require!(report_hash != [0u8; 32], FbError::EmptyEvidence);
        require!(model_hash != [0u8; 32], FbError::EmptyEvidence);

        let claim = &mut ctx.accounts.claim;
        require!(
            matches!(
                claim.status,
                ClaimV2Status::Submitted | ClaimV2Status::AiReviewed
            ),
            FbError::InvalidClaimStatus
        );
        claim.ai_score = score;
        claim.ai_risk = risk_level;
        claim.ai_decision = decision;
        claim.ai_input_hash = input_hash;
        claim.ai_report_hash = report_hash;
        claim.ai_model_hash = model_hash;
        claim.status = ClaimV2Status::AiReviewed;
        claim.updated_at = Clock::get()?.unix_timestamp;

        emit!(ClaimV2AiReviewed {
            bounty: ctx.accounts.bounty.key(),
            claim: claim.key(),
            score,
            risk_level,
            decision,
            input_hash,
            report_hash,
            model_hash,
        });
        Ok(())
    }

    pub fn accept_claim(ctx: Context<AcceptClaim>) -> Result<()> {
        let bounty_key = ctx.accounts.bounty.key();
        let b = &mut ctx.accounts.bounty;
        require!(b.protocol_version < 2, FbError::LegacyInstructionDisabled);
        require_keys_eq!(b.owner, ctx.accounts.owner.key(), FbError::Unauthorized);
        require!(
            matches!(
                b.status,
                BountyStatus::AiReviewed | BountyStatus::ClaimSubmitted
            ),
            FbError::InvalidStatus
        );
        require!(b.finder != Pubkey::default(), FbError::NoFinder);
        require_keys_eq!(b.finder, ctx.accounts.finder.key(), FbError::FinderMismatch);
        require!(b.amount_funded >= b.reward_amount, FbError::NotFullyFunded);

        let amount = b.reward_amount;
        let id_bytes = b.bounty_id.as_bytes();
        let seeds: &[&[u8]] = &[VAULT_SEED, id_bytes, &[b.vault_bump]];
        let signer = &[seeds];

        let cpi = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_token.to_account_info(),
                to: ctx.accounts.finder_token.to_account_info(),
                authority: ctx.accounts.vault_authority.to_account_info(),
            },
            signer,
        );
        token::transfer(cpi, amount)?;

        b.amount_funded = b
            .amount_funded
            .checked_sub(amount)
            .ok_or(FbError::MathOverflow)?;
        b.status = BountyStatus::Released;
        b.updated_at = Clock::get()?.unix_timestamp;

        emit!(ClaimAccepted {
            bounty: bounty_key,
            finder: b.finder,
            amount,
        });
        Ok(())
    }

    pub fn reject_claim(ctx: Context<RejectClaim>) -> Result<()> {
        let b = &mut ctx.accounts.bounty;
        require!(b.protocol_version < 2, FbError::LegacyInstructionDisabled);
        require_keys_eq!(b.owner, ctx.accounts.owner.key(), FbError::Unauthorized);
        require!(
            matches!(
                b.status,
                BountyStatus::ClaimSubmitted | BountyStatus::AiReviewed
            ),
            FbError::InvalidStatus
        );

        b.finder = Pubkey::default();
        b.evidence_hash = [0u8; 32];
        b.ai_score = 0;
        b.ai_risk = 0;
        b.ai_decision = 0;
        b.ai_explanation_hash = [0u8; 32];
        b.status = BountyStatus::Funded; // open for new claims
        b.updated_at = Clock::get()?.unix_timestamp;

        emit!(ClaimRejected { bounty: b.key() });
        Ok(())
    }

    pub fn reject_claim_v2(ctx: Context<RejectClaimV2>) -> Result<()> {
        require!(
            ctx.accounts.bounty.protocol_version >= 2,
            FbError::ProtocolVersionMismatch
        );
        let claim = &mut ctx.accounts.claim;
        require!(
            matches!(
                claim.status,
                ClaimV2Status::Submitted | ClaimV2Status::AiReviewed
            ),
            FbError::InvalidClaimStatus
        );
        let now = Clock::get()?.unix_timestamp;
        if claim.workflow_version >= 1 {
            claim.status = ClaimV2Status::RejectionPending;
            claim.dispute_deadline = now
                .checked_add(REJECTION_DISPUTE_WINDOW_SECONDS)
                .ok_or(FbError::MathOverflow)?;
        } else {
            claim.status = ClaimV2Status::Rejected;
            emit!(ClaimV2Rejected {
                bounty: ctx.accounts.bounty.key(),
                claim: claim.key(),
            });
        }
        claim.updated_at = now;
        Ok(())
    }

    /// Finalizes an owner rejection only after the finder had a deterministic
    /// on-chain window in which to open a dispute. Any signer may finalize so
    /// a missing owner cannot leave the claim pending forever.
    pub fn finalize_rejection_v2(ctx: Context<FinalizeClaimV2>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let bounty = &mut ctx.accounts.bounty;
        let claim = &mut ctx.accounts.claim;
        require!(
            claim.status == ClaimV2Status::RejectionPending,
            FbError::InvalidClaimStatus
        );
        require!(
            claim.dispute_deadline > 0 && now > claim.dispute_deadline,
            FbError::DisputeWindowOpen
        );
        claim.status = ClaimV2Status::Rejected;
        claim.updated_at = now;
        decrement_active_claims(bounty, claim.workflow_version)?;
        emit!(ClaimV2Rejected {
            bounty: bounty.key(),
            claim: claim.key(),
        });
        Ok(())
    }

    /// Liveness fallback for an abandoned arbitration. The timeout rejects the
    /// claim and re-opens the bounty; it never transfers escrow to an arbitrary
    /// caller. Any signer may execute the deterministic outcome.
    pub fn timeout_dispute_v2(ctx: Context<FinalizeClaimV2>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let bounty = &mut ctx.accounts.bounty;
        let claim = &mut ctx.accounts.claim;
        require!(claim.status == ClaimV2Status::Disputed, FbError::InvalidClaimStatus);
        require!(
            claim.resolution_deadline > 0 && now > claim.resolution_deadline,
            FbError::ResolutionWindowOpen
        );
        require!(bounty.status == BountyStatus::Disputed, FbError::InvalidStatus);
        claim.status = ClaimV2Status::Rejected;
        claim.updated_at = now;
        bounty.status = resume_after_v2_reject(bounty.status).ok_or(FbError::InvalidStatus)?;
        bounty.updated_at = now;
        decrement_active_claims(bounty, claim.workflow_version)?;
        emit!(ClaimV2Rejected {
            bounty: bounty.key(),
            claim: claim.key(),
        });
        Ok(())
    }

    pub fn accept_claim_v2(ctx: Context<AcceptClaimV2>) -> Result<()> {
        let bounty_key = ctx.accounts.bounty.key();
        let claim_key = ctx.accounts.claim.key();
        let b = &mut ctx.accounts.bounty;
        let claim = &mut ctx.accounts.claim;
        require!(b.protocol_version >= 2, FbError::ProtocolVersionMismatch);
        require!(b.status == BountyStatus::Funded, FbError::InvalidStatus);
        require!(
            matches!(
                claim.status,
                ClaimV2Status::Submitted | ClaimV2Status::AiReviewed
            ),
            FbError::InvalidClaimStatus
        );
        require_keys_eq!(
            claim.finder,
            ctx.accounts.finder.key(),
            FbError::FinderMismatch
        );
        require!(b.amount_funded >= b.reward_amount, FbError::NotFullyFunded);

        let amount = b.reward_amount;
        let id_bytes = b.bounty_id.as_bytes();
        let seeds: &[&[u8]] = &[VAULT_SEED, id_bytes, &[b.vault_bump]];
        let signer = &[seeds];
        let cpi = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_token.to_account_info(),
                to: ctx.accounts.finder_token.to_account_info(),
                authority: ctx.accounts.vault_authority.to_account_info(),
            },
            signer,
        );
        token::transfer(cpi, amount)?;

        b.amount_funded = b
            .amount_funded
            .checked_sub(amount)
            .ok_or(FbError::MathOverflow)?;
        b.finder = claim.finder;
        b.evidence_hash = claim.evidence_hash;
        b.ai_score = claim.ai_score;
        b.ai_risk = claim.ai_risk;
        b.ai_decision = claim.ai_decision;
        b.ai_explanation_hash = claim.ai_report_hash;
        b.status = BountyStatus::Released;
        let now = Clock::get()?.unix_timestamp;
        b.updated_at = now;
        claim.status = ClaimV2Status::Settled;
        claim.updated_at = now;
        close_all_active_claims(b, claim.workflow_version);

        emit!(ClaimV2Settled {
            bounty: bounty_key,
            claim: claim_key,
            finder: claim.finder,
            amount,
            via_arbitration: false,
        });
        Ok(())
    }

    pub fn refund_after_expiry(ctx: Context<RefundAfterExpiry>) -> Result<()> {
        let bounty_key = ctx.accounts.bounty.key();
        let b = &mut ctx.accounts.bounty;
        require_keys_eq!(b.owner, ctx.accounts.owner.key(), FbError::Unauthorized);
        require!(
            matches!(
                b.status,
                BountyStatus::Funded
                    | BountyStatus::ClaimSubmitted
                    | BountyStatus::AiReviewed
                    | BountyStatus::Rejected
            ),
            FbError::InvalidStatus
        );
        let now = Clock::get()?.unix_timestamp;
        require!(now > b.deadline, FbError::NotExpired);
        require!(b.amount_funded > 0, FbError::NothingToRefund);
        require!(
            b.workflow_version == 0 || b.active_claims == 0,
            FbError::ActiveClaimsRemain
        );

        let amount = b.amount_funded;
        let id_bytes = b.bounty_id.as_bytes();
        let seeds: &[&[u8]] = &[VAULT_SEED, id_bytes, &[b.vault_bump]];
        let signer = &[seeds];

        let cpi = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_token.to_account_info(),
                to: ctx.accounts.owner_token.to_account_info(),
                authority: ctx.accounts.vault_authority.to_account_info(),
            },
            signer,
        );
        token::transfer(cpi, amount)?;

        b.amount_funded = 0;
        b.status = BountyStatus::Refunded;
        b.updated_at = now;

        emit!(BountyRefunded {
            bounty: bounty_key,
            amount,
        });
        Ok(())
    }

    pub fn cancel_bounty(ctx: Context<CancelBounty>) -> Result<()> {
        let b = &mut ctx.accounts.bounty;
        require_keys_eq!(b.owner, ctx.accounts.owner.key(), FbError::Unauthorized);
        require!(b.status == BountyStatus::Draft, FbError::InvalidStatus);
        require!(b.amount_funded == 0, FbError::InvalidStatus);
        b.status = BountyStatus::Cancelled;
        b.updated_at = Clock::get()?.unix_timestamp;
        emit!(BountyCancelled { bounty: b.key() });
        Ok(())
    }

    pub fn open_dispute(ctx: Context<OpenDispute>) -> Result<()> {
        let b = &mut ctx.accounts.bounty;
        require!(b.protocol_version < 2, FbError::LegacyInstructionDisabled);
        require!(
            ctx.accounts.signer.key() == b.owner || ctx.accounts.signer.key() == b.finder,
            FbError::Unauthorized
        );
        require!(
            matches!(
                b.status,
                BountyStatus::ClaimSubmitted | BountyStatus::AiReviewed
            ),
            FbError::InvalidStatus
        );
        b.status = BountyStatus::Disputed;
        b.updated_at = Clock::get()?.unix_timestamp;
        emit!(DisputeOpened { bounty: b.key() });
        Ok(())
    }

    pub fn open_dispute_v2(ctx: Context<OpenDisputeV2>) -> Result<()> {
        require!(
            ctx.accounts.bounty.protocol_version >= 2,
            FbError::ProtocolVersionMismatch
        );
        require!(
            ctx.accounts.bounty.arbitration_mode == 0,
            FbError::QuorumArbitrationRequired
        );
        let locked_status =
            lock_for_v2_dispute(ctx.accounts.bounty.status).ok_or(FbError::InvalidStatus)?;
        let claim = &mut ctx.accounts.claim;
        let signer = ctx.accounts.signer.key();
        let rejection_pending = claim.status == ClaimV2Status::RejectionPending;
        let now = Clock::get()?.unix_timestamp;
        require!(
            if rejection_pending {
                signer == claim.finder
            } else {
                signer == ctx.accounts.bounty.owner || signer == claim.finder
            },
            FbError::Unauthorized
        );
        require!(
            matches!(
                claim.status,
                ClaimV2Status::Submitted
                    | ClaimV2Status::AiReviewed
                    | ClaimV2Status::RejectionPending
            ),
            FbError::InvalidClaimStatus
        );
        if rejection_pending {
            require!(
                claim.dispute_deadline > 0 && now <= claim.dispute_deadline,
                FbError::DisputeWindowClosed
            );
        }
        claim.status = ClaimV2Status::Disputed;
        claim.updated_at = now;
        claim.dispute_deadline = 0;
        claim.resolution_deadline = now
            .checked_add(DISPUTE_RESOLUTION_WINDOW_SECONDS)
            .ok_or(FbError::MathOverflow)?;
        ctx.accounts.bounty.status = locked_status;
        ctx.accounts.bounty.updated_at = now;
        emit!(ClaimV2Disputed {
            bounty: ctx.accounts.bounty.key(),
            claim: claim.key(),
            opened_by: ctx.accounts.signer.key(),
        });
        Ok(())
    }

    pub fn resolve_dispute(ctx: Context<ResolveDispute>, release_to_finder: bool) -> Result<()> {
        let bounty_key = ctx.accounts.bounty.key();
        let b = &mut ctx.accounts.bounty;
        require!(b.protocol_version < 2, FbError::LegacyInstructionDisabled);
        require_keys_eq!(b.arbiter, ctx.accounts.arbiter.key(), FbError::Unauthorized);
        require_keys_neq!(
            b.finder,
            ctx.accounts.arbiter.key(),
            FbError::PartyCannotArbitrate
        );
        require!(b.status == BountyStatus::Disputed, FbError::InvalidStatus);
        require!(b.amount_funded > 0, FbError::NothingToRefund);

        let amount = b.reward_amount.min(b.amount_funded);
        let id_bytes = b.bounty_id.as_bytes();
        let seeds: &[&[u8]] = &[VAULT_SEED, id_bytes, &[b.vault_bump]];
        let signer = &[seeds];

        if release_to_finder {
            require!(b.finder != Pubkey::default(), FbError::NoFinder);
            require_keys_eq!(
                b.finder,
                ctx.accounts.counterparty.key(),
                FbError::FinderMismatch
            );
            let cpi = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_token.to_account_info(),
                    to: ctx.accounts.counterparty_token.to_account_info(),
                    authority: ctx.accounts.vault_authority.to_account_info(),
                },
                signer,
            );
            token::transfer(cpi, amount)?;
            b.status = BountyStatus::Released;
        } else {
            require_keys_eq!(
                b.owner,
                ctx.accounts.counterparty.key(),
                FbError::Unauthorized
            );
            let cpi = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_token.to_account_info(),
                    to: ctx.accounts.counterparty_token.to_account_info(),
                    authority: ctx.accounts.vault_authority.to_account_info(),
                },
                signer,
            );
            token::transfer(cpi, b.amount_funded)?;
            b.status = BountyStatus::Refunded;
        }

        b.amount_funded = 0;
        b.updated_at = Clock::get()?.unix_timestamp;

        emit!(DisputeResolved {
            bounty: bounty_key,
            release_to_finder,
        });
        Ok(())
    }

    pub fn resolve_dispute_v2(
        ctx: Context<ResolveDisputeV2>,
        release_to_finder: bool,
    ) -> Result<()> {
        let bounty_key = ctx.accounts.bounty.key();
        let claim_key = ctx.accounts.claim.key();
        let b = &mut ctx.accounts.bounty;
        let claim = &mut ctx.accounts.claim;
        require!(b.protocol_version >= 2, FbError::ProtocolVersionMismatch);
        require!(b.arbitration_mode == 0, FbError::QuorumArbitrationRequired);
        require_keys_neq!(
            claim.finder,
            ctx.accounts.arbiter.key(),
            FbError::PartyCannotArbitrate
        );
        require!(
            claim.status == ClaimV2Status::Disputed,
            FbError::InvalidClaimStatus
        );
        require_keys_eq!(
            claim.finder,
            ctx.accounts.finder.key(),
            FbError::FinderMismatch
        );
        let now = Clock::get()?.unix_timestamp;

        if release_to_finder {
            require!(b.status == BountyStatus::Disputed, FbError::InvalidStatus);
            require!(b.amount_funded >= b.reward_amount, FbError::NotFullyFunded);
            let amount = b.reward_amount;
            let id_bytes = b.bounty_id.as_bytes();
            let seeds: &[&[u8]] = &[VAULT_SEED, id_bytes, &[b.vault_bump]];
            let signer = &[seeds];
            let cpi = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_token.to_account_info(),
                    to: ctx.accounts.finder_token.to_account_info(),
                    authority: ctx.accounts.vault_authority.to_account_info(),
                },
                signer,
            );
            token::transfer(cpi, amount)?;
            b.amount_funded = b
                .amount_funded
                .checked_sub(amount)
                .ok_or(FbError::MathOverflow)?;
            b.finder = claim.finder;
            b.evidence_hash = claim.evidence_hash;
            b.ai_score = claim.ai_score;
            b.ai_risk = claim.ai_risk;
            b.ai_decision = claim.ai_decision;
            b.ai_explanation_hash = claim.ai_report_hash;
            b.status = BountyStatus::Released;
            b.updated_at = now;
            claim.status = ClaimV2Status::Settled;
            close_all_active_claims(b, claim.workflow_version);

            emit!(ClaimV2Settled {
                bounty: bounty_key,
                claim: claim_key,
                finder: claim.finder,
                amount,
                via_arbitration: true,
            });
        } else {
            // Other claims stay valid and the bounty remains funded.
            claim.status = ClaimV2Status::Rejected;
            b.status = resume_after_v2_reject(b.status).ok_or(FbError::InvalidStatus)?;
            b.updated_at = now;
            decrement_active_claims(b, claim.workflow_version)?;
            emit!(ClaimV2Rejected {
                bounty: bounty_key,
                claim: claim_key,
            });
        }
        claim.updated_at = now;
        Ok(())
    }

    pub fn configure_arbitration_panel(
        ctx: Context<ConfigureArbitrationPanel>,
        arbiters: [Pubkey; 3],
        quorum: u8,
    ) -> Result<()> {
        require!(quorum == 2, FbError::InvalidQuorum);
        require!(
            arbiters.iter().all(|arbiter| *arbiter != Pubkey::default()),
            FbError::InvalidArbiter
        );
        require!(
            arbiters[0] != arbiters[1] && arbiters[0] != arbiters[2] && arbiters[1] != arbiters[2],
            FbError::DuplicateArbiter
        );
        require!(
            arbiters
                .iter()
                .all(|arbiter| *arbiter != ctx.accounts.owner.key()),
            FbError::PartyCannotArbitrate
        );
        require!(
            arbiters.contains(&ctx.accounts.bounty.arbiter),
            FbError::LeadArbiterRequired
        );
        require!(
            ctx.accounts.bounty.protocol_version >= 2,
            FbError::ProtocolVersionMismatch
        );
        require!(
            matches!(
                ctx.accounts.bounty.status,
                BountyStatus::Draft | BountyStatus::Funded
            ),
            FbError::InvalidStatus
        );

        let panel = &mut ctx.accounts.panel;
        panel.bounty = ctx.accounts.bounty.key();
        panel.arbiters = arbiters;
        panel.quorum = quorum;
        panel.bump = ctx.bumps.panel;
        panel.created_at = Clock::get()?.unix_timestamp;
        ctx.accounts.bounty.arbitration_mode = 1;
        ctx.accounts.bounty.updated_at = panel.created_at;
        emit!(ArbitrationPanelConfigured {
            bounty: panel.bounty,
            panel: panel.key(),
            arbiters,
            quorum,
        });
        Ok(())
    }

    pub fn open_dispute_v3(ctx: Context<OpenDisputeV3>) -> Result<()> {
        let bounty = &mut ctx.accounts.bounty;
        let claim = &mut ctx.accounts.claim;
        require!(
            bounty.protocol_version >= 2,
            FbError::ProtocolVersionMismatch
        );
        require!(
            bounty.arbitration_mode == 1,
            FbError::QuorumArbitrationRequired
        );
        let locked_status = lock_for_v2_dispute(bounty.status).ok_or(FbError::InvalidStatus)?;
        let signer = ctx.accounts.signer.key();
        let rejection_pending = claim.status == ClaimV2Status::RejectionPending;
        let now = Clock::get()?.unix_timestamp;
        require!(
            if rejection_pending {
                signer == claim.finder
            } else {
                signer == bounty.owner || signer == claim.finder
            },
            FbError::Unauthorized
        );
        require!(
            matches!(
                claim.status,
                ClaimV2Status::Submitted
                    | ClaimV2Status::AiReviewed
                    | ClaimV2Status::RejectionPending
            ),
            FbError::InvalidClaimStatus
        );
        if rejection_pending {
            require!(
                claim.dispute_deadline > 0 && now <= claim.dispute_deadline,
                FbError::DisputeWindowClosed
            );
        }
        claim.status = ClaimV2Status::Disputed;
        claim.updated_at = now;
        claim.dispute_deadline = 0;
        claim.resolution_deadline = now
            .checked_add(DISPUTE_RESOLUTION_WINDOW_SECONDS)
            .ok_or(FbError::MathOverflow)?;
        bounty.status = locked_status;
        bounty.updated_at = now;
        let case = &mut ctx.accounts.dispute_case;
        case.bounty = bounty.key();
        case.claim = claim.key();
        case.panel = ctx.accounts.panel.key();
        case.release_votes = 0;
        case.reject_votes = 0;
        case.decision = 0;
        case.finalized = false;
        case.bump = ctx.bumps.dispute_case;
        case.created_at = now;
        case.resolved_at = 0;
        emit!(QuorumDisputeOpened {
            bounty: bounty.key(),
            claim: claim.key(),
            dispute_case: case.key(),
            opened_by: ctx.accounts.signer.key(),
        });
        Ok(())
    }

    pub fn cast_arbitration_vote(
        ctx: Context<CastArbitrationVote>,
        release_to_finder: bool,
    ) -> Result<()> {
        let panel = &ctx.accounts.panel;
        require!(
            panel.arbiters.contains(&ctx.accounts.arbiter.key()),
            FbError::Unauthorized
        );
        require_keys_neq!(
            ctx.accounts.claim.finder,
            ctx.accounts.arbiter.key(),
            FbError::PartyCannotArbitrate
        );
        let case = &mut ctx.accounts.dispute_case;
        require!(
            case.decision == 0 && !case.finalized,
            FbError::CaseAlreadyResolved
        );
        require!(
            ctx.accounts.claim.status == ClaimV2Status::Disputed,
            FbError::InvalidClaimStatus
        );
        let now = Clock::get()?.unix_timestamp;
        require!(
            ctx.accounts.claim.resolution_deadline == 0
                || now <= ctx.accounts.claim.resolution_deadline,
            FbError::ResolutionWindowClosed
        );
        if release_to_finder {
            case.release_votes = case
                .release_votes
                .checked_add(1)
                .ok_or(FbError::MathOverflow)?;
        } else {
            case.reject_votes = case
                .reject_votes
                .checked_add(1)
                .ok_or(FbError::MathOverflow)?;
        }
        if case.release_votes >= panel.quorum {
            case.decision = 1;
            case.resolved_at = Clock::get()?.unix_timestamp;
        } else if case.reject_votes >= panel.quorum {
            case.decision = 2;
            case.resolved_at = Clock::get()?.unix_timestamp;
        }

        let vote = &mut ctx.accounts.vote;
        vote.dispute_case = case.key();
        vote.arbiter = ctx.accounts.arbiter.key();
        vote.release_to_finder = release_to_finder;
        vote.bump = ctx.bumps.vote;
        vote.voted_at = now;
        emit!(ArbitrationVoteCast {
            dispute_case: case.key(),
            vote: vote.key(),
            arbiter: vote.arbiter,
            release_to_finder,
            release_votes: case.release_votes,
            reject_votes: case.reject_votes,
            decision: case.decision,
        });
        Ok(())
    }

    pub fn finalize_dispute_release(ctx: Context<FinalizeDisputeRelease>) -> Result<()> {
        let bounty_key = ctx.accounts.bounty.key();
        let claim_key = ctx.accounts.claim.key();
        let case = &mut ctx.accounts.dispute_case;
        require!(
            case.decision == 1 && !case.finalized,
            FbError::QuorumNotReached
        );
        let bounty = &mut ctx.accounts.bounty;
        let claim = &mut ctx.accounts.claim;
        require!(
            bounty.status == BountyStatus::Disputed,
            FbError::InvalidStatus
        );
        require!(
            claim.status == ClaimV2Status::Disputed,
            FbError::InvalidClaimStatus
        );
        require_keys_eq!(
            claim.finder,
            ctx.accounts.finder.key(),
            FbError::FinderMismatch
        );
        require!(
            bounty.amount_funded >= bounty.reward_amount,
            FbError::NotFullyFunded
        );

        let amount = bounty.reward_amount;
        let id_bytes = bounty.bounty_id.as_bytes();
        let seeds: &[&[u8]] = &[VAULT_SEED, id_bytes, &[bounty.vault_bump]];
        let signer = &[seeds];
        let cpi = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_token.to_account_info(),
                to: ctx.accounts.finder_token.to_account_info(),
                authority: ctx.accounts.vault_authority.to_account_info(),
            },
            signer,
        );
        token::transfer(cpi, amount)?;
        bounty.amount_funded = bounty
            .amount_funded
            .checked_sub(amount)
            .ok_or(FbError::MathOverflow)?;
        bounty.finder = claim.finder;
        bounty.evidence_hash = claim.evidence_hash;
        bounty.ai_score = claim.ai_score;
        bounty.ai_risk = claim.ai_risk;
        bounty.ai_decision = claim.ai_decision;
        bounty.ai_explanation_hash = claim.ai_report_hash;
        bounty.status = BountyStatus::Released;
        let now = Clock::get()?.unix_timestamp;
        bounty.updated_at = now;
        claim.status = ClaimV2Status::Settled;
        claim.updated_at = now;
        close_all_active_claims(bounty, claim.workflow_version);
        case.finalized = true;
        emit!(ClaimV2Settled {
            bounty: bounty_key,
            claim: claim_key,
            finder: claim.finder,
            amount,
            via_arbitration: true,
        });
        emit!(QuorumDisputeFinalized {
            dispute_case: case.key(),
            decision: 1,
        });
        Ok(())
    }

    pub fn finalize_dispute_reject(ctx: Context<FinalizeDisputeReject>) -> Result<()> {
        let case = &mut ctx.accounts.dispute_case;
        require!(
            case.decision == 2 && !case.finalized,
            FbError::QuorumNotReached
        );
        require!(
            ctx.accounts.claim.status == ClaimV2Status::Disputed,
            FbError::InvalidClaimStatus
        );
        require!(
            ctx.accounts.bounty.status == BountyStatus::Disputed,
            FbError::InvalidStatus
        );
        let now = Clock::get()?.unix_timestamp;
        ctx.accounts.claim.status = ClaimV2Status::Rejected;
        ctx.accounts.claim.updated_at = now;
        ctx.accounts.bounty.status =
            resume_after_v2_reject(ctx.accounts.bounty.status).ok_or(FbError::InvalidStatus)?;
        ctx.accounts.bounty.updated_at = now;
        decrement_active_claims(
            &mut ctx.accounts.bounty,
            ctx.accounts.claim.workflow_version,
        )?;
        case.finalized = true;
        emit!(ClaimV2Rejected {
            bounty: ctx.accounts.bounty.key(),
            claim: ctx.accounts.claim.key(),
        });
        emit!(QuorumDisputeFinalized {
            dispute_case: case.key(),
            decision: 2,
        });
        Ok(())
    }

    /// Creates a permanent, non-transferable proof of a completed return and updates both
    /// participants' reputation. The attestation PDA makes this permissionless but idempotent:
    /// anyone may pay its rent, while the settled bounty and claim are the only source of truth.
    pub fn attest_settlement(ctx: Context<AttestSettlement>) -> Result<()> {
        let bounty = &ctx.accounts.bounty;
        let claim = &ctx.accounts.claim;
        require!(
            bounty.protocol_version >= 2,
            FbError::ProtocolVersionMismatch
        );
        require!(
            bounty.status == BountyStatus::Released,
            FbError::SettlementNotFinal
        );
        require!(
            claim.status == ClaimV2Status::Settled,
            FbError::SettlementNotFinal
        );
        require_keys_eq!(claim.bounty, bounty.key(), FbError::InvalidClaimStatus);
        require_keys_eq!(
            bounty.owner,
            ctx.accounts.owner.key(),
            FbError::Unauthorized
        );
        require_keys_eq!(
            claim.finder,
            ctx.accounts.finder.key(),
            FbError::FinderMismatch
        );
        require_keys_eq!(bounty.finder, claim.finder, FbError::FinderMismatch);

        let now = Clock::get()?.unix_timestamp;
        update_reputation(
            &mut ctx.accounts.owner_reputation,
            bounty.owner,
            bounty.reward_amount,
            false,
            now,
            ctx.bumps.owner_reputation,
        )?;
        update_reputation(
            &mut ctx.accounts.finder_reputation,
            claim.finder,
            bounty.reward_amount,
            true,
            now,
            ctx.bumps.finder_reputation,
        )?;

        let attestation = &mut ctx.accounts.attestation;
        attestation.bounty = bounty.key();
        attestation.claim = claim.key();
        attestation.owner = bounty.owner;
        attestation.finder = claim.finder;
        attestation.reward_amount = bounty.reward_amount;
        attestation.ai_score = claim.ai_score;
        attestation.settled_at = now;
        attestation.bump = ctx.bumps.attestation;

        emit!(SettlementAttested {
            attestation: attestation.key(),
            bounty: bounty.key(),
            claim: claim.key(),
            owner: bounty.owner,
            finder: claim.finder,
            reward_amount: bounty.reward_amount,
        });
        Ok(())
    }
}
