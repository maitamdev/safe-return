import type { AiClaimReport, AiReviewInput } from "./types";

/** Deterministic heuristic scorer used when no LLM key is set (labeled Demo mode). */
export function heuristicScore(input: AiReviewInput): AiClaimReport {
  const matching: string[] = [];
  const contradictions: string[] = [];
  const fraud: string[] = [];

  const o = normalize(
    `${input.ownerTitle} ${input.ownerDescription} ${input.ownerCategory ?? ""}`
  );
  const f = normalize(
    `${input.finderDescription} ${input.finderLocation ?? ""}`
  );

  const colors = [
    "black",
    "white",
    "blue",
    "red",
    "green",
    "silver",
    "gray",
    "grey",
    "gold",
    "pink",
    "đen",
    "trắng",
    "xanh",
    "đỏ",
    "bạc",
    "vàng",
  ];
  const brands = [
    "apple",
    "samsung",
    "dell",
    "hp",
    "lenovo",
    "sony",
    "airpods",
    "macbook",
    "iphone",
    "asus",
    "nike",
    "adidas",
  ];
  const items = [
    "laptop",
    "phone",
    "ví",
    "wallet",
    "thẻ",
    "card",
    "airpods",
    "tai nghe",
    "backpack",
    "balo",
    "keys",
    "chìa",
  ];

  let score = 42;

  for (const c of colors) {
    if (o.includes(c) && f.includes(c)) {
      matching.push(`Màu sắc trùng khớp: “${c}”`);
      score += 8;
    }
  }
  for (const b of brands) {
    if (o.includes(b) && f.includes(b)) {
      matching.push(`Thương hiệu hoặc mẫu trùng khớp: “${b}”`);
      score += 12;
    }
  }
  for (const it of items) {
    if (o.includes(it) && f.includes(it)) {
      matching.push(`Cùng loại đồ: “${it}”`);
      score += 10;
    }
  }

  // Token overlap
  const oTokens = new Set(o.split(/\s+/).filter((t) => t.length > 3));
  const fTokens = f.split(/\s+/).filter((t) => t.length > 3);
  let overlap = 0;
  for (const t of fTokens) {
    if (oTokens.has(t)) overlap++;
  }
  if (overlap >= 3) {
    matching.push(`Mô tả có ${overlap} từ khóa chung`);
    score += Math.min(18, overlap * 3);
  }

  // Location
  const ol = normalize(input.ownerLocation ?? "");
  const fl = normalize(input.finderLocation ?? "");
  if (ol && fl) {
    if (ol.includes(fl) || fl.includes(ol) || shareToken(ol, fl)) {
      matching.push("Địa điểm tìm thấy phù hợp khu vực báo mất");
      score += 8;
    } else {
      contradictions.push("Địa điểm tìm thấy khác khu vực báo mất");
      score -= 10;
    }
  }

  if (!input.finderImageDataUrl && !input.ownerImageDataUrl) {
    fraud.push("Không có ảnh bằng chứng, mức rủi ro giả mạo cao hơn");
    score -= 8;
  } else if (input.finderImageDataUrl) {
    matching.push("Người tìm đã cung cấp ảnh bằng chứng");
    score += 6;
  }

  if ((input.finderDescription ?? "").trim().length < 20) {
    contradictions.push("Mô tả của người tìm quá ngắn");
    score -= 6;
  }

  // Duplicate-ish spam: repeated chars
  if (/(.)\1{6,}/.test(input.finderDescription ?? "")) {
    fraud.push("Nội dung claim có ký tự lặp bất thường");
    score -= 15;
  }

  score = clamp(score, 5, 98);

  let decision: AiClaimReport["decision"] = "REVIEW";
  if (score >= 80 && fraud.length === 0) decision = "ACCEPT";
  else if (score < 45 || fraud.length >= 2) decision = "REJECT";

  const explanation = [
    `Bộ quy tắc chấm claim ${score}/100 (${decision}).`,
    matching.length
      ? `Điểm phù hợp: ${matching.slice(0, 3).join("; ")}.`
      : "Chưa có nhiều điểm trùng khớp rõ ràng giữa tin và claim.",
    contradictions.length
      ? `Điểm cần kiểm tra: ${contradictions.join("; ")}.`
      : "Không phát hiện mâu thuẫn lớn.",
    fraud.length
      ? `Tín hiệu rủi ro: ${fraud.join("; ")}.`
      : "Không phát hiện tín hiệu gian lận rõ ràng.",
    "Đây chỉ là khuyến nghị. Chủ bounty phải tự phê duyệt trước khi giải ngân.",
  ].join(" ");

  return {
    score,
    decision,
    matching_features: matching,
    contradictions,
    fraud_signals: fraud,
    explanation,
    confidence: clamp(0.35 + matching.length * 0.08 - fraud.length * 0.1, 0.2, 0.85),
    mode: "heuristic",
    model: "findback-heuristic-v1",
  };
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9àáạảãâăèéẹẻẽêìíịỉĩòóọỏõôơùúụủũưỳýỵỷỹđ\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function shareToken(a: string, b: string) {
  const as = new Set(a.split(" ").filter((t) => t.length > 3));
  return b.split(" ").some((t) => t.length > 3 && as.has(t));
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}
