# SafeReturn

SafeReturn là ứng dụng tìm đồ thất lạc dùng AI để hỗ trợ đối chiếu bằng chứng và Solana Devnet để khóa, hoàn hoặc trao thưởng minh bạch. Dự án không dùng dữ liệu bounty giả và không dùng tiền thật.

## Luồng sản phẩm

1. Người dùng đăng nhập và ký tin nhắn để liên kết tài khoản với ví Phantom.
2. Chủ đồ tạo bounty, ký `create_bounty` và khóa FIND vào escrow PDA.
3. Finder nộp bằng chứng, ký `submit_claim` trên Devnet.
4. Server dùng AI trực tuyến để đánh giá; arbiter ký `record_ai_review`.
5. Chủ đồ chấp nhận/từ chối, hoặc hai bên mở tranh chấp để arbiter phân xử on-chain.

FIND là SPL token thử nghiệm trên Devnet, không có giá trị tiền tệ. SOL Devnet chỉ dùng trả phí giao dịch thử nghiệm.

## Chạy local

Yêu cầu Node.js 20+, npm và Phantom có bật Testnet Mode.

```bash
npm install
copy .env.example .env.local
npm run dev
```

Sau khi tạo Supabase project:

1. Chạy toàn bộ [`supabase/schema.sql`](supabase/schema.sql) trong SQL Editor.
2. Điền URL, anon key và service-role key vào `.env.local`.
3. Thêm `SOLANA_KEYPAIR_JSON` của đúng arbiter/mint authority vào môi trường server.
4. Thêm `OPENAI_API_KEY` để bật đánh giá AI trực tuyến. Khi thiếu key, hệ thống báo chưa cấu hình và không sinh kết quả thay thế.
5. Không commit `.env.local` hoặc keypair.

Supabase là nguồn metadata duy nhất. Giao diện đăng ký thay đổi Realtime cho `bounties` và `claims`, đồng thời đọc lại dữ liệu định kỳ nếu kết nối Realtime gián đoạn. Trạng thái tiền và quyền giải ngân luôn được đối chiếu với program trên Solana Devnet.

`NEXT_PUBLIC_SITE_URL` phải là origin thật khi deploy để metadata và link chia sẻ được tạo đúng.

## Kiểm tra

```bash
npm run lint
npm test
npm run build
cargo test -p findback
```

Smoke test Devnet có tạo giao dịch thật trên mạng thử nghiệm:

```bash
npm run findback:smoke
```

## Cấu trúc chính

- `src/app/bounties`: giao diện sản phẩm
- `src/app/api`: API xác minh ví, AI và faucet Devnet
- `src/lib/findback`: client Solana và state provider
- `programs/findback`: Anchor escrow program
- `supabase/schema.sql`: schema, RLS và RPC bảo mật
- `.github/workflows/ci.yml`: lint, test, build và Rust test

Program Devnet: `3hLzzJDHvbuKFPKweKEJ3ZAQEijoLLejkvi9ZPmByWna`
FIND mint Devnet: `9F6hBVk5V6HgdcRCsgApoGLU2n68qTYjHKESBoCKRmCy`

## Lưu ý triển khai

Thay đổi trong `programs/findback` chỉ có hiệu lực sau khi build và upgrade program Devnet bằng upgrade authority. Thay đổi schema chỉ có hiệu lực sau khi chạy SQL migration. Không dùng keypair chứa tài sản Mainnet.

MIT License — xem [`LICENSE`](LICENSE).
