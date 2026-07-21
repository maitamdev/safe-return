# Security policy

SafeReturn runs on **Solana Devnet** with a test SPL token (FIND). Do not use Mainnet wallets, real funds, or production secrets in this repository.

## Reporting

If you find a vulnerability in this codebase, open a private security advisory on the GitHub repository or contact the maintainers. Do not file a public issue with exploit details.

## Trust boundaries

| Layer | Role |
|-------|------|
| Solana Devnet program | Escrow, claim PDAs, settlement, reputation |
| Supabase | Private metadata, media, auth, Realtime |
| Next.js API | Writes Supabase only after wallet + tx + PDA checks |

## Operational rules

- Never commit `.env.local`, keypair JSON, database URIs, or service-role keys.
- Enable `NEXT_PUBLIC_PROTOCOL_V2=1` only when `npm run release:check:v2` is green (program bytecode + Supabase schema aligned).
- Sponsored fees: set `NEXT_PUBLIC_SPONSORED_FEES=1` on the client and provide `SPONSOR_KEYPAIR_JSON` (Devnet-only). Server auto-enables when the key is present unless `SPONSORED_FEES_ENABLED=0`.
- Prefer a dedicated Devnet RPC in `NEXT_PUBLIC_SOLANA_RPC` (Helius/QuickNode/Alchemy). Built-in public fallbacks apply automatically on 429/network errors.
- Rate limits use in-memory + optional Postgres (`enforceApiRateLimit`) on sensitive routes.
- AI review fails closed when no provider key is configured.

## Client contract

`target/idl/findback.json` is a reviewed client contract. CI fails if it is missing or its program id drifts from `Anchor.toml`.
