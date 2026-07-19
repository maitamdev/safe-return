//! SafeReturn Escrow — Solana program (Anchor)
//!
//! Flow for a lost & found case reward:
//! 1. `initialize_case`  — owner opens escrow PDA for a case_id
//! 2. `fund_escrow`      — owner deposits mock USDC (SPL) into vault
//! 3. `set_finder`       — owner binds finder after AI match + secret check
//! 4. `lock_for_handover`— safepoint staff locks funds; OTP hash recorded
//! 5. `release_reward`   — after OTP verify off-chain, staff releases to finder
//! 6. `refund_owner`     — owner cancels before lock / after expire
//! 7. `dispute`          — freeze until admin resolves (demo: staff)
//!
//! AI never signs releases. Human + OTP gate is enforced on-chain via
//! `otp_hash` commitment and `authority` (SafePoint) checks.

use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("8aPk563iNTtCP95gZ5EhdWJhTiL1cgKypcDUJikf3H6c");

/// Fixed-point mock USDC (6 decimals) helpers live off-chain; on-chain we store raw u64.
pub const ESCROW_SEED: &[u8] = b"escrow";
pub const VAULT_SEED: &[u8] = b"vault";
pub const MAX_CASE_ID_LEN: usize = 32;

#[program]
pub mod safereturn_escrow {
    use super::*;

    /// Create escrow PDA for a campus case. Does not move tokens yet.
    pub fn initialize_case(
        ctx: Context<InitializeCase>,
        case_id: String,
        reward_amount: u64,
    ) -> Result<()> {
        require!(case_id.len() > 0 && case_id.len() <= MAX_CASE_ID_LEN, EscrowError::InvalidCaseId);
        require!(reward_amount > 0, EscrowError::ZeroReward);

        let escrow = &mut ctx.accounts.escrow;
        escrow.owner = ctx.accounts.owner.key();
        escrow.finder = Pubkey::default();
        escrow.authority = ctx.accounts.authority.key();
        escrow.mint = ctx.accounts.mint.key();
        escrow.case_id = case_id;
        escrow.reward_amount = reward_amount;
        escrow.amount_funded = 0;
        escrow.status = EscrowState::Unfunded;
        escrow.otp_hash = [0u8; 32];
        escrow.bump = ctx.bumps.escrow;
        escrow.vault_bump = ctx.bumps.vault_authority;
        escrow.created_at = Clock::get()?.unix_timestamp;
        escrow.updated_at = escrow.created_at;

        emit!(CaseInitialized {
            escrow: escrow.key(),
            owner: escrow.owner,
            case_id: escrow.case_id.clone(),
            reward_amount,
        });
        Ok(())
    }

    /// Owner deposits SPL tokens into the PDA-controlled vault ATA.
    pub fn fund_escrow(ctx: Context<FundEscrow>, amount: u64) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        require_keys_eq!(escrow.owner, ctx.accounts.owner.key(), EscrowError::Unauthorized);
        require!(
            matches!(
                escrow.status,
                EscrowState::Unfunded
                    | EscrowState::PartiallyFunded
                    | EscrowState::FinderSet
            ),
            EscrowError::InvalidStatus
        );
        require!(
            escrow.amount_funded < escrow.reward_amount,
            EscrowError::InvalidStatus
        );
        require!(amount > 0, EscrowError::ZeroReward);

        let cpi = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.owner_token.to_account_info(),
                to: ctx.accounts.vault_token.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
        );
        token::transfer(cpi, amount)?;

        escrow.amount_funded = escrow
            .amount_funded
            .checked_add(amount)
            .ok_or(EscrowError::MathOverflow)?;

        if escrow.amount_funded >= escrow.reward_amount {
            escrow.status = if escrow.finder != Pubkey::default() {
                EscrowState::FinderSet
            } else {
                EscrowState::Funded
            };
        } else {
            escrow.status = EscrowState::PartiallyFunded;
        }
        escrow.updated_at = Clock::get()?.unix_timestamp;

        emit!(EscrowFunded {
            escrow: escrow.key(),
            amount,
            total_funded: escrow.amount_funded,
            status: escrow.status,
        });
        Ok(())
    }

    /// Bind finder pubkey after AI match + owner secret confirmation (off-chain).
    pub fn set_finder(ctx: Context<SetFinder>, finder: Pubkey) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        require_keys_eq!(escrow.owner, ctx.accounts.owner.key(), EscrowError::Unauthorized);
        require!(
            matches!(
                escrow.status,
                EscrowState::Unfunded
                    | EscrowState::PartiallyFunded
                    | EscrowState::Funded
                    | EscrowState::FinderSet
            ),
            EscrowError::InvalidStatus
        );
        require!(finder != Pubkey::default(), EscrowError::InvalidFinder);
        require!(finder != escrow.owner, EscrowError::FinderIsOwner);

        escrow.finder = finder;
        // Keep funding status until fully funded; only promote when already Funded.
        if escrow.status == EscrowState::Funded || escrow.status == EscrowState::FinderSet {
            escrow.status = EscrowState::FinderSet;
        }
        escrow.updated_at = Clock::get()?.unix_timestamp;

        emit!(FinderSet {
            escrow: escrow.key(),
            finder,
        });
        Ok(())
    }

    /// SafePoint locks escrow for handover and commits OTP hash (sha256 of otp bytes).
    pub fn lock_for_handover(ctx: Context<LockHandover>, otp_hash: [u8; 32]) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        require_keys_eq!(
            escrow.authority,
            ctx.accounts.authority.key(),
            EscrowError::Unauthorized
        );
        require!(
            matches!(
                escrow.status,
                EscrowState::FinderSet | EscrowState::Funded
            ),
            EscrowError::InvalidStatus
        );
        require!(escrow.finder != Pubkey::default(), EscrowError::FinderNotSet);
        require!(escrow.amount_funded >= escrow.reward_amount, EscrowError::Underfunded);
        require!(otp_hash != [0u8; 32], EscrowError::InvalidOtpHash);

        escrow.otp_hash = otp_hash;
        escrow.status = EscrowState::Locked;
        escrow.updated_at = Clock::get()?.unix_timestamp;

        emit!(HandoverLocked {
            escrow: escrow.key(),
            otp_hash,
        });
        Ok(())
    }

    /// Staff releases reward to finder after verifying OTP off-chain against otp_hash.
    /// `otp_preimage` must hash (sha256) to the committed otp_hash.
    pub fn release_reward(ctx: Context<ReleaseReward>, otp_preimage: [u8; 32]) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        require_keys_eq!(
            escrow.authority,
            ctx.accounts.authority.key(),
            EscrowError::Unauthorized
        );
        require!(escrow.status == EscrowState::Locked, EscrowError::InvalidStatus);
        require_keys_eq!(escrow.finder, ctx.accounts.finder_token.owner, EscrowError::BadFinderAta);

        let expected = anchor_lang::solana_program::hash::hash(&otp_preimage).to_bytes();
        require!(expected == escrow.otp_hash, EscrowError::OtpMismatch);

        let amount = escrow.reward_amount;
        let vault_balance = ctx.accounts.vault_token.amount;
        require!(vault_balance >= amount, EscrowError::Underfunded);

        let seeds: &[&[u8]] = &[
            VAULT_SEED,
            escrow.case_id.as_bytes(),
            &[escrow.vault_bump],
        ];
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

        // Refund dust over-fund to owner if any
        let remaining = vault_balance.saturating_sub(amount);
        if remaining > 0 {
            let cpi_refund = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_token.to_account_info(),
                    to: ctx.accounts.owner_token.to_account_info(),
                    authority: ctx.accounts.vault_authority.to_account_info(),
                },
                signer,
            );
            token::transfer(cpi_refund, remaining)?;
        }

        escrow.status = EscrowState::Released;
        escrow.updated_at = Clock::get()?.unix_timestamp;

        emit!(RewardReleased {
            escrow: escrow.key(),
            finder: escrow.finder,
            amount,
        });
        Ok(())
    }

    /// Owner refund while not locked (or after dispute resolved as refund — staff path).
    pub fn refund_owner(ctx: Context<RefundOwner>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        let is_owner = escrow.owner == ctx.accounts.payer.key();
        let is_auth = escrow.authority == ctx.accounts.payer.key();
        require!(is_owner || is_auth, EscrowError::Unauthorized);

        require!(
            matches!(
                escrow.status,
                EscrowState::Unfunded
                    | EscrowState::PartiallyFunded
                    | EscrowState::Funded
                    | EscrowState::FinderSet
                    | EscrowState::Disputed
            ),
            EscrowError::InvalidStatus
        );

        let amount = ctx.accounts.vault_token.amount;
        if amount > 0 {
            let seeds: &[&[u8]] = &[
                VAULT_SEED,
                escrow.case_id.as_bytes(),
                &[escrow.vault_bump],
            ];
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
        }

        escrow.amount_funded = 0;
        escrow.status = EscrowState::Refunded;
        escrow.updated_at = Clock::get()?.unix_timestamp;

        emit!(EscrowRefunded {
            escrow: escrow.key(),
            amount,
        });
        Ok(())
    }

    /// Freeze escrow during dispute (staff or owner).
    pub fn open_dispute(ctx: Context<OpenDispute>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        let who = ctx.accounts.payer.key();
        require!(
            who == escrow.owner || who == escrow.authority || who == escrow.finder,
            EscrowError::Unauthorized
        );
        require!(
            matches!(
                escrow.status,
                EscrowState::Funded | EscrowState::FinderSet | EscrowState::Locked
            ),
            EscrowError::InvalidStatus
        );

        escrow.status = EscrowState::Disputed;
        escrow.updated_at = Clock::get()?.unix_timestamp;

        emit!(DisputeOpened {
            escrow: escrow.key(),
            by: who,
        });
        Ok(())
    }
}

// ─── State ───────────────────────────────────────────────────────────────────

#[account]
pub struct EscrowAccount {
    pub owner: Pubkey,
    pub finder: Pubkey,
    /// SafePoint / campus staff authority that may lock & release.
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub case_id: String,
    pub reward_amount: u64,
    pub amount_funded: u64,
    pub status: EscrowState,
    /// sha256(otp_preimage) committed at lock time.
    pub otp_hash: [u8; 32],
    pub bump: u8,
    pub vault_bump: u8,
    pub created_at: i64,
    pub updated_at: i64,
}

impl EscrowAccount {
    // 32*4 + 4+32 case_id + 8*2 + 1 status + 32 otp + 1*2 bumps + 8*2 times + 8 disc
    pub const SPACE: usize = 8 + 32 * 4 + (4 + MAX_CASE_ID_LEN) + 8 + 8 + 1 + 32 + 1 + 1 + 8 + 8;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u8)]
pub enum EscrowState {
    Unfunded = 0,
    PartiallyFunded = 1,
    Funded = 2,
    FinderSet = 3,
    Locked = 4,
    Released = 5,
    Refunded = 6,
    Disputed = 7,
}

// ─── Accounts ────────────────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(case_id: String, reward_amount: u64)]
pub struct InitializeCase<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    /// CHECK: campus SafePoint authority (stored, not signed at init).
    pub authority: UncheckedAccount<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        init,
        payer = owner,
        space = EscrowAccount::SPACE,
        seeds = [ESCROW_SEED, case_id.as_bytes()],
        bump
    )]
    pub escrow: Account<'info, EscrowAccount>,
    /// PDA that owns the vault ATA.
    /// CHECK: seeds verified
    #[account(
        seeds = [VAULT_SEED, case_id.as_bytes()],
        bump
    )]
    pub vault_authority: UncheckedAccount<'info>,
    #[account(
        init,
        payer = owner,
        associated_token::mint = mint,
        associated_token::authority = vault_authority
    )]
    pub vault_token: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct FundEscrow<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [ESCROW_SEED, escrow.case_id.as_bytes()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, EscrowAccount>,
    #[account(
        mut,
        constraint = owner_token.owner == owner.key(),
        constraint = owner_token.mint == escrow.mint
    )]
    pub owner_token: Account<'info, TokenAccount>,
    /// CHECK: vault authority PDA
    #[account(
        seeds = [VAULT_SEED, escrow.case_id.as_bytes()],
        bump = escrow.vault_bump
    )]
    pub vault_authority: UncheckedAccount<'info>,
    #[account(
        mut,
        associated_token::mint = escrow.mint,
        associated_token::authority = vault_authority
    )]
    pub vault_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct SetFinder<'info> {
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [ESCROW_SEED, escrow.case_id.as_bytes()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, EscrowAccount>,
}

#[derive(Accounts)]
pub struct LockHandover<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [ESCROW_SEED, escrow.case_id.as_bytes()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, EscrowAccount>,
}

#[derive(Accounts)]
pub struct ReleaseReward<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [ESCROW_SEED, escrow.case_id.as_bytes()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, EscrowAccount>,
    /// CHECK: vault authority PDA
    #[account(
        seeds = [VAULT_SEED, escrow.case_id.as_bytes()],
        bump = escrow.vault_bump
    )]
    pub vault_authority: UncheckedAccount<'info>,
    #[account(
        mut,
        associated_token::mint = escrow.mint,
        associated_token::authority = vault_authority
    )]
    pub vault_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = finder_token.mint == escrow.mint
    )]
    pub finder_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = owner_token.owner == escrow.owner,
        constraint = owner_token.mint == escrow.mint
    )]
    pub owner_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RefundOwner<'info> {
    pub payer: Signer<'info>,
    #[account(
        mut,
        seeds = [ESCROW_SEED, escrow.case_id.as_bytes()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, EscrowAccount>,
    /// CHECK: vault authority PDA
    #[account(
        seeds = [VAULT_SEED, escrow.case_id.as_bytes()],
        bump = escrow.vault_bump
    )]
    pub vault_authority: UncheckedAccount<'info>,
    #[account(
        mut,
        associated_token::mint = escrow.mint,
        associated_token::authority = vault_authority
    )]
    pub vault_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = owner_token.owner == escrow.owner,
        constraint = owner_token.mint == escrow.mint
    )]
    pub owner_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct OpenDispute<'info> {
    pub payer: Signer<'info>,
    #[account(
        mut,
        seeds = [ESCROW_SEED, escrow.case_id.as_bytes()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, EscrowAccount>,
}

// ─── Events & errors ─────────────────────────────────────────────────────────

#[event]
pub struct CaseInitialized {
    pub escrow: Pubkey,
    pub owner: Pubkey,
    pub case_id: String,
    pub reward_amount: u64,
}

#[event]
pub struct EscrowFunded {
    pub escrow: Pubkey,
    pub amount: u64,
    pub total_funded: u64,
    pub status: EscrowState,
}

#[event]
pub struct FinderSet {
    pub escrow: Pubkey,
    pub finder: Pubkey,
}

#[event]
pub struct HandoverLocked {
    pub escrow: Pubkey,
    pub otp_hash: [u8; 32],
}

#[event]
pub struct RewardReleased {
    pub escrow: Pubkey,
    pub finder: Pubkey,
    pub amount: u64,
}

#[event]
pub struct EscrowRefunded {
    pub escrow: Pubkey,
    pub amount: u64,
}

#[event]
pub struct DisputeOpened {
    pub escrow: Pubkey,
    pub by: Pubkey,
}

#[error_code]
pub enum EscrowError {
    #[msg("Case id empty or too long")]
    InvalidCaseId,
    #[msg("Reward must be > 0")]
    ZeroReward,
    #[msg("Signer not authorized for this action")]
    Unauthorized,
    #[msg("Escrow is not in a valid status for this instruction")]
    InvalidStatus,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Invalid finder pubkey")]
    InvalidFinder,
    #[msg("Finder cannot be the owner")]
    FinderIsOwner,
    #[msg("Finder not set yet")]
    FinderNotSet,
    #[msg("Escrow underfunded")]
    Underfunded,
    #[msg("OTP hash cannot be zero")]
    InvalidOtpHash,
    #[msg("OTP preimage does not match committed hash")]
    OtpMismatch,
    #[msg("Finder token account owner mismatch")]
    BadFinderAta,
}
