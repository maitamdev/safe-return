# FindBack AI — Hướng dẫn demo thi

## Câu slide

**EN:** FindBack AI uses AI to verify lost-item claims and Solana escrow to guarantee transparent rewards.

**VI:** FindBack AI dùng AI để xác minh người tìm thấy đồ và dùng Solana escrow để đảm bảo tiền thưởng được trao minh bạch, đúng người.

---

## Trước khi demo (1 lần)

### 1. Phantom
1. Cài https://phantom.app/download  
2. Settings → Developer → **Testnet Mode** → **Devnet**  
3. Copy địa chỉ ví  

### 2. SOL Devnet (phí gas)
https://faucet.solana.com → Devnet → dán địa chỉ  

### 3. FIND test token
Sau khi team chạy `npm run findback:setup`:

- Mint nằm trong `.env.local` → `NEXT_PUBLIC_FIND_MINT`
- Phantom → Manage token list → **Import** mint  
- Nhờ deployer mint FIND vào ví bạn:  
  `npm run findback:setup -- <ĐỊA_CHỈ_PHANTOM>`

> FIND **không phải** USDC thật — chỉ token test trên Devnet.

### 4. AI (tuỳ chọn, xịn hơn)
Thêm vào `.env.local` (máy local / Vercel secret):

```
OPENAI_API_KEY=sk-...
```

Không có key → AI chạy **Demo mode (heuristic)** — vẫn có score + giải thích, UI ghi rõ.

---

## Demo 3 phút

1. Mở `/bounties`  
2. **Connect Wallet** (Phantom Devnet)  
3. **Create bounty** → laptop / 50 FIND → ký 2 tx (create + fund)  
4. Ví finder (hoặc trình duyệt khác) → bounty → **Submit claim** + ảnh  
5. Xem **AI Review** (score, matching, fraud)  
6. Ví owner → **Owner Approve & Release** → ký  
7. Bấm link **Explorer** — signature thật, `cluster=devnet`  
8. (Tuỳ chọn) bounty hết hạn → **Refund after expiry**

---

## Link kỹ thuật

| | |
|--|--|
| App bounties | `/bounties` |
| Program | `3hLzzJDHvbuKFPKweKEJ3ZAQEijoLLejkvi9ZPmByWna` |
| Explorer program | https://explorer.solana.com/address/3hLzzJDHvbuKFPKweKEJ3ZAQEijoLLejkvi9ZPmByWna?cluster=devnet |

## Lệnh dev

```powershell
cd d:\HACKATHON\safereturn
npm install
npm run findback:deploy
npm run findback:setup
npm run findback:smoke
npm run dev
```

## Điểm nhấn giám khảo

1. AI **phân tích** claim, không chatbot suông  
2. AI **không** tự chuyển tiền  
3. Escrow Solana + tx Explorer thật  
4. FIND ghi rõ là test token  
