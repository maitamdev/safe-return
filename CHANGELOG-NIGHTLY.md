# Overnight upgrade notes (local working tree)

## 2026-07-21 morning — Devnet V2 + Vercel

- Built findback SBF on Windows via platform-tools v1.51 + MSRV pins (scripts/pin-sbf-deps.py).
- Verified on-chain program already exposes full V2 instruction surface (discriminators match source).
- 
elease:check:v2: 29 pass / 0 fail (bytecode match, schema, IDL, sponsor gate).
- smoke-findback: SMOKE OK (v1 + multi-claim v2 + dispute quorum + attestation).
- Fixed smoke submit_claim_v2 bounty mut flag (isWritable: true).
- Enabled sponsored fees with separate sponsor keypair; synced Vercel Production/Preview/Development env.
- Production: https://safereturn-delta.vercel.app


Summary of quality work applied in this session. Not a formal release.

## Fixed / restored

- Restored committed `target/idl/findback.json` (was deleted; broke tests/CI).
- Reverted accidental `package.json` deps (`@react-native/debugger-frontend`, etc.).

## Quality gates

- `npm run idl:check` + CI step verifying IDL program id vs `Anchor.toml`.
- Vitest: IDL contract, config explorer URLs, layered rate limit, workflow helpers, status helpers.
- Rust: extra constant/window unit tests.
- `Anchor.toml` test script points at `cargo test` (removed dead yarn/mocha path).
- Full green: lint, typecheck, test, build, cargo test.

## Product / UX

- Semantic alert/status classes (`alert-box-*`, `status-pill-*`, `badge-devnet`).
- Global `error.tsx`, `global-error.tsx`, `loading.tsx`.
- Skip-to-content link; robots.txt + sitemap.

## Security

- `enforceApiRateLimit` (memory + optional Postgres) on fund, AI, media upload, register, wallet verify, sponsor.
- `SECURITY.md` trust-boundary doc.

## Modularization + performance (follow-up)

- **Anchor program** split from monolithic `lib.rs` (~2.5k) into:
  - `constants.rs`, `state.rs`, `contexts.rs`, `events.rs`, `errors.rs`, `helpers.rs`, `lib.rs` (ix entrypoints)
  - `cargo test -p findback`: 8/8 green
- **Client provider** split:
  - `provider.tsx` thin re-export
  - `provider/types.ts`, `crypto.ts`, `errors.ts`, `FindBackProvider.tsx`
  - Context value memoized (`useMemo` + stable `clearError`)
- **Solana client** split:
  - `program.ts` barrel → `program/{constants,types,connection,pdas,client}.ts`
- **Perf**
  - `BountyCard` memoized; smaller image dims + `sizes` + `prefetch={false}`
  - Fonts `display: "swap"`
  - `next.config`: `poweredByHeader: false`, `compress`, `experimental.optimizePackageImports` for icons/wallet/web3
- Verified: `npm run check` + `cargo test -p findback` green

## Protocol V2 / RPC / E2E (this batch)

- **Multi-RPC failover**: `src/lib/solana/rpc-endpoints.ts` + `withRpcEndpointFailover` / `withConnectionFailover` (primary → env fallbacks → public Devnet).
- **Sponsor API**: auto-enables when `SPONSOR_KEYPAIR_JSON` is set (unless `SPONSORED_FEES_ENABLED=0`); client still requires explicit `NEXT_PUBLIC_SPONSORED_FEES=1`.
- **Bankrun-style Vitest**: `src/lib/findback/bankrun-flow.test.ts` (v2 ix surface, multi-claim PDAs, sponsored signer wiring).
- **Playwright E2E**: `e2e/smoke.spec.ts` + `playwright.config.ts`; CI job installs Chromium and runs `npm run test:e2e`.
- **Env template**: `.env.example` documents dedicated RPC + V2/sponsor flags.
- Supabase migrations already live on the linked project (`release:check` schema probes pass).

### Blocked on this machine (not a code gap)

- `cargo-build-sbf` / `anchor build` hits Windows **Access is denied** while managing `~/.cache/solana/platform-tools` (AV/file lock). Without a fresh `.so`, `release:check:v2` correctly fails: on-chain bytecode ≠ local artifact, so **do not flip production V2 until deploy succeeds**.
- Deploy path when tools work: `anchor build` → `npm run findback:deploy` → `npm run findback:smoke` → `npm run release:check:v2` → keep `NEXT_PUBLIC_PROTOCOL_V2=1`.
- Optional: set `NEXT_PUBLIC_SOLANA_RPC` to a free Helius/QuickNode Devnet URL for fewer 429s.
- Further split of `FindBackProvider.tsx` action hooks — API already stable via barrel.
