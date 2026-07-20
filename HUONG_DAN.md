# Hướng dẫn sử dụng SafeReturn trên Devnet

SafeReturn dùng giao dịch thật trên Solana Devnet nhưng chỉ dùng SOL/FIND thử nghiệm, không có giá trị tiền tệ.

## Chuẩn bị lần đầu

1. Đăng ký hoặc đăng nhập tài khoản.
2. Kết nối Phantom, chuyển sang Solana Devnet và ký thông điệp xác minh quyền sở hữu ví.
3. Chọn **Chuẩn bị ví Devnet** để kiểm tra SOL phí mạng và nhận FIND thử nghiệm nếu số dư chưa đủ.
4. Không nhập seed phrase hoặc private key vào website.

## Đăng tin mất đồ

1. Chọn **Tạo tin** và điền thông tin thật, địa điểm, hạn nhận claim và phần thưởng FIND.
2. Có thể tải ảnh JPEG/PNG/WebP. Ảnh được lưu riêng tư; hash SHA-256 của ảnh là một phần của metadata hash trên chain.
3. Kiểm tra màn hình xác nhận rồi ký giao dịch tạo bounty và khóa thưởng vào escrow.
4. Mở liên kết Explorer từ thông báo thành công để kiểm tra transaction.

## Gửi bằng chứng tìm thấy

1. Dùng tài khoản và ví finder khác với chủ bounty.
2. Mở tin, chọn **Tôi tìm thấy đồ này**, nhập mô tả chỉ chủ tin/arbiter được xem và tải ảnh bằng chứng nếu có.
3. Ký claim. Mỗi finder nhận một Claim PDA riêng nên nhiều người có thể gửi bằng chứng độc lập.
4. Sau khi đồng bộ, AI trực tuyến đánh giá bằng chứng và ghi provenance hash lên Devnet; AI chỉ hỗ trợ quyết định, không tự giữ hay giải ngân tiền.

## Hoàn tất hoặc tranh chấp

- Chủ đồ chọn đúng claim để từ chối hoặc chấp nhận. Khi chấp nhận, vault chuyển FIND cho finder và tạo attestation/reputation.
- Nếu có tranh chấp, mở case và dùng hội đồng 2/3 arbiter. Mỗi phiếu là account on-chain độc lập; đủ quorum mới được finalize.
- Bounty hết hạn mà chưa giải ngân có thể hoàn FIND về chủ theo state machine của program.

## SafeTag QR

1. Vào **Của tôi → SafeTag QR** và tạo một tag cho từng món đồ.
2. In QR và dán lên đồ vật.
3. Người nhặt quét `/t/{code}` để gửi liên hệ và vị trí; họ không nhìn thấy danh tính hay wallet của chủ đồ.
4. Chỉ chủ tag đã đăng nhập mới xem và đánh dấu báo cáo đã xử lý.

## Khi gặp lỗi

- `429 Too many requests`: chờ vài giây; ứng dụng tự retry và giữ nguyên giao dịch đã ký để không thanh toán trùng.
- `JWT issued at future`: đăng xuất/đăng nhập lại; ứng dụng sẽ thử làm mới rồi xóa session lỗi.
- Không thấy transaction: mở Explorer Devnet từ liên kết trong ứng dụng và kiểm tra đúng wallet/network.
- Không bỏ qua cảnh báo bảo mật của Phantom. Không dùng Mainnet cho dự án này.
