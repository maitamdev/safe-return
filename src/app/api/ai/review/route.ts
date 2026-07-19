import { NextResponse } from "next/server";
import { runClaimReview, sha256Hex } from "@/lib/ai/agent";
import type { AiReviewInput } from "@/lib/ai/types";

export const runtime = "nodejs";

const MAX_IMAGE = 1_200_000; // ~1.2MB data URL

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AiReviewInput;

    if (!body.ownerTitle?.trim() || !body.finderDescription?.trim()) {
      return NextResponse.json(
        { error: "ownerTitle and finderDescription are required" },
        { status: 400 }
      );
    }

    if (
      body.finderImageDataUrl &&
      body.finderImageDataUrl.length > MAX_IMAGE
    ) {
      return NextResponse.json(
        { error: "Finder image too large (max ~1MB)" },
        { status: 400 }
      );
    }
    if (body.ownerImageDataUrl && body.ownerImageDataUrl.length > MAX_IMAGE) {
      return NextResponse.json(
        { error: "Owner image too large (max ~1MB)" },
        { status: 400 }
      );
    }

    const report = await runClaimReview({
      ownerTitle: body.ownerTitle.slice(0, 200),
      ownerDescription: (body.ownerDescription || "").slice(0, 2000),
      ownerCategory: body.ownerCategory?.slice(0, 80),
      ownerLocation: body.ownerLocation?.slice(0, 200),
      ownerImageDataUrl: body.ownerImageDataUrl,
      finderDescription: body.finderDescription.slice(0, 2000),
      finderLocation: body.finderLocation?.slice(0, 200),
      finderFoundAt: body.finderFoundAt?.slice(0, 80),
      finderImageDataUrl: body.finderImageDataUrl,
      bountyId: body.bountyId?.slice(0, 32),
    });

    const reportJson = JSON.stringify(report);
    const explanationHashHex = await sha256Hex(reportJson);

    return NextResponse.json({
      report,
      explanationHashHex,
      note:
        report.mode === "heuristic"
          ? "Demo mode: heuristic AI (set OPENAI_API_KEY for live vision+LLM)."
          : "Live AI review. Owner approval still required on-chain.",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI review failed" },
      { status: 500 }
    );
  }
}
