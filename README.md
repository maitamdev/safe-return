# FindBack AI — AI-powered Lost & Found on Solana

> FindBack AI uses AI to verify lost-item claims and Solana escrow to guarantee transparent rewards.

**Hackathon theme:** AI × Web3 — AI analyzes evidence; humans approve; Solana moves funds.

| Layer | Role |
|-------|------|
| **AI Agent** | Score claims 0–100, fraud signals, ACCEPT / REVIEW / REJECT |
| **Solana Program** | Escrow PDA + vault — no AI cannot release tokens |
| **Phantom** | Owner / finder sign real Devnet txs |
| **FIND token** | Devnet SPL **test** reward token (not real USDC) |

## Live product routes

| Path | What |
|------|------|
| `/` | Landing |
| `/bounties` | Browse bounties |
| `/bounties/create` | Create + fund (Phantom) |
| `/bounties/[id]` | Detail, AI panel, accept/reject |
| `/bounties/[id]/claim` | Submit claim → AI review |
| `/bounties/dashboard` | Owner dashboard |
| `/app` | Legacy campus MVP (SafeReturn) |

## One real demo flow (3 min)

1. Phantom → **Devnet**
2. Import **FIND** mint (after setup)
3. `/bounties/create` → lock reward
4. Other wallet → Submit claim + photo
5. AI panel shows score + explanation
6. Owner → **Approve & Release**
7. Open **Solana Explorer** link (real signature)

AI **never** transfers tokens. Owner signature required.

## Stack

- Next.js 16 + TypeScript + Tailwind
- Solana Devnet + Anchor-style Rust program `programs/findback`
- SPL FIND Reward Token
- AI: OpenAI-compatible vision (`OPENAI_API_KEY`) or labeled **heuristic Demo mode**

## Quick start (web)

```bash
cd safereturn
npm install
npm run dev
```

Open [http://localhost:3000/bounties](http://localhost:3000/bounties).

## Solana setup (Devnet)

```bash
# 1) Deploy program (needs SOL on ~/.config/solana/id.json)
npm run findback:deploy

# 2) Create FIND mint + mint supply to deployer
npm run findback:setup
# optional: airdrop FIND to your Phantom
npm run findback:setup -- <YOUR_PHANTOM_PUBKEY>

# 3) End-to-end on-chain smoke
npm run findback:smoke
```

### Program ID

```
3hLzzJDHvbuKFPKweKEJ3ZAQEijoLLejkvi9ZPmByWna
```

Explorer:  
https://explorer.solana.com/address/3hLzzJDHvbuKFPKweKEJ3ZAQEijoLLejkvi9ZPmByWna?cluster=devnet

### Instructions

`create_bounty` → `fund_bounty` → `submit_claim` → `record_ai_review` → `accept_claim` / `reject_claim` → `refund_after_expiry`  
(+ `open_dispute` / `resolve_dispute` / `cancel_bounty`)

### State machine

```
DRAFT → FUNDED → CLAIM_SUBMITTED → AI_REVIEWED → RELEASED
FUNDED → (after deadline) → REFUNDED
```

## AI key (optional — makes scoring “live”)

Add to `.env.local` (server only, never commit):

```env
OPENAI_API_KEY=sk-...
# optional
OPENAI_MODEL=gpt-4o-mini
OPENAI_BASE_URL=https://api.openai.com/v1
```

Without a key, `/api/ai/review` uses **heuristic mode** and the UI labels **Demo mode** (not fake “live AI”).

## Env example

See `.env.example`. Important public vars:

```env
NEXT_PUBLIC_SOLANA_RPC=https://api.devnet.solana.com
NEXT_PUBLIC_SOLANA_LIVE=1
NEXT_PUBLIC_FINDBACK_PROGRAM_ID=3hLzzJDHvbuKFPKweKEJ3ZAQEijoLLejkvi9ZPmByWna
NEXT_PUBLIC_FIND_MINT=<from setup>
NEXT_PUBLIC_ARBITER=<deployer pubkey>
```

## Token honesty

**FIND** = Devnet test SPL token for demos.  
Slide line: *“FIND is a test SPL token used for the Devnet demonstration.”*

## Repo map

```
programs/findback/     # Rust program
src/lib/findback/      # client + store + provider
src/lib/ai/            # agent + heuristic + types
src/app/bounties/      # product UI
src/app/api/ai/review  # AI API
scripts/deploy-findback.mjs
scripts/setup-findback-devnet.mjs
scripts/smoke-findback.mjs
```

## Slide one-liner (VI)

FindBack AI dùng AI để xác minh người tìm thấy đồ và dùng Solana escrow để đảm bảo tiền thưởng được trao minh bạch, đúng người.

## License

MIT — hackathon MVP.
