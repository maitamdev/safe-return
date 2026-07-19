# SafeReturn — Real Solana Devnet (no mock)

Everything below is **on-chain Devnet**. Signatures go to Explorer. No fake tx strings.

## Live deployment (this machine)

| Item | Value |
|------|--------|
| Program ID | `8aPk563iNTtCP95gZ5EhdWJhTiL1cgKypcDUJikf3H6c` |
| Deploy tx | [Explorer](https://explorer.solana.com/tx/2bhCgrP5q5Rd4Ls5Zv6G81jS1Fu3cXvLWtjtetQhscHNRd58MS2thUq3cvv35bVTiXZnmHa7p4BHNxL9TtjY3pmp?cluster=devnet) |
| Mock USDC mint | `BGcZtKHFpuNPk9U78vb6oUAt4KFkFhLhu1UomNAZwHRD` |
| Deployer / SafePoint authority | `DoNrsajZ2Yo8C1biPb8BiB2z3S5ZwZ9VWuFMwF8R2CUa` |
| Cluster | Devnet · `https://api.devnet.solana.com` |

- Program: https://explorer.solana.com/address/8aPk563iNTtCP95gZ5EhdWJhTiL1cgKypcDUJikf3H6c?cluster=devnet  
- Mint: https://explorer.solana.com/address/BGcZtKHFpuNPk9U78vb6oUAt4KFkFhLhu1UomNAZwHRD?cluster=devnet  

`.env.local` is already filled. Restart `npm run dev` after any env change.

## Run the app

```powershell
cd d:\HACKATHON\safereturn
npm run dev
```

1. Install [Phantom](https://phantom.app)  
2. Settings → Developer Settings → **Testnet Mode** → **Devnet**  
3. Open `http://localhost:3000/app` → **Connect Phantom**  
4. Fund Phantom with Devnet SOL: `npm run solana:fund -- <YOUR_PHANTOM_ADDRESS> 2`  
5. Get mock USDC: import mint `BGcZtKHFpuNPk9U78vb6oUAt4KFkFhLhu1UomNAZwHRD` in Phantom, then transfer from deployer ATA or re-run setup minting to your pubkey  

### Transfer mock USDC to your Phantom (optional)

```powershell
# After connecting Phantom, copy your pubkey, then:
spl-token transfer BGcZtKHFpuNPk9U78vb6oUAt4KFkFhLhu1UomNAZwHRD 100 <PHANTOM_PUBKEY> --url devnet --fund-recipient
```

## Useful commands

```powershell
npm run solana:balance          # deployer SOL
npm run solana:address
npm run solana:fund             # claim free Devnet SOL (j.tools)
npm run solana:setup            # recreate mint if needed
npm run solana:deploy           # redeploy .so
npm run solana:smoke            # real on-chain ix test
```

## App flow (real txs)

1. Report lost → `initialize_case`  
2. Fund escrow → `fund_escrow` (needs mock USDC in connected wallet)  
3. Accept match → `set_finder`  
4. SafePoint lock → `lock_for_handover` (OTP hash on-chain)  
5. Confirm OTP → `release_reward` (SPL to finder)  

Every success shows an Explorer link (`?cluster=devnet`).

## Toolchain notes (Windows)

- Solana CLI: `~\.local\share\solana\install\active_release\bin`  
- Deployer keypair: `~\.config\solana\id.json`  
- Program keypair: `target/deploy/safereturn_escrow-keypair.json`  
- `solana-test-validator` may fail on some Windows setups (genesis unpack Access Denied). **Devnet is the target** — no local validator required.  
- Public `solana airdrop` is often 429; use `npm run solana:fund` instead.
