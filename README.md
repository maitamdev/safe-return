# SafeReturn

SafeReturn là dApp tìm đồ thất lạc chạy với dữ liệu người dùng thật, Supabase Realtime và Solana Devnet. Ứng dụng không chèn bounty/claim mẫu, không dùng Mainnet và không dùng tài sản có giá trị tiền tệ. FIND chỉ là SPL token thử nghiệm để minh họa escrow.

## Điểm nổi bật

- Metadata và ảnh riêng tư nằm trong Supabase Storage; SHA-256 của nội dung được cam kết trên Solana để phát hiện thay đổi.
- Mỗi finder có một `ClaimV2` PDA độc lập, nên một bounty nhận được nhiều claim mà không ghi đè lẫn nhau.
- FIND được khóa trong vault PDA; program kiểm soát state machine, hoàn tiền, giải ngân và tranh chấp.
- Groq Vision tạo đánh giá trực tuyến. Chain lưu hash của input, report, model và phiên bản prompt để truy xuất provenance; thiếu provider thì API báo lỗi, không sinh kết quả giả.
- `ReturnAttestation` và `Reputation` ghi nhận lần trao trả thành công on-chain.
- SafeTag tạo QR công khai nhưng chỉ chủ sở hữu đã đăng nhập mới đọc được thông tin liên hệ do finder gửi.
- Phí Devnet có thể được tài trợ bằng một signer tách biệt, có quota và biên nhận trong Supabase.

## Kiến trúc tin cậy

Solana Devnet là nguồn sự thật của tiền, trạng thái escrow, claim và quyền giải ngân. Supabase là nguồn metadata, ảnh mã hóa quyền truy cập, tài khoản và dữ liệu Realtime. API server chỉ ghi Supabase sau khi đối chiếu wallet đã xác minh, transaction signature và account PDA trên Devnet.

## Chạy local

Yêu cầu Node.js 20+, npm, Solana CLI/Anchor khi build program và Phantom bật Testnet Mode.

```bash
npm install
copy .env.example .env.local
npm run dev
```

Với Supabase project mới, chạy `supabase/schema.sql` trước rồi áp dụng lần lượt các file trong `supabase/migrations`. Với project đang hoạt động, dùng migration runner:

1. Lấy PostgreSQL URI tại Supabase Dashboard → Connect.
2. Lưu URI vào `SUPABASE_DB_URL` trong `.env.local`; không gửi URI hoặc password qua chat và không đưa lên Vercel.
3. Chạy dry-run: `npm run supabase:push`.
4. Đặt tạm `CONFIRM_SUPABASE_MIGRATE=1` trong terminal rồi chạy lại.
5. Xóa `SUPABASE_DB_URL` khỏi máy khi không còn cần.

Runner chặn connection string không thuộc project được cấu hình, không in secret ra log và chỉ báo thành công khi API công khai đã đọc được schema protocol v2/SafeTag mới.

## Kiểm thử và release gate

```bash
npm run idl:check
npm run lint
npm run typecheck
npm test
npm run build
# hoặc gộp: npm run check
# E2E (cần build trước): npm run test:e2e  |  gộp: npm run check:full
cargo test -p findback
npm run findback:smoke
npm run release:check
```

`target/idl/findback.json` là hợp đồng client đã review — không xóa. CI và `npm run idl:check` sẽ fail nếu thiếu hoặc lệch program id.

`findback:smoke` tạo giao dịch thật trên Devnet với lượng FIND thử nghiệm rất nhỏ. Nó xác minh tương thích v1, ba claim v2 độc lập, AI provenance, từ chối mismatch, hội đồng 2/3, giải ngân đúng một lần, attestation, reputation và vault trở về 0.

Chỉ bật v2 khi lệnh sau không còn warning/failure:

```bash
npm run release:check:v2
```

Thứ tự release bắt buộc:

1. Build và upgrade program bằng `findback:deploy`; script dùng buffer có thể resume sau 429 và so khớp bytecode tải ngược từ chain.
2. Chạy smoke test Devnet.
3. Áp dụng migration Supabase và kiểm tra RLS/schema.
4. Bật `NEXT_PUBLIC_PROTOCOL_V2=1`.
5. Chỉ bật sponsored fee khi signer riêng và bảng quota đã sẵn sàng: `NEXT_PUBLIC_SPONSORED_FEES=1` cùng `SPONSORED_FEES_ENABLED=1`.
6. Redeploy rồi chạy lại release checker ở chế độ Production.

## Các thư mục chính

- `programs/findback`: Anchor escrow program và unit test Rust.
- `src/lib/findback`: client Solana, decoder account và state provider.
- `src/app/api`: API xác minh wallet, metadata, media, AI, SafeTag và tài trợ phí.
- `supabase/schema.sql`: schema nền và RLS.
- `supabase/migrations`: nâng cấp protocol v2, SafeTag và sponsored transactions.
- `scripts/check-release-readiness.mjs`: release gate không làm lộ secret.
- `scripts/smoke-findback.mjs`: bằng chứng tích hợp end-to-end trên Devnet.
- `e2e/`: Playwright smoke (landing, login, robots/sitemap/manifest).
- `src/lib/solana/rpc-endpoints.ts`: primary RPC + failover list.

Program Devnet: `3hLzzJDHvbuKFPKweKEJ3ZAQEijoLLejkvi9ZPmByWna`

FIND mint Devnet: `9F6hBVk5V6HgdcRCsgApoGLU2n68qTYjHKESBoCKRmCy`

Không dùng keypair chứa tài sản Mainnet. Không commit `.env.local`, database URI, service-role key hoặc keypair JSON.

## Bảo mật

Xem `SECURITY.md` (trust boundary, reporting, quy tắc vận hành Devnet).

MIT License — xem `LICENSE`.
