import type { AiClaimReport, AiReviewInput } from "./types";

/**
 * SafeReturn AI review tools:
 * analyze_evidence, compare_item_description, detect_fraud_signals,
 * score_claim, explain_decision
 *
 * Uses a live OpenAI-compatible vision model. It never fabricates a local result.
 */

const SYSTEM = `You are SafeReturn AI, a careful lost-and-found claim reviewer.
Compare the owner's lost-item listing with the finder's claim and evidence.
Detect mismatches, spam, and possible fraud. Never approve fund release yourself.
Return ONLY valid JSON with keys:
score (0-100 number),
decision ("ACCEPT"|"REVIEW"|"REJECT"),
matching_features (string[]),
contradictions (string[]),
fraud_signals (string[]),
explanation (string),
confidence (0-1 number).
Be strict: ACCEPT only if strong multi-signal match and low fraud risk.
Human owner must still approve on-chain.
Write explanation and every array item in clear Vietnamese.`;

export async function runClaimReview(
  input: AiReviewInput
): Promise<AiClaimReport> {
  const config = getLiveAiConfig();
  if (!config) {
    throw new Error("AI trực tuyến chưa được cấu hình trên máy chủ.");
  }
  return callOpenAiCompatible(config, input);
}

export function hasLiveAiProvider() {
  return getLiveAiConfig() !== null;
}

type LiveAiConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  provider: "groq" | "openai-compatible";
};

function getLiveAiConfig(): LiveAiConfig | null {
  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (groqKey) {
    return {
      apiKey: groqKey,
      baseUrl: "https://api.groq.com/openai/v1",
      model: process.env.GROQ_MODEL?.trim() || "qwen/qwen3.6-27b",
      provider: "groq",
    };
  }

  const apiKey = (
    process.env.OPENAI_API_KEY || process.env.FIND_BACK_AI_KEY
  )?.trim();
  if (!apiKey) return null;
  const baseUrl =
    process.env.OPENAI_BASE_URL?.replace(/\/$/, "") ||
    "https://api.openai.com/v1";
  return {
    apiKey,
    baseUrl,
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    provider: baseUrl.includes("api.groq.com") ? "groq" : "openai-compatible",
  };
}

async function callOpenAiCompatible(
  config: LiveAiConfig,
  input: AiReviewInput
): Promise<AiClaimReport> {
  const userText = [
    `Owner title: ${input.ownerTitle}`,
    `Owner description: ${input.ownerDescription}`,
    `Owner category: ${input.ownerCategory ?? "n/a"}`,
    `Owner location: ${input.ownerLocation ?? "n/a"}`,
    `Finder description: ${input.finderDescription}`,
    `Finder location: ${input.finderLocation ?? "n/a"}`,
    `Finder found at: ${input.finderFoundAt ?? "n/a"}`,
    `Bounty id: ${input.bountyId ?? "n/a"}`,
  ].join("\n");

  type ContentPart =
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } };

  const content: ContentPart[] = [{ type: "text", text: userText }];
  if (input.ownerImageDataUrl?.startsWith("data:")) {
    content.push({
      type: "image_url",
      image_url: { url: input.ownerImageDataUrl },
    });
  }
  if (input.finderImageDataUrl?.startsWith("data:")) {
    content.push({
      type: "image_url",
      image_url: { url: input.finderImageDataUrl },
    });
  }

  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content },
      ],
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI HTTP ${res.status}: ${t.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = json.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as Partial<AiClaimReport>;

  const decision =
    parsed.decision === "ACCEPT" ||
    parsed.decision === "REJECT" ||
    parsed.decision === "REVIEW"
      ? parsed.decision
      : "REVIEW";

  const score = clampNum(Number(parsed.score ?? 50), 0, 100);

  return {
    score,
    decision,
    matching_features: arr(parsed.matching_features),
    contradictions: arr(parsed.contradictions),
    fraud_signals: arr(parsed.fraud_signals),
    explanation: String(
      parsed.explanation ||
        "AI reviewed the claim. Owner approval still required."
    ),
    confidence: clampNum(Number(parsed.confidence ?? 0.6), 0, 1),
    mode: "live",
    model: config.model,
    provider: config.provider,
  };
}

function arr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(String).filter(Boolean).slice(0, 12);
}

function clampNum(n: number, lo: number, hi: number) {
  if (Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Buffer.from(hash).toString("hex");
}

export async function sha256Bytes(text: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(hash);
}
