import { createHash, randomBytes } from "node:crypto";
import { PublicKey } from "@solana/web3.js";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  apiErrorResponse,
  enforceRateLimit,
  requireApiUser,
  requireSameOrigin,
} from "@/lib/server/api-security";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    requireSameOrigin(req);
    const user = await requireApiUser();
    enforceRateLimit(`wallet-challenge:${user.id}`, { limit: 8, windowMs: 60_000 });

    const body = (await req.json()) as { address?: string };
    const address = new PublicKey(body.address?.trim() || "").toBase58();
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + 5 * 60_000);
    const nonce = randomBytes(24).toString("hex");
    const host = new URL(req.url).host;
    const message = [
      "SafeReturn wallet verification",
      `Domain: ${host}`,
      `Wallet: ${address}`,
      `Account: ${user.id}`,
      `Nonce: ${nonce}`,
      `Issued at: ${issuedAt.toISOString()}`,
      "This signature is free and does not create a blockchain transaction.",
    ].join("\n");
    const challengeHash = createHash("sha256").update(message).digest("hex");

    const admin = createAdminClient();
    const { error } = await admin.from("profiles").upsert(
      {
        id: user.id,
        email: user.email ?? null,
        wallet_nonce_hash: challengeHash,
        wallet_nonce_expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
    if (error) throw new Error(`Không lưu được thử thách xác minh: ${error.message}`);

    return Response.json({ ok: true, message, expiresAt: expiresAt.toISOString() });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
