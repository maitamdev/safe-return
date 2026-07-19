# SafeReturn — Hướng dẫn demo (cho chủ dự án)

File này **không hiện trong app**. Dùng khi bạn hướng dẫn giám khảo / teammate.

## Link

| | |
|--|--|
| Production | https://safereturn-delta.vercel.app |
| App | https://safereturn-delta.vercel.app/app |
| GitHub | https://github.com/maitamdev/safe-return |
| Program (Devnet) | https://explorer.solana.com/address/8aPk563iNTtCP95gZ5EhdWJhTiL1cgKypcDUJikf3H6c?cluster=devnet |
| Mock USDC mint | `BGcZtKHFpuNPk9U78vb6oUAt4KFkFhLhu1UomNAZwHRD` |

## Trước khi demo (1 lần / máy)

1. Cài [Phantom](https://phantom.app/download) (Chrome/Edge).
2. Phantom → **Settings** → **Developer Settings** → bật **Testnet Mode** → chọn **Devnet**.
3. Mở app → bấm **Connect Wallet** (góc phải / sidebar) → Approve trên Phantom.
4. Cần SOL Devnet (phí gas ảo):
   - Trong app (local): `POST /api/devnet/fund` với `{ "address": "<pubkey>" }`  
   - Hoặc: `npm run solana:fund -- <pubkey> 2`  
   - Hoặc web: https://faucet.solana.com (devnet)
5. Cần mock USDC để fund escrow: import mint ở trên vào Phantom, hoặc dùng API fund (local/Vercel đã cấu hình secret mint).

> Devnet = tiền ảo, **0đ thật**. Không chọn Mainnet.

## Script demo giám khảo (~3 phút)

1. Mở `/app` → Connect Wallet (hiện địa chỉ rút gọn = OK).
2. `/app/demo` → **Start / Next** theo 8 bước (Quinn mất balo → Mai nhặt → SafePoint → thưởng).
3. Hoặc tay:
   - Owner: `/app/lost` báo mất  
   - Finder: `/app/found` báo nhặt + AI match  
   - Case: Accept match → **Fund escrow** (Phantom Approve)  
   - SafePoint: `/app/safepoint` lock OTP / release  
4. Sau mỗi tx: bấm link **Explorer** (cluster=devnet) để show on-chain.

Sidebar **Act as**: đổi vai owner / finder / safepoint (UI demo, không phải login user).

## Chức năng chính trong app

| Trang | Chức năng |
|-------|-----------|
| `/app` | Dashboard |
| `/app/items` | Đăng ký đồ + QR |
| `/app/lost` | Báo mất |
| `/app/found` | Báo nhặt + AI match |
| `/app/cases/[id]` | Escrow, OTP, tx |
| `/app/safepoint` | Bàn giao staff |
| `/app/demo` | Walkthrough 8 bước |
| `/app/profile` | Ví Phantom + badge |

## Local dev

```powershell
cd d:\HACKATHON\safereturn
npm install
npm run dev
# http://localhost:3000
```

## Deploy lại

```powershell
git push origin main
# Vercel auto-deploy (đã nối repo)
# hoặc: npx vercel --prod --yes
```

## On-chain (đã deploy Devnet)

| | |
|--|--|
| Program ID | `8aPk563iNTtCP95gZ5EhdWJhTiL1cgKypcDUJikf3H6c` |
| Mock USDC | `BGcZtKHFpuNPk9U78vb6oUAt4KFkFhLhu1UomNAZwHRD` |
| Authority | `DoNrsajZ2Yo8C1biPb8BiB2z3S5ZwZ9VWuFMwF8R2CUa` |

Instructions: `initialize_case` · `fund_escrow` · `set_finder` · `lock_for_handover` · `release_reward`

Chi tiết kỹ thuật: `DEVNET.md`
