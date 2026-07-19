# SafeReturn — Bạn làm theo đúng các bước này

App đã làm giống dApp Solana chuẩn trên GitHub  
(Wallet Standard + Connect modal + Devnet badge + Explorer links).

---

## Bước 0 — Mở app

**Production (khuyên dùng):**  
https://safereturn-delta.vercel.app/app

Hoặc local:

```powershell
cd d:\HACKATHON\safereturn
npm install
npm run dev
```

→ http://localhost:3000/app

---

## Bước 1 — Cài ví (1 lần)

1. Chrome/Edge → https://phantom.app/download  
2. **Add extension** (đây chính là “cài Phantom”)  
3. Tạo ví → **lưu seed phrase ra giấy**, không gửi ai  
4. Mở Phantom → bánh răng **Settings**  
5. **Developer Settings** → bật **Testnet Mode** → chọn **Devnet**

> Sai mạng (Mainnet) = giao dịch fail. Phải **Devnet**.

---

## Bước 2 — Connect trong app

1. Vào `/app`  
2. Góc phải / sidebar → **Connect Wallet**  
3. Popup hiện → chọn **Phantom** → **Connect / Approve**  
4. Thấy:
   - Badge vàng **DEVNET**
   - Địa chỉ rút gọn (vd `Ab12…xY9z`)
   - Số dư `x.xxx SOL` (có thể = 0 lúc đầu)

→ Xong là “đăng nhập” kiểu Web3 (không có email/password).

---

## Bước 3 — Có SOL Devnet (tiền ảo, free)

Cần chút SOL **ảo** để trả phí gas (vẫn 0đ thật).

**Cách A — Faucet web**  
1. Copy địa chỉ ví (bấm địa chỉ trên header hoặc Profile → Copy)  
2. https://faucet.solana.com → network **devnet** → dán địa chỉ → request  

**Cách B — lệnh (máy bạn đã setup Solana CLI)**  

```powershell
cd d:\HACKATHON\safereturn
npm run solana:fund -- <DÁN_ĐỊA_CHỈ_PHANTOM> 2
```

Đợi vài giây → reload app → badge hiện SOL > 0.

---

## Bước 4 — Demo cho giám khảo (3 phút)

1. Sidebar → **Demo** (`/app/demo`)  
2. Bấm **Start** / **Next** theo từng bước  
3. Khi Phantom bật popup → **Approve**  
4. Sau tx → bấm link **Explorer** (phải thấy `cluster=devnet`)

### Hoặc làm tay

| Vai (sidebar Act as) | Làm gì | Trang |
|----------------------|--------|--------|
| Owner | Báo mất | `/app/lost` |
| Finder | Báo nhặt + AI match | `/app/found` |
| Owner | Accept + Fund escrow | `/app/cases/...` |
| SafePoint | Lock OTP / trả đồ | `/app/safepoint` |

---

## Mock USDC (khi Fund escrow cần token)

Mint Devnet:

```
BGcZtKHFpuNPk9U78vb6oUAt4KFkFhLhu1UomNAZwHRD
```

Phantom → Manage token list → Import mint → Confirm.

Nếu API fund local/Vercel chạy được, có thể mint giúp qua `POST /api/devnet/fund`.

---

## Checklist “giống dApp GitHub”

| Chuẩn Solana dApp | SafeReturn |
|-------------------|------------|
| Wallet adapter / Wallet Standard | Có |
| Connect modal (chọn Phantom…) | Có |
| Network badge Devnet | Có |
| SOL balance | Có |
| Tx → Explorer link | Có |
| Program on-chain Devnet | Có |
| Không mock signature | Có |

---

## Link quan trọng

| | |
|--|--|
| App | https://safereturn-delta.vercel.app/app |
| GitHub | https://github.com/maitamdev/safe-return |
| Program | https://explorer.solana.com/address/8aPk563iNTtCP95gZ5EhdWJhTiL1cgKypcDUJikf3H6c?cluster=devnet |
| Faucet | https://faucet.solana.com |

---

## Lỗi thường gặp

| Hiện tượng | Fix |
|------------|-----|
| Connect không ra Phantom | Cài extension + reload trang |
| Tx fail / insufficient funds | Bước 3 — nạp SOL Devnet |
| Phantom báo Mainnet | Settings → Devnet |
| Không thấy mock USDC | Import mint ở trên |
| Modal không hiện | Tắt adblock / thử Chrome |

---

## Bạn KHÔNG cần

- SOL thật (Mainnet)  
- Hiểu blockchain sâu  
- Chạy validator local  
- Login email  

Chỉ cần: **Phantom Devnet + Connect + Demo**.
