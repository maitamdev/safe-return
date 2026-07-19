export type DevnetFundResult = {
  ok?: boolean;
  error?: string;
  message?: string;
  sol?: {
    claimed?: boolean;
    explorerUrl?: string | null;
    note?: string;
  };
  find?: {
    amount?: number;
    balance?: number;
    skipped?: boolean;
    note?: string;
    signature?: string;
    explorerUrl?: string;
  };
};

export function formatFundingSuccess(
  result: DevnetFundResult,
  symbol = "FIND"
) {
  const amount = result.find?.amount ?? 0;
  const balance = result.find?.balance;
  const noMint = result.find?.skipped === true || amount <= 0;

  const findNote = result.find?.note
    ? result.find.note
    : noMint
      ? balance !== undefined
        ? `Ví đã có ${formatTokenAmount(balance)} ${symbol} Devnet, không cấp thêm.`
        : `Ví đã có đủ ${symbol} Devnet, không cấp thêm.`
      : `Đã cấp thêm ${formatTokenAmount(amount)} ${symbol} Devnet${
          balance !== undefined
            ? `. Số dư hiện tại là ${formatTokenAmount(balance)} ${symbol}`
            : ""
        }.`;

  return [result.sol?.note, findNote].filter(Boolean).join(" ");
}

function formatTokenAmount(amount: number) {
  return amount.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
}
