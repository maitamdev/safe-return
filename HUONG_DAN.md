# Hướng dẫn demo SafeReturn

## Chuẩn bị

- Chạy `supabase/schema.sql` trong Supabase.
- Cấu hình các biến trong `.env.example`.
- Bật Devnet trong Phantom và dùng ví thử nghiệm.

## Kịch bản demo

1. Đăng nhập, kết nối và xác minh ví owner.
2. Nhận FIND/SOL Devnet từ mục chuẩn bị ví.
3. Tạo tin; ký hai giao dịch `create_bounty` và `fund_bounty`.
4. Dùng tài khoản và ví finder khác để gửi claim.
5. Quan sát AI report và chữ ký arbiter trên Explorer.
6. Quay lại owner để chấp nhận/từ chối; hoặc mở tranh chấp.
7. Với ví arbiter, mở `/bounties/arbitration` để trả FIND cho finder hoặc hoàn owner.

Không bỏ qua cảnh báo của Phantom, không chia sẻ seed phrase và không dùng Mainnet cho bản demo.
