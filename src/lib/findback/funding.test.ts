import { describe, expect, it } from "vitest";
import { formatFundingSuccess } from "./funding";

describe("formatFundingSuccess", () => {
  it("reports the existing balance instead of saying zero tokens were issued", () => {
    expect(
      formatFundingSuccess({
        sol: { note: "Ví đã có đủ SOL để trả phí Devnet." },
        find: { amount: 0, balance: 300 },
      })
    ).toBe(
      "Ví đã có đủ SOL để trả phí Devnet. Ví đã có 300 FIND Devnet, không cấp thêm."
    );
  });

  it("reports both the minted amount and resulting balance", () => {
    expect(
      formatFundingSuccess({
        find: { amount: 75, balance: 100 },
      })
    ).toBe("Đã cấp thêm 75 FIND Devnet. Số dư hiện tại là 100 FIND.");
  });

  it("uses the authoritative server note when supplied", () => {
    expect(
      formatFundingSuccess({
        sol: { note: "SOL đã sẵn sàng." },
        find: {
          amount: 0,
          balance: 300,
          skipped: true,
          note: "Ví hiện có 300 FIND Devnet, không mint thêm.",
        },
      })
    ).toBe(
      "SOL đã sẵn sàng. Ví hiện có 300 FIND Devnet, không mint thêm."
    );
  });
});
