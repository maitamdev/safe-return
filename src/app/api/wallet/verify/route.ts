import { createHash } from "node:crypto";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { PublicKey } from "@solana/web3.js";
import { ARBITER } from "@/lib/findback/config";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ApiError,
  apiErrorResponse,
  enforceApiRateLimit,
  requireApiUser,
  requireSameOrigin,
} from "@/lib/server/api-security";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    requireSameOrigin(req);
    const user = await requireApiUser();
    const admin = createAdminClient();
    await enforceApiRateLimit(
      `wallet-verify:${user.id}`,
      { limit: 10, windowMs: 60_000 },
      admin,
    );
    const body = (await req.json()) as {
      address?: string;
      message?: string;
      signature?: string;
    };
    const publicKey = new PublicKey(body.address?.trim() || "");
    const message = body.message || "";
    if (!message.includes(`Wallet: ${publicKey.toBase58()}`) || !message.includes(`Account: ${user.id}`)) {
      throw new ApiError(400, "Nội dung xác minh không hợp lệ.");
    }
    const { data: profile, error: readError } = await admin
      .from("profiles")
      .select("wallet_nonce_hash,wallet_nonce_expires_at")
      .eq("id", user.id)
      .maybeSingle();
    if (readError) throw new Error(readError.message);

    const hash = createHash("sha256").update(message).digest("hex");
    if (!profile?.wallet_nonce_hash || profile.wallet_nonce_hash !== hash) {
      throw new ApiError(400, "Thử thách đã thay đổi hoặc đã được sử dụng.");
    }
    if (!profile.wallet_nonce_expires_at || Date.parse(profile.wallet_nonce_expires_at) <= Date.now()) {
      throw new ApiError(400, "Thử thách đã hết hạn. Hãy xác minh lại.");
    }

    let signature: Uint8Array;
    try {
      signature = bs58.decode(body.signature || "");
    } catch {
      throw new ApiError(400, "Chữ ký không hợp lệ.");
    }
    const verified = nacl.sign.detached.verify(
      new TextEncoder().encode(message),
      signature,
      publicKey.toBytes()
    );
    if (!verified) throw new ApiError(401, "Ví không xác nhận đúng chữ ký.");

    const { error: updateError } = await admin
      .from("profiles")
      .update({
        wallet_pubkey: publicKey.toBase58(),
        wallet_verified_at: new Date().toISOString(),
        is_arbiter: publicKey.toBase58() === ARBITER,
        wallet_nonce_hash: null,
        wallet_nonce_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    if (updateError) {
      if (updateError.code === "23505") {
        throw new ApiError(409, "Ví này đã được liên kết với tài khoản khác.");
      }
      throw new Error(updateError.message);
    }

    return Response.json({ ok: true, address: publicKey.toBase58(), verifiedAt: new Date().toISOString() });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
