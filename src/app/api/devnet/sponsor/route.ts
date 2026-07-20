import { randomUUID } from "node:crypto";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import {
  createBountySponsoredInstruction,
  claimV2Pda,
  fetchBounty,
  fundBountySponsoredInstruction,
  getConnection,
  submitClaimV2SponsoredInstruction,
} from "@/lib/findback/program";
import { PROTOCOL_V2_ENABLED, toAtomic } from "@/lib/findback/config";
import {
  ApiError,
  apiErrorResponse,
  enforceRateLimit,
  requireApiUser,
  requireSameOrigin,
} from "@/lib/server/api-security";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadSponsorKeypair } from "@/lib/server/solana-signer";
import { withRpcReadRetry } from "@/lib/solana/rpc-read";

export const runtime = "nodejs";

type SponsorAction = "create_bounty" | "fund_bounty" | "submit_claim_v2";

type SponsorBody = {
  action?: SponsorAction;
  wallet?: string;
  bountyId?: string;
  rewardUi?: number;
  deadlineUnix?: number;
  metadataHashHex?: string;
  evidenceHashHex?: string;
};

export async function POST(req: Request) {
  try {
    requireSameOrigin(req);
    requireSponsorEnabled();
    const user = await requireApiUser();
    enforceRateLimit(`sponsor-prepare:${user.id}`, { limit: 12, windowMs: 60_000 });
    const body = (await req.json()) as SponsorBody;
    if (!body.action || !(["create_bounty", "fund_bounty", "submit_claim_v2"] as string[]).includes(body.action)) {
      throw new ApiError(400, "Thao tác tài trợ không hợp lệ.");
    }
    const bountyId = body.bountyId?.trim() || "";
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(bountyId)) {
      throw new ApiError(400, "Mã bounty không hợp lệ.");
    }
    let wallet: PublicKey;
    try {
      wallet = new PublicKey(body.wallet || "");
    } catch {
      throw new ApiError(400, "Địa chỉ ví không hợp lệ.");
    }

    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("wallet_pubkey,wallet_verified_at")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);
    if (!profile?.wallet_verified_at || profile.wallet_pubkey !== wallet.toBase58()) {
      throw new ApiError(403, "Ví yêu cầu tài trợ chưa được tài khoản này xác minh.");
    }

    const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    const { count, error: quotaError } = await admin
      .from("sponsored_transactions")
      .select("request_id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", since)
      .in("status", ["prepared", "submitted", "confirmed"]);
    if (quotaError) throw new Error(quotaError.message);
    if ((count || 0) >= 10) {
      throw new ApiError(429, "Bạn đã dùng hết 10 lượt tài trợ Devnet trong 24 giờ.");
    }

    const sponsor = loadSponsorKeypair();
    const connection = getConnection();
    const sponsorBalance = await withRpcReadRetry(() =>
      connection.getBalance(sponsor.publicKey, "confirmed"),
    );
    if (sponsorBalance < 20_000_000) {
      throw new ApiError(503, "Ví tài trợ Devnet đang thiếu SOL. Quản trị viên cần nạp faucet.");
    }

    const claimPda = body.action === "submit_claim_v2"
      ? await validateClaimRequest(bountyId, wallet, body.evidenceHashHex)
      : null;
    const instruction = body.action === "create_bounty"
      ? await createInstruction(bountyId, wallet, sponsor.publicKey, body)
      : body.action === "fund_bounty"
        ? await fundInstruction(bountyId, wallet, sponsor.publicKey)
        : submitClaimV2SponsoredInstruction({
            finder: wallet,
            sponsor: sponsor.publicKey,
            bountyId,
            evidenceHash: hex32(body.evidenceHashHex, "Hash bằng chứng"),
          });

    const { blockhash, lastValidBlockHeight } = await withRpcReadRetry(() =>
      connection.getLatestBlockhash("confirmed"),
    );
    const transaction = new Transaction({
      feePayer: sponsor.publicKey,
      blockhash,
      lastValidBlockHeight,
    }).add(instruction);
    transaction.partialSign(sponsor);
    const wire = transaction.serialize({ requireAllSignatures: false, verifySignatures: false });
    if (wire.length > 1232) throw new ApiError(500, "Giao dịch tài trợ vượt giới hạn Solana.");

    const simulation = await withRpcReadRetry(() =>
      connection.simulateTransaction(
        new VersionedTransaction(transaction.compileMessage()),
        { commitment: "confirmed", sigVerify: false },
      ),
    );
    if (simulation.value.err) {
      const details = simulation.value.logs?.slice(-5).join(" | ") || JSON.stringify(simulation.value.err);
      throw new ApiError(409, `Mô phỏng giao dịch tài trợ thất bại. ${details}`);
    }

    const requestId = randomUUID();
    const expiresAt = new Date(Date.now() + 90_000).toISOString();
    const { error: insertError } = await admin.from("sponsored_transactions").insert({
      request_id: requestId,
      user_id: user.id,
      wallet: wallet.toBase58(),
      sponsor: sponsor.publicKey.toBase58(),
      action: body.action,
      bounty_id: bountyId,
      blockhash,
      last_valid_block_height: lastValidBlockHeight,
      status: "prepared",
      expires_at: expiresAt,
    });
    if (insertError) throw new Error(insertError.message);

    return Response.json({
      ok: true,
      requestId,
      transaction: wire.toString("base64"),
      sponsor: sponsor.publicKey.toBase58(),
      blockhash,
      lastValidBlockHeight,
      expiresAt,
      claimPda,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(req: Request) {
  try {
    requireSameOrigin(req);
    requireSponsorEnabled();
    const user = await requireApiUser();
    const body = (await req.json()) as { requestId?: string; signature?: string };
    if (!body.requestId || !/^[1-9A-HJ-NP-Za-km-z]{64,100}$/.test(body.signature || "")) {
      throw new ApiError(400, "Biên nhận giao dịch tài trợ không hợp lệ.");
    }
    const admin = createAdminClient();
    const { data: prepared, error: readError } = await admin
      .from("sponsored_transactions")
      .select("request_id,expires_at")
      .eq("request_id", body.requestId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!prepared) throw new ApiError(404, "Không tìm thấy lượt tài trợ này.");

    const status = (await getConnection().getSignatureStatuses([body.signature!])).value[0];
    const confirmed = Boolean(status && !status.err && ["confirmed", "finalized"].includes(status.confirmationStatus || ""));
    const nextStatus = status?.err ? "failed" : confirmed ? "confirmed" : "submitted";
    const { error } = await admin
      .from("sponsored_transactions")
      .update({
        signature: body.signature,
        status: nextStatus,
        confirmed_at: confirmed ? new Date().toISOString() : null,
      })
      .eq("request_id", body.requestId)
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);
    return Response.json({ ok: true, status: nextStatus });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

async function createInstruction(
  bountyId: string,
  owner: PublicKey,
  sponsor: PublicKey,
  body: SponsorBody
) {
  if (await fetchBounty(bountyId)) throw new ApiError(409, "Bounty đã tồn tại trên Devnet.");
  const rewardUi = Number(body.rewardUi);
  const now = Math.floor(Date.now() / 1000);
  const deadlineUnix = Number(body.deadlineUnix);
  if (!Number.isFinite(rewardUi) || rewardUi <= 0 || rewardUi > 10_000) {
    throw new ApiError(400, "Phần thưởng tài trợ phải từ hơn 0 đến 10.000 FIND.");
  }
  if (!Number.isInteger(deadlineUnix) || deadlineUnix < now + 3600 || deadlineUnix > now + 60 * 86400) {
    throw new ApiError(400, "Hạn bounty tài trợ phải trong 60 ngày tới.");
  }
  return createBountySponsoredInstruction({
    owner,
    sponsor,
    bountyId,
    rewardAmount: toAtomic(rewardUi),
    deadlineUnix,
    metadataHash: hex32(body.metadataHashHex, "Hash metadata"),
  });
}

async function fundInstruction(bountyId: string, owner: PublicKey, sponsor: PublicKey) {
  const bounty = await fetchBounty(bountyId);
  if (!bounty || bounty.protocolVersion < 2) throw new ApiError(404, "Không tìm thấy bounty v2.");
  if (bounty.owner !== owner.toBase58()) throw new ApiError(403, "Ví không sở hữu bounty này.");
  if (!(["Draft", "Funded"] as string[]).includes(bounty.status)) {
    throw new ApiError(409, "Bounty không còn nhận tiền vào escrow.");
  }
  const remaining = bounty.rewardAmount - bounty.amountFunded;
  if (remaining <= BigInt(0)) throw new ApiError(409, "Escrow đã đủ phần thưởng.");
  return fundBountySponsoredInstruction({ owner, sponsor, bountyId, amount: remaining });
}

async function validateClaimRequest(bountyId: string, finder: PublicKey, hash?: string) {
  hex32(hash, "Hash bằng chứng");
  const bounty = await fetchBounty(bountyId);
  if (!bounty || bounty.protocolVersion < 2) throw new ApiError(404, "Không tìm thấy bounty v2.");
  if (bounty.status !== "Funded" || bounty.amountFunded < bounty.rewardAmount) {
    throw new ApiError(409, "Bounty chưa sẵn sàng nhận claim.");
  }
  if (bounty.owner === finder.toBase58()) throw new ApiError(409, "Chủ đồ không thể claim bounty của mình.");
  if (bounty.deadline < Math.floor(Date.now() / 1000)) throw new ApiError(409, "Bounty đã hết hạn.");
  return claimV2Pda(bountyId, finder)[0].toBase58();
}

function hex32(value: string | undefined, label: string) {
  if (!value || !/^[0-9a-f]{64}$/.test(value)) throw new ApiError(400, `${label} không hợp lệ.`);
  return Uint8Array.from(Buffer.from(value, "hex"));
}

function requireSponsorEnabled() {
  if (!PROTOCOL_V2_ENABLED || process.env.SPONSORED_FEES_ENABLED !== "1") {
    throw new ApiError(503, "Tài trợ phí Devnet chưa được bật trên bản triển khai này.");
  }
}
