//! Program error codes.
use anchor_lang::prelude::*;

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
    #[msg("This bounty requires 2-of-3 quorum arbitration")]
    QuorumArbitrationRequired,
    #[msg("Arbitration quorum must be 2-of-3")]
    InvalidQuorum,
    #[msg("Arbiter address is invalid")]
    InvalidArbiter,
    #[msg("Arbiters must be distinct wallets")]
    DuplicateArbiter,
    #[msg("A bounty party cannot arbitrate its own case")]
    PartyCannotArbitrate,
    #[msg("The original lead arbiter must remain on the panel")]
    LeadArbiterRequired,
    #[msg("This arbitration case is already resolved")]
    CaseAlreadyResolved,
    #[msg("The arbitration quorum has not reached this decision")]
    QuorumNotReached,
    #[msg("The finder dispute window is still open")]
    DisputeWindowOpen,
    #[msg("The finder dispute window has closed")]
    DisputeWindowClosed,
    #[msg("The arbitration resolution window is still open")]
    ResolutionWindowOpen,
    #[msg("The arbitration resolution window has closed")]
    ResolutionWindowClosed,
    #[msg("Active claims must be resolved before refund")]
    ActiveClaimsRemain,
}
