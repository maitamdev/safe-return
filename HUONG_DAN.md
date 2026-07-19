# SafeReturn — Hướng dẫn dùng (không cần biết blockchain)

## 30 giây hiểu

- App chạy trên **Solana Devnet** = mạng thử nghiệm.
- **SOL Devnet** và **mock USDC** = tiền ảo, **0 đồng thật**, không đổi ra tiền thật được.
- Ví **Phantom** chỉ để *ký* giao dịch (giống chữ ký điện tử), không cần mua crypto.

---

## Bước 1 — Mở app

```
http://localhost:3000/app
```

Hoặc trang hướng dẫn:

```
http://localhost:3000/app/setup
```

Nếu chưa chạy server:

```powershell
cd d:\HACKATHON\safereturn
npm run dev
```

---

## Bước 2 — Cài Phantom (1 lần)

1. Vào https://phantom.app/download → cài extension Chrome/Edge.
2. Tạo ví mới → **lưu seed phrase ra giấy**, đừng gửi cho ai (kể cả AI).
3. Đặt mật khẩu máy.

---

## Bước 3 — Bật Devnet trong Phantom (rất quan trọng)

1. Mở Phantom → biểu tượng **bánh răng (Settings)**
2. Kéo xuống → **Developer Settings**
3. Bật **Testnet Mode**
4. Chọn mạng **Devnet** (không phải Mainnet)

Nếu quên bước này, giao dịch sẽ fail hoặc Phantom báo sai mạng.

---

## Bước 4 — Connect + nạp tiền ảo trong SafeReturn

1. Mở http://localhost:3000/app/setup
2. Bấm **Connect Phantom** → Approve
3. Bấm **Nạp tiền ảo miễn phí**
   - App tự claim **SOL Devnet** (trả “phí gas” ảo)
   - App mint **100 mock USDC** vào ví bạn (token test của lab)

### Thấy mock USDC trong Phantom?

1. Phantom → **Manage token list** / Import token
2. Dán mint:

```
BGcZtKHFpuNPk9U78vb6oUAt4KFkFhLhu1UomNAZwHRD
```

3. Confirm — số dư ~100 sẽ hiện.

---

## Bước 5 — Demo cho giám khảo (cách nhanh nhất)

1. http://localhost:3000/app/demo
2. Bấm **Start** / **Next** theo từng bước
3. Khi Phantom bật popup → bấm **Approve**
4. Sau mỗi tx, bấm link **Explorer** để show on-chain thật

### Luồng tay (nếu thích)

| Ai | Làm gì | Trang |
|----|--------|--------|
| Chủ đồ (Owner) | Báo mất đồ | `/app/lost` |
| Người nhặt (Finder) | Báo nhặt + AI match | `/app/found` |
| Chủ đồ | Accept match + Fund escrow | `/app/cases/[id]` |
| SafePoint | Nhận đồ, lock OTP, trả đồ | `/app/safepoint` |
| Chủ đồ | Nhập OTP → release thưởng | `/app/cases/[id]` |

Dùng nút **Act as** ở sidebar để đổi vai (owner / finder / safepoint).

---

## Link on-chain (show giám khảo)

- Program: https://explorer.solana.com/address/8aPk563iNTtCP95gZ5EhdWJhTiL1cgKypcDUJikf3H6c?cluster=devnet
- Mock USDC mint: https://explorer.solana.com/address/BGcZtKHFpuNPk9U78vb6oUAt4KFkFhLhu1UomNAZwHRD?cluster=devnet

Luôn chọn **Devnet** trên Explorer (góc phải).

---

## Lỗi thường gặp

| Hiện tượng | Cách xử lý |
|------------|------------|
| “Chưa nối ví” | Connect Phantom + bật Devnet |
| Tx fail / insufficient funds | `/app/setup` → **Nạp tiền ảo miễn phí** |
| Không thấy mock USDC | Import mint ở trên vào Phantom |
| Phantom báo Mainnet | Settings → Developer → Devnet |
| Faucet cooldown | Đợi ~30s rồi bấm nạp lại |

---

## An toàn

- Không bao giờ share **seed phrase** / private key.
- App **không** hỏi seed. Chỉ popup Approve giao dịch.
- Devnet SOL **không** chuyển sang Mainnet được.

Chi tiết kỹ thuật: `DEVNET.md`
