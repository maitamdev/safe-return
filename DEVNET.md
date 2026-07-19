# SafeReturn trên Solana Devnet

SafeReturn chỉ hỗ trợ Devnet trong bản hackathon. FIND và SOL Devnet đều là tài sản thử nghiệm, không có giá trị thật.

## Thiết lập người dùng

1. Cài Phantom và bật `Settings → Developer Settings → Testnet Mode`.
2. Chọn Devnet, đăng nhập SafeReturn và kết nối ví.
3. Bấm `Xác minh ví`; thao tác này chỉ ký tin nhắn, không tốn SOL.
4. Dùng thẻ `Chuẩn bị ví thử nghiệm` để nhận tối đa 100 FIND và một ít SOL Devnet.
5. Mọi giao dịch đều có link Solana Explorer để kiểm tra.

Không nhập seed phrase vào website. Không dùng ví Mainnet có tài sản thật để demo.

## Thiết lập nhà phát triển

Các biến bắt buộc nằm trong [`.env.example`](.env.example). Server keypair phải đồng thời là arbiter của bounty và mint authority của FIND. Faucet chỉ cấp cho ví đã được người dùng chứng minh bằng chữ ký và chỉ bù số dư đến ngưỡng 100 FIND.

Để build/upgrade smart contract:

```bash
npm run findback:deploy
npm run findback:setup
npm run findback:smoke
```

Các lệnh deploy/upgrade tạo thay đổi bên ngoài và phải dùng đúng upgrade authority.
