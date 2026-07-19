//! FindBack AI — Solana bounty escrow
//!
//! DRAFT → FUNDED → CLAIM_SUBMITTED → AI_REVIEWED → ACCEPTED → RELEASED
//! FUNDED → (after deadline) → REFUNDED
//! CLAIM_* → DISPUTED → RELEASED | REFUNDED
//!
//! AI never moves funds. Only owner accept / arbiter resolve / expiry refund.

use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("3hLzzJDHvbuKFPKweKEJ3ZAQEijoLLejkvi9ZPmByWna");

pub const BOUNTY_SEED: &[u8] = b"bounty";
pub const VAULT_SEED: &[u8] = b"vault";
pub const CLAIM_V2_SEED: &[u8] = b"claim_v2";
pub const REPUTATION_SEED: &[u8] = b"reputation";
pub const RETURN_ATTESTATION_SEED: &[u8] = b"return_attestation";
pub const MAX_ID_LEN: usize = 32;

#[program]
pub mod findback {
    use super::*;

    pub fn create_bounty(
        ctx: Context<CreateBounty>,
        bounty_id: String,
        reward_amount: u64,
        deadline: i64,
        metadata_hash: [u8; 32],
    ) -> Result<()> {
        require!(
            bounty_id.len() > 0 && bounty_id.len() <= MAX_ID_LEN,
            FbError::InvalidId
        );
        require!(reward_amount > 0, FbError::ZeroReward);
        let now = Clock::get()?.unix_timestamp;
        require!(deadline > now, FbError::InvalidDeadline);

        let b = &mut ctx.accounts.bounty;
        b.owner = ctx.accounts.owner.key();
        b.finder = Pubkey::default();
        b.arbiter = ctx.accounts.arbiter.key();
        b.mint = ctx.accounts.mint.key();
        b.bounty_id = bounty_id;
        b.reward_amount = reward_amount;
        b.amount_funded = 0;
        b.deadline = deadline;
        b.status = BountyStatus::Draft;
        b.metadata_hash = metadata_hash;
        b.evidence_hash = [0u8; 32];
        b.ai_score = 0;
        b.ai_risk = 0;
        b.ai_decision = 0;
        b.ai_explanation_hash = [0u8; 32];
        b.bump = ctx.bumps.bounty;
        b.vault_bump = ctx.bumps.vault_authority;
        b.created_at = now;
        b.updated_at = now;
        b.protocol_version = 2;

        emit!(BountyCreated {
            bounty: b.key(),
            owner: b.owner,
            bounty_id: b.bounty_id.clone(),
            reward_amount,
            deadline,
        });
        Ok(())
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

        b.amount_funded = b
            .amount_funded
            .checked_add(amount)
            .ok_or(FbError::MathOverflow)?;
        if b.amount_funded >= b.reward_amount {
            b.status = BountyStatus::Funded;
        }
        b.updated_at = Clock::get()?.unix_timestamp;

        emit!(BountyFunded {
            bounty: b.key(),
            amount,
            total_funded: b.amount_funded,
            status: b.status,
        });
        Ok(())
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
        let b = &ctx.accounts.bounty;
        require!(b.protocol_version >= 2, FbError::ProtocolVersionMismatch);
        require!(b.status == BountyStatus::Funded, FbError::InvalidStatus);
        require!(b.amount_funded >= b.reward_amount, FbError::NotFullyFunded);
        let now = Clock::get()?.unix_timestamp;
        require!(now <= b.deadline, FbError::PastDeadline);
        require!(
            ctx.accounts.finder.key() != b.owner,
            FbError::OwnerCannotClaim
        );
        require!(evidence_hash != [0u8; 32], FbError::EmptyEvidence);

        let claim = &mut ctx.accounts.claim;
        claim.bounty = b.key();
        claim.finder = ctx.accounts.finder.key();
        claim.evidence_hash = evidence_hash;
        claim.ai_input_hash = [0u8; 32];
        claim.ai_report_hash = [0u8; 32];
        claim.ai_model_hash = [0u8; 32];
        claim.ai_score = 0;
        claim.ai_risk = 0;
        claim.ai_decision = 1;
        claim.status = ClaimV2Status::Submitted;
        claim.bump = ctx.bumps.claim;
        claim.created_at = now;
        claim.updated_at = now;

        emit!(ClaimV2Submitted {
            bounty: b.key(),
            claim: claim.key(),
            finder: claim.finder,
            evidence_hash,
        });
        Ok(())
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
        claim.status = ClaimV2Status::Rejected;
        claim.updated_at = Clock::get()?.unix_timestamp;
        emit!(ClaimV2Rejected {
            bounty: ctx.accounts.bounty.key(),
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
        let claim = &mut ctx.accounts.claim;
        require!(
            ctx.accounts.signer.key() == ctx.accounts.bounty.owner
                || ctx.accounts.signer.key() == claim.finder,
            FbError::Unauthorized
        );
        require!(
            matches!(
                claim.status,
                ClaimV2Status::Submitted | ClaimV2Status::AiReviewed
            ),
            FbError::InvalidClaimStatus
        );
        claim.status = ClaimV2Status::Disputed;
        claim.updated_at = Clock::get()?.unix_timestamp;
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
            require!(b.status == BountyStatus::Funded, FbError::InvalidStatus);
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
            emit!(ClaimV2Rejected {
                bounty: bounty_key,
                claim: claim_key,
            });
        }
        claim.updated_at = now;
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

impl ReturnAttestation {
    pub const SPACE: usize = 8 + 32 * 4 + 8 + 1 + 8 + 1 + 32;
}

#[derive(Accounts)]
#[instruction(bounty_id: String)]
pub struct CreateBounty<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    /// CHECK: arbiter pubkey stored only
    pub arbiter: UncheckedAccount<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        init,
        payer = owner,
        space = Bounty::SPACE,
        seeds = [BOUNTY_SEED, bounty_id.as_bytes()],
        bump
    )]
    pub bounty: Account<'info, Bounty>,
    /// CHECK: PDA vault authority
    #[account(seeds = [VAULT_SEED, bounty_id.as_bytes()], bump)]
    pub vault_authority: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FundBounty<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [BOUNTY_SEED, bounty.bounty_id.as_bytes()],
        bump = bounty.bump,
        has_one = owner,
        has_one = mint
    )]
    pub bounty: Account<'info, Bounty>,
    /// CHECK: PDA
    #[account(seeds = [VAULT_SEED, bounty.bounty_id.as_bytes()], bump = bounty.vault_bump)]
    pub vault_authority: UncheckedAccount<'info>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = owner
    )]
    pub owner_token: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = mint,
        associated_token::authority = vault_authority
    )]
    pub vault_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SubmitClaim<'info> {
    pub finder: Signer<'info>,
    #[account(
        mut,
        seeds = [BOUNTY_SEED, bounty.bounty_id.as_bytes()],
        bump = bounty.bump
    )]
    pub bounty: Account<'info, Bounty>,
}

#[derive(Accounts)]
pub struct SubmitClaimV2<'info> {
    #[account(mut)]
    pub finder: Signer<'info>,
    #[account(
        seeds = [BOUNTY_SEED, bounty.bounty_id.as_bytes()],
        bump = bounty.bump
    )]
    pub bounty: Account<'info, Bounty>,
    #[account(
        init,
        payer = finder,
        space = ClaimV2::SPACE,
        seeds = [CLAIM_V2_SEED, bounty.key().as_ref(), finder.key().as_ref()],
        bump
    )]
    pub claim: Account<'info, ClaimV2>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RecordAiReview<'info> {
    pub arbiter: Signer<'info>,
    #[account(
        mut,
        seeds = [BOUNTY_SEED, bounty.bounty_id.as_bytes()],
        bump = bounty.bump,
        has_one = arbiter
    )]
    pub bounty: Account<'info, Bounty>,
}

#[derive(Accounts)]
pub struct RecordAiReviewV2<'info> {
    pub arbiter: Signer<'info>,
    #[account(
        seeds = [BOUNTY_SEED, bounty.bounty_id.as_bytes()],
        bump = bounty.bump,
        has_one = arbiter
    )]
    pub bounty: Account<'info, Bounty>,
    #[account(
        mut,
        seeds = [CLAIM_V2_SEED, bounty.key().as_ref(), claim.finder.as_ref()],
        bump = claim.bump,
        has_one = bounty
    )]
    pub claim: Account<'info, ClaimV2>,
}

#[derive(Accounts)]
pub struct AcceptClaim<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    /// CHECK: must match bounty.finder
    pub finder: UncheckedAccount<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [BOUNTY_SEED, bounty.bounty_id.as_bytes()],
        bump = bounty.bump,
        has_one = owner,
        has_one = mint
    )]
    pub bounty: Account<'info, Bounty>,
    /// CHECK: PDA
    #[account(seeds = [VAULT_SEED, bounty.bounty_id.as_bytes()], bump = bounty.vault_bump)]
    pub vault_authority: UncheckedAccount<'info>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = vault_authority
    )]
    pub vault_token: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = mint,
        associated_token::authority = finder
    )]
    pub finder_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AcceptClaimV2<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    /// CHECK: constrained to the finder stored in ClaimV2.
    pub finder: UncheckedAccount<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [BOUNTY_SEED, bounty.bounty_id.as_bytes()],
        bump = bounty.bump,
        has_one = owner,
        has_one = mint
    )]
    pub bounty: Account<'info, Bounty>,
    #[account(
        mut,
        seeds = [CLAIM_V2_SEED, bounty.key().as_ref(), claim.finder.as_ref()],
        bump = claim.bump,
        has_one = bounty
    )]
    pub claim: Account<'info, ClaimV2>,
    /// CHECK: PDA authority verified by seeds.
    #[account(seeds = [VAULT_SEED, bounty.bounty_id.as_bytes()], bump = bounty.vault_bump)]
    pub vault_authority: UncheckedAccount<'info>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = vault_authority
    )]
    pub vault_token: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = mint,
        associated_token::authority = finder
    )]
    pub finder_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RejectClaim<'info> {
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [BOUNTY_SEED, bounty.bounty_id.as_bytes()],
        bump = bounty.bump,
        has_one = owner
    )]
    pub bounty: Account<'info, Bounty>,
}

#[derive(Accounts)]
pub struct RejectClaimV2<'info> {
    pub owner: Signer<'info>,
    #[account(
        seeds = [BOUNTY_SEED, bounty.bounty_id.as_bytes()],
        bump = bounty.bump,
        has_one = owner
    )]
    pub bounty: Account<'info, Bounty>,
    #[account(
        mut,
        seeds = [CLAIM_V2_SEED, bounty.key().as_ref(), claim.finder.as_ref()],
        bump = claim.bump,
        has_one = bounty
    )]
    pub claim: Account<'info, ClaimV2>,
}

#[derive(Accounts)]
pub struct RefundAfterExpiry<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [BOUNTY_SEED, bounty.bounty_id.as_bytes()],
        bump = bounty.bump,
        has_one = owner,
        has_one = mint
    )]
    pub bounty: Account<'info, Bounty>,
    /// CHECK: PDA
    #[account(seeds = [VAULT_SEED, bounty.bounty_id.as_bytes()], bump = bounty.vault_bump)]
    pub vault_authority: UncheckedAccount<'info>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = vault_authority
    )]
    pub vault_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = owner
    )]
    pub owner_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CancelBounty<'info> {
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [BOUNTY_SEED, bounty.bounty_id.as_bytes()],
        bump = bounty.bump,
        has_one = owner
    )]
    pub bounty: Account<'info, Bounty>,
}

#[derive(Accounts)]
pub struct OpenDispute<'info> {
    pub signer: Signer<'info>,
    #[account(
        mut,
        seeds = [BOUNTY_SEED, bounty.bounty_id.as_bytes()],
        bump = bounty.bump
    )]
    pub bounty: Account<'info, Bounty>,
}

#[derive(Accounts)]
pub struct OpenDisputeV2<'info> {
    pub signer: Signer<'info>,
    #[account(
        seeds = [BOUNTY_SEED, bounty.bounty_id.as_bytes()],
        bump = bounty.bump
    )]
    pub bounty: Account<'info, Bounty>,
    #[account(
        mut,
        seeds = [CLAIM_V2_SEED, bounty.key().as_ref(), claim.finder.as_ref()],
        bump = claim.bump,
        has_one = bounty
    )]
    pub claim: Account<'info, ClaimV2>,
}

#[derive(Accounts)]
pub struct ResolveDispute<'info> {
    pub arbiter: Signer<'info>,
    /// CHECK: finder or owner depending on resolve path
    pub counterparty: UncheckedAccount<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [BOUNTY_SEED, bounty.bounty_id.as_bytes()],
        bump = bounty.bump,
        has_one = arbiter,
        has_one = mint
    )]
    pub bounty: Account<'info, Bounty>,
    /// CHECK: PDA
    #[account(seeds = [VAULT_SEED, bounty.bounty_id.as_bytes()], bump = bounty.vault_bump)]
    pub vault_authority: UncheckedAccount<'info>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = vault_authority
    )]
    pub vault_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = mint,
        token::authority = counterparty
    )]
    pub counterparty_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ResolveDisputeV2<'info> {
    pub arbiter: Signer<'info>,
    /// CHECK: constrained to the finder stored in ClaimV2.
    pub finder: UncheckedAccount<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [BOUNTY_SEED, bounty.bounty_id.as_bytes()],
        bump = bounty.bump,
        has_one = arbiter,
        has_one = mint
    )]
    pub bounty: Account<'info, Bounty>,
    #[account(
        mut,
        seeds = [CLAIM_V2_SEED, bounty.key().as_ref(), claim.finder.as_ref()],
        bump = claim.bump,
        has_one = bounty
    )]
    pub claim: Account<'info, ClaimV2>,
    /// CHECK: PDA authority verified by seeds.
    #[account(seeds = [VAULT_SEED, bounty.bounty_id.as_bytes()], bump = bounty.vault_bump)]
    pub vault_authority: UncheckedAccount<'info>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = vault_authority
    )]
    pub vault_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = mint,
        token::authority = finder
    )]
    pub finder_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct AttestSettlement<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: address is constrained to the immutable bounty owner below.
    #[account(constraint = owner.key() == bounty.owner @ FbError::Unauthorized)]
    pub owner: UncheckedAccount<'info>,
    /// CHECK: address is constrained to the immutable settled claim finder below.
    #[account(constraint = finder.key() == claim.finder @ FbError::FinderMismatch)]
    pub finder: UncheckedAccount<'info>,
    #[account(
        seeds = [BOUNTY_SEED, bounty.bounty_id.as_bytes()],
        bump = bounty.bump
    )]
    pub bounty: Account<'info, Bounty>,
    #[account(
        seeds = [CLAIM_V2_SEED, bounty.key().as_ref(), finder.key().as_ref()],
        bump = claim.bump,
        has_one = bounty
    )]
    pub claim: Account<'info, ClaimV2>,
    #[account(
        init,
        payer = payer,
        space = ReturnAttestation::SPACE,
        seeds = [RETURN_ATTESTATION_SEED, bounty.key().as_ref(), claim.key().as_ref()],
        bump
    )]
    pub attestation: Account<'info, ReturnAttestation>,
    #[account(
        init_if_needed,
        payer = payer,
        space = Reputation::SPACE,
        seeds = [REPUTATION_SEED, owner.key().as_ref()],
        bump
    )]
    pub owner_reputation: Account<'info, Reputation>,
    #[account(
        init_if_needed,
        payer = payer,
        space = Reputation::SPACE,
        seeds = [REPUTATION_SEED, finder.key().as_ref()],
        bump
    )]
    pub finder_reputation: Account<'info, Reputation>,
    pub system_program: Program<'info, System>,
}

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

#[error_code]
pub enum FbError {
    #[msg("Invalid bounty id")]
    InvalidId,
    #[msg("Reward must be > 0")]
    ZeroReward,
    #[msg("Deadline must be in the future")]
    InvalidDeadline,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Invalid status for this action")]
    InvalidStatus,
    #[msg("Invalid mint")]
    InvalidMint,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Bounty not fully funded")]
    NotFullyFunded,
    #[msg("Past claim deadline")]
    PastDeadline,
    #[msg("Owner cannot claim own bounty")]
    OwnerCannotClaim,
    #[msg("Evidence hash required")]
    EmptyEvidence,
    #[msg("Invalid AI score/decision")]
    InvalidScore,
    #[msg("No finder set")]
    NoFinder,
    #[msg("Finder mismatch")]
    FinderMismatch,
    #[msg("Deadline not reached")]
    NotExpired,
    #[msg("Nothing to refund")]
    NothingToRefund,
    #[msg("Funding would exceed the bounty reward")]
    FundingExceedsReward,
    #[msg("Invalid claim status for this action")]
    InvalidClaimStatus,
    #[msg("Legacy single-claim instruction is disabled for this bounty")]
    LegacyInstructionDisabled,
    #[msg("Instruction does not match the bounty protocol version")]
    ProtocolVersionMismatch,
    #[msg("Settlement is not final")]
    SettlementNotFinal,
}

fn remaining_funding(reward_amount: u64, amount_funded: u64) -> Option<u64> {
    reward_amount.checked_sub(amount_funded)
}

fn update_reputation(
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
    use super::remaining_funding;

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
}
