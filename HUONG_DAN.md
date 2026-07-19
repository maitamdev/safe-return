# FindBack AI — Làm theo từng bước (tiếng Việt)

Bạn **không cần** hiểu blockchain. Chỉ làm đúng thứ tự dưới đây.

---

## App mở ở đâu?

**Production:** https://safereturn-delta.vercel.app/bounties  

Hoặc máy bạn:

```powershell
cd d:\HACKATHON\safereturn
npm install
npm run dev
```

→ http://localhost:3000/bounties

---

## Phantom báo đỏ «Yêu cầu đã bị chặn»?

**Không phải app hỏng.** Phantom chặn site mới / domain Vercel.

1. Bấm **«Vẫn tiếp tục (không an toàn)»**  
2. Rồi **Connect**  

Chỉ làm vậy với site **của bạn** (`safereturn-delta.vercel.app` hoặc `localhost`).

---

## 3 bước dùng app

### Bước 1 — Phantom Devnet

1. Cài https://phantom.app/download  
2. Phantom → ⚙️ Settings → **Developer Settings**  
3. Bật **Testnet Mode** → chọn **Devnet**  
4. Trên web FindBack → **Kết nối ví**

### Bước 2 — Nhận FIND (tiền ảo)

Trên trang `/bounties` có khung **«Bắt đầu tại đây»**:

1. Bấm **Nhận 100 FIND**  
2. Phantom → Manage token list → **Import** mint:

```
9F6hBVk5V6HgdcRCsgApoGLU2n68qTYjHKESBoCKRmCy
```

3. Refresh Phantom — thấy FIND  

> FIND = token **test** Devnet, **0đ thật**, không phải USDC.

Thiếu SOL (phí gas): https://faucet.solana.com → Devnet → dán địa chỉ ví.

### Bước 3 — Demo thật

1. **Tạo bounty** (không bấm card «Mẫu»)  
2. Phantom **Approve** 2 lần (create + fund)  
3. (Tuỳ) ví khác → mở bounty → **Gửi claim**  
4. Xem điểm AI  
5. Owner → **Owner Approve & Release**  
6. Bấm link **Explorer** — đó là giao dịch thật  

---

## Card «Mẫu (chưa on-chain)» là gì?

Chỉ để **xem giao diện**.  
**Không** khóa tiền, **không** claim on-chain được.  

Muốn tx thật → luôn **Tạo bounty**.

---

## Lỗi thường gặp

| Bạn thấy | Làm gì |
|----------|--------|
| Phantom chặn đỏ | «Vẫn tiếp tục» |
| Thiếu FIND / insufficient | Nhận 100 FIND + import mint |
| Simulation failed | Đang Devnet? Đã fund bounty? |
| Seed / mẫu | Tạo bounty mới |
| AI Demo mode | Bình thường nếu chưa có OPENAI_API_KEY |

---

## Câu slide

> FindBack AI dùng AI để xác minh claim và Solana escrow để trao thưởng minh bạch.

---

## Link kỹ thuật

| | |
|--|--|
| App | https://safereturn-delta.vercel.app/bounties |
| Program | https://explorer.solana.com/address/3hLzzJDHvbuKFPKweKEJ3ZAQEijoLLejkvi9ZPmByWna?cluster=devnet |
| FIND mint | `9F6hBVk5V6HgdcRCsgApoGLU2n68qTYjHKESBoCKRmCy` |
