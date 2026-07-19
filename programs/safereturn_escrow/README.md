# safereturn_escrow (Rust / Anchor)

Solana program for SafeReturn campus lost & found rewards.

## State machine

```
initialize_case → Unfunded
       │
fund_escrow ──► Funded (or PartiallyFunded)
       │
set_finder  ──► FinderSet
       │
lock_for_handover(otp_hash) ──► Locked
       │
release_reward(otp_preimage) ──► Released  (SPL → finder)
```

Also: `refund_owner` (before lock), `open_dispute` (freeze).

## Security model (demo + production intent)

| Rule | Enforced |
|------|----------|
| AI cannot release funds | No AI signer; only SafePoint `authority` |
| OTP gate | `sha256(otp)` committed at lock; checked at release |
| Owner funds only | `fund_escrow` requires owner signature |
| Finder bound by owner | `set_finder` after secret check off-chain |

## Build & deploy (when toolchain installed)

```bash
# Prerequisites: Rust, Solana CLI, Anchor 0.30.x
cd safereturn
anchor build
anchor keys list   # copy program id → declare_id! + Anchor.toml
anchor deploy --provider.cluster devnet
```

Then set frontend env:

```env
NEXT_PUBLIC_SOLANA_LIVE=1
NEXT_PUBLIC_SAFERETURN_PROGRAM_ID=<deployed>
NEXT_PUBLIC_MOCK_USDC_MINT=<devnet mint>
NEXT_PUBLIC_SAFEPOINT_AUTHORITY=<staff pubkey>
NEXT_PUBLIC_SOLANA_CLUSTER=devnet
```

## Instructions

| Ix | Signer | Effect |
|----|--------|--------|
| `initialize_case` | owner | Create escrow PDA + vault ATA |
| `fund_escrow` | owner | Transfer SPL into vault |
| `set_finder` | owner | Bind finder pubkey |
| `lock_for_handover` | authority | Commit OTP hash, lock |
| `release_reward` | authority | Verify OTP, pay finder |
| `refund_owner` | owner or authority | Return vault to owner |
| `open_dispute` | owner/finder/authority | Freeze |

## Frontend bridge

- Simulator (default): `src/lib/solana/escrow.ts` mirrors this state machine for hackathon demos without a wallet.
- IDL snapshot: `target/idl/safereturn_escrow.json`
- Config: `src/lib/solana/config.ts`
