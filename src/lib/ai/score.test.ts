import { describe, expect, it } from "vitest";
import { heuristicScore } from "./score";

describe("heuristic claim review", () => {
  it("rewards a detailed multi-signal match", () => {
    const report = heuristicScore({
      ownerTitle: "Balo Adidas màu đen",
      ownerDescription: "Balo đen Adidas có móc khóa bạc, mất ở thư viện trung tâm",
      ownerCategory: "Balo",
      ownerLocation: "Thư viện trung tâm",
      finderDescription: "Tôi tìm thấy balo Adidas màu đen có móc khóa bạc ở thư viện trung tâm",
      finderLocation: "Thư viện trung tâm",
      finderImageDataUrl: "data:image/jpeg;base64,test",
    });
    expect(report.score).toBeGreaterThanOrEqual(70);
    expect(report.matching_features.length).toBeGreaterThan(2);
    expect(report.mode).toBe("heuristic");
  });

  it("flags short spam without evidence", () => {
    const report = heuristicScore({
      ownerTitle: "iPhone xanh",
      ownerDescription: "Mất điện thoại ở cổng trường",
      finderDescription: "aaaaaaa",
    });
    expect(report.fraud_signals.length).toBeGreaterThan(0);
    expect(report.decision).not.toBe("ACCEPT");
  });
});
