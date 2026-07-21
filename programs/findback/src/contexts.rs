//! Instruction account contexts.
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::constants::*;
use crate::errors::FbError;
use crate::state::*;

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
#[instruction(bounty_id: String)]
pub struct CreateBountySponsored<'info> {
    pub owner: Signer<'info>,
    #[account(mut)]
    pub sponsor: Signer<'info>,
    /// CHECK: arbiter pubkey stored only.
    pub arbiter: UncheckedAccount<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        init,
        payer = sponsor,
        space = Bounty::SPACE,
        seeds = [BOUNTY_SEED, bounty_id.as_bytes()],
        bump
    )]
    pub bounty: Account<'info, Bounty>,
    /// CHECK: PDA vault authority.
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
pub struct FundBountySponsored<'info> {
    pub owner: Signer<'info>,
    #[account(mut)]
    pub sponsor: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [BOUNTY_SEED, bounty.bounty_id.as_bytes()],
        bump = bounty.bump,
        has_one = owner,
        has_one = mint
    )]
    pub bounty: Account<'info, Bounty>,
    /// CHECK: PDA authority verified by seeds.
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
        payer = sponsor,
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
        mut,
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
pub struct SubmitClaimV2Sponsored<'info> {
    pub finder: Signer<'info>,
    #[account(mut)]
    pub sponsor: Signer<'info>,
    #[account(
        mut,
        seeds = [BOUNTY_SEED, bounty.bounty_id.as_bytes()],
        bump = bounty.bump
    )]
    pub bounty: Account<'info, Bounty>,
    #[account(
        init,
        payer = sponsor,
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
pub struct FinalizeClaimV2<'info> {
    pub finalizer: Signer<'info>,
    #[account(
        mut,
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
        mut,
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

#[derive(Accounts)]
pub struct ConfigureArbitrationPanel<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [BOUNTY_SEED, bounty.bounty_id.as_bytes()],
        bump = bounty.bump,
        has_one = owner
    )]
    pub bounty: Account<'info, Bounty>,
    #[account(
        init,
        payer = owner,
        space = ArbitrationPanel::SPACE,
        seeds = [ARBITRATION_PANEL_SEED, bounty.key().as_ref()],
        bump
    )]
    pub panel: Account<'info, ArbitrationPanel>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct OpenDisputeV3<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(
        mut,
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
    #[account(
        seeds = [ARBITRATION_PANEL_SEED, bounty.key().as_ref()],
        bump = panel.bump,
        has_one = bounty
    )]
    pub panel: Account<'info, ArbitrationPanel>,
    #[account(
        init,
        payer = signer,
        space = DisputeCase::SPACE,
        seeds = [DISPUTE_CASE_SEED, claim.key().as_ref()],
        bump
    )]
    pub dispute_case: Account<'info, DisputeCase>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CastArbitrationVote<'info> {
    #[account(mut)]
    pub arbiter: Signer<'info>,
    #[account(
        seeds = [ARBITRATION_PANEL_SEED, panel.bounty.as_ref()],
        bump = panel.bump
    )]
    pub panel: Account<'info, ArbitrationPanel>,
    #[account(
        mut,
        seeds = [DISPUTE_CASE_SEED, dispute_case.claim.as_ref()],
        bump = dispute_case.bump,
        has_one = panel
    )]
    pub dispute_case: Account<'info, DisputeCase>,
    #[account(address = dispute_case.claim)]
    pub claim: Account<'info, ClaimV2>,
    #[account(
        init,
        payer = arbiter,
        space = ArbitrationVote::SPACE,
        seeds = [ARBITRATION_VOTE_SEED, dispute_case.key().as_ref(), arbiter.key().as_ref()],
        bump
    )]
    pub vote: Account<'info, ArbitrationVote>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FinalizeDisputeRelease<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: constrained to the finder stored in ClaimV2.
    pub finder: UncheckedAccount<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [BOUNTY_SEED, bounty.bounty_id.as_bytes()],
        bump = bounty.bump,
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
    #[account(
        seeds = [ARBITRATION_PANEL_SEED, bounty.key().as_ref()],
        bump = panel.bump,
        has_one = bounty
    )]
    pub panel: Account<'info, ArbitrationPanel>,
    #[account(
        mut,
        seeds = [DISPUTE_CASE_SEED, claim.key().as_ref()],
        bump = dispute_case.bump,
        has_one = bounty,
        has_one = claim,
        has_one = panel
    )]
    pub dispute_case: Account<'info, DisputeCase>,
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
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = finder
    )]
    pub finder_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FinalizeDisputeReject<'info> {
    pub finalizer: Signer<'info>,
    #[account(
        mut,
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
    #[account(
        seeds = [ARBITRATION_PANEL_SEED, bounty.key().as_ref()],
        bump = panel.bump,
        has_one = bounty
    )]
    pub panel: Account<'info, ArbitrationPanel>,
    #[account(
        mut,
        seeds = [DISPUTE_CASE_SEED, claim.key().as_ref()],
        bump = dispute_case.bump,
        has_one = bounty,
        has_one = claim,
        has_one = panel
    )]
    pub dispute_case: Account<'info, DisputeCase>,
}

