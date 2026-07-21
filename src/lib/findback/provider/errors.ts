export function friendlyError(raw: string) {
  const m = raw.toLowerCase();
  if (/request blocked|dapp could be malicious|blocked this request/i.test(raw))
    return "Phantom đã chặn giao dịch. Không chọn “Proceed anyway”. Hãy thử lại hoặc kiểm tra domain SafeReturn trong Phantom.";
  if (/user rejected|rejected the request|cancel/i.test(raw))
    return "Bạn đã hủy ký trong Phantom. Bấm lại nếu muốn tiếp tục.";
  if (/blockhash|expired|block height/i.test(m))
    return "Giao dịch đã hết hạn. Vui lòng thực hiện lại.";
  if (/insufficient|0x1|insufficient funds|no record of a prior/i.test(m))
    return "Thiếu SOL (phí mạng) hoặc thiếu FIND. Hãy chọn «Nhận tài sản thử nghiệm» ở đầu trang danh sách.";
  if (/already in use|already been processed|custom program error: 0x0/i.test(m))
    return "Mã tin đã tồn tại trên mạng. Vui lòng tạo tin mới.";
  if (/attempt to debit|insufficient lamports/i.test(m))
    return "Ví không đủ SOL trên mạng thử nghiệm. Nhận miễn phí tại faucet.solana.com (chọn Devnet).";
  if (/simulation failed|custom program error/i.test(m))
    return `Giao dịch không thành công trên hợp đồng: ${raw.slice(0, 180)}`;
  if (/failed to fetch|network|429|503/i.test(m))
    return "Mạng thử nghiệm đang bận. Đợi vài giây rồi thử lại.";
  return raw;
}
