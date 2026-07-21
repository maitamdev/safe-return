  export function friendlyError(raw: string) {
    const m = raw.toLowerCase();
    if (/request blocked|dapp could be malicious|blocked this request/i.test(raw))
      return "Phantom đã chặn nhầm giao dịch dù Devnet preflight thành công. Không chọn “Proceed anyway”; domain SafeReturn cần được Phantom duyệt lại.";
    if (/user rejected|rejected the request|cancel/i.test(raw))
      return "Bạn đã hủy ký trong Phantom. Bấm lại nếu muốn tiếp tục.";
    if (/blockhash|expired|block height/i.test(m))
      return "Giao dịch hết hạn. Hãy bấm lại lần nữa.";
    if (/insufficient|0x1|insufficient funds|no record of a prior/i.test(m))
      return "Thiếu SOL (phí) hoặc thiếu FIND. Bấm «Nhận 100 FIND» ở trang Browse.";
    if (/already in use|already been processed|custom program error: 0x0/i.test(m))
      return "Bounty id đã tồn tại on-chain. Tạo bounty mới (id khác).";
    if (/attempt to debit|insufficient lamports/i.test(m))
      return "Ví không đủ SOL Devnet. Lấy free tại faucet.solana.com (Devnet).";
    if (/simulation failed|custom program error/i.test(m))
      return `Lỗi smart contract: ${raw.slice(0, 180)}`;
    if (/failed to fetch|network|429|503/i.test(m))
      return "RPC Devnet đang bận. Đợi vài giây rồi thử lại.";
    return raw;
  }
