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
        require!(b.status == BountyStatus::Funded, FbError::InvalidStatus);
        require!(
            b.amount_funded >= b.reward_amount,
            FbError::NotFullyFunded
        );
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

    pub fn accept_claim(ctx: Context<AcceptClaim>) -> Result<()> {
        let bounty_key = ctx.accounts.bounty.key();
        let b = &mut ctx.accounts.bounty;
        require_keys_eq!(b.owner, ctx.accounts.owner.key(), FbError::Unauthorized);
        require!(
            matches!(
                b.status,
                BountyStatus::AiReviewed | BountyStatus::ClaimSubmitted | BountyStatus::Disputed
            ),
            FbError::InvalidStatus
        );
        require!(b.finder != Pubkey::default(), FbError::NoFinder);
        require_keys_eq!(b.finder, ctx.accounts.finder.key(), FbError::FinderMismatch);
        require!(
            b.amount_funded >= b.reward_amount,
            FbError::NotFullyFunded
        );

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

        emit!(ClaimRejected {
            bounty: b.key(),
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

    pub fn resolve_dispute(ctx: Context<ResolveDispute>, release_to_finder: bool) -> Result<()> {
        let bounty_key = ctx.accounts.bounty.key();
        let b = &mut ctx.accounts.bounty;
        require_keys_eq!(b.arbiter, ctx.accounts.arbiter.key(), FbError::Unauthorized);
        require!(b.status == BountyStatus::Disputed, FbError::InvalidStatus);
        require!(b.amount_funded > 0, FbError::NothingToRefund);

        let amount = b.reward_amount.min(b.amount_funded);
        let id_bytes = b.bounty_id.as_bytes();
        let seeds: &[&[u8]] = &[VAULT_SEED, id_bytes, &[b.vault_bump]];
        let signer = &[seeds];

        if release_to_finder {
            require!(b.finder != Pubkey::default(), FbError::NoFinder);
            require_keys_eq!(b.finder, ctx.accounts.counterparty.key(), FbError::FinderMismatch);
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
            require_keys_eq!(b.owner, ctx.accounts.counterparty.key(), FbError::Unauthorized);
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
}

impl Bounty {
    // 32*4 + 4+32 + 8*3 + 1 + 32*3 + 1*5 + 8*2 + padding
    pub const SPACE: usize = 8 + 32 * 4 + (4 + MAX_ID_LEN) + 8 + 8 + 8 + 1 + 32 + 32 + 1 + 1 + 1 + 32 + 1 + 1 + 8 + 8 + 64;
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
pub struct RecordAiReview<'info> {
    pub reporter: Signer<'info>,
    #[account(
        mut,
        seeds = [BOUNTY_SEED, bounty.bounty_id.as_bytes()],
        bump = bounty.bump
    )]
    pub bounty: Account<'info, Bounty>,
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
pub struct AiReviewRecorded {
    pub bounty: Pubkey,
    pub score: u8,
    pub risk_level: u8,
    pub decision: u8,
    pub explanation_hash: [u8; 32],
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
}
