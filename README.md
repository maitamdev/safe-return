# SafeReturn

Campus lost & found MVP for UniHackFest — AI matching + **Solana escrow (Rust/Anchor)**.

## Stack

- Next.js 16 (App Router)
- React 19 + Tailwind CSS 4
- Phosphor Icons + Motion
- **Real Solana Devnet** escrow (no mock signatures)
- **Rust / Anchor** program: `programs/safereturn_escrow`

## Run (web)

```bash
cd safereturn
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).  
App + Phantom: [http://localhost:3000/app](http://localhost:3000/app).

## Solana escrow (Rust) — **live on Devnet**

Program source: [`programs/safereturn_escrow`](./programs/safereturn_escrow).  
Full guide: **[`DEVNET.md`](./DEVNET.md)**.

| | |
|--|--|
| Program | [`8aPk563iNTtCP95gZ5EhdWJhTiL1cgKypcDUJikf3H6c`](https://explorer.solana.com/address/8aPk563iNTtCP95gZ5EhdWJhTiL1cgKypcDUJikf3H6c?cluster=devnet) |
| Mock USDC | [`BGcZtKHFpuNPk9U78vb6oUAt4KFkFhLhu1UomNAZwHRD`](https://explorer.solana.com/address/BGcZtKHFpuNPk9U78vb6oUAt4KFkFhLhu1UomNAZwHRD?cluster=devnet) |

| Instruction | Who | What |
|-------------|-----|------|
| `initialize_case` | Owner (Phantom) | Create escrow PDA |
| `fund_escrow` | Owner | Lock mock USDC in vault |
| `set_finder` | Owner | Bind finder after AI + secret |
| `lock_for_handover` | SafePoint | Commit OTP hash |
| `release_reward` | SafePoint | Pay finder if OTP matches |

```powershell
npm run solana:fund      # free Devnet SOL if needed
npm run solana:smoke     # real on-chain ix test
npm run dev              # Connect Phantom on Devnet → /app
```

## Routes

| Path | Description |
|------|-------------|
| `/` | Marketing landing |
| `/app` | Dashboard |
| `/app/items` | Item registry + QR |
| `/app/items/new` | Register item |
| `/app/lost` | Owner: report lost |
| `/app/found` | Finder: report found + AI match |
| `/app/cases` | Case list |
| `/app/cases/[id]` | Match, escrow, OTP handover |
| `/app/safepoint` | Staff desk console |
| `/app/demo` | Quinn → Mai live walkthrough |
| `/app/profile` | Wallet, badges, notifications |

## Demo flow (judges)

1. Open **Live Demo** (`/app/demo`) → **Start demo** / **Next step**
2. Or manual:
   - Owner: Report lost backpack
   - Finder: Report found (AI 93% match)
   - Confirm secret → Fund escrow → SafePoint OTP → Reward released

Use the **Act as** switcher in the sidebar (owner / finder / safepoint).

## Notes

- Default: **live Devnet** (`NEXT_PUBLIC_SOLANA_LIVE=1` in `.env.local`).
- AI never auto-releases funds — SafePoint + OTP confirmation required on-chain.
- Phantom must be on **Devnet**. Mock USDC lives on mint above (transfer from deployer ATA).
