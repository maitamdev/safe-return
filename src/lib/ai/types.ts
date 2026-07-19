export type AiDecision = "ACCEPT" | "REVIEW" | "REJECT";

export type AiClaimReport = {
  score: number; // 0-100
  decision: AiDecision;
  matching_features: string[];
  contradictions: string[];
  fraud_signals: string[];
  explanation: string;
  confidence: number; // 0-1
  evidence_quality?: "image-backed" | "partial-image" | "text-only";
  evidence_notes?: string[];
  mode: "live";
  model?: string;
  provider?: "groq" | "openai-compatible";
};

export type AiReviewInput = {
  ownerTitle: string;
  ownerDescription: string;
  ownerCategory?: string;
  ownerLocation?: string;
  ownerImageDataUrl?: string | null;
  finderDescription: string;
  finderLocation?: string;
  finderFoundAt?: string;
  finderImageDataUrl?: string | null;
  bountyId?: string;
};

export function decisionToU8(d: AiDecision): number {
  if (d === "ACCEPT") return 0;
  if (d === "REJECT") return 2;
  return 1;
}

export function riskToU8(report: AiClaimReport): number {
  if (report.fraud_signals.length >= 2 || report.score < 40) return 2;
  if (report.fraud_signals.length >= 1 || report.score < 70) return 1;
  return 0;
}
