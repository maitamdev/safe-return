import { PublicKey } from "@solana/web3.js";
import { explorerTxUrl, PROTOCOL_V2_ENABLED } from "@/lib/findback/config";
import {
  fetchArbitrationPanel,
  fetchBounty,
  fetchClaimV2,
  fetchSignatureStatus,
} from "@/lib/findback/program";
import {
  ApiError,
  apiErrorResponse,
  enforceRateLimit,
  requireApiUser,
  requireSameOrigin,
} from "@/lib/server/api-security";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    requireSameOrigin(req);
    const user = await requireApiUser();
    enforceRateLimit(`bounty-sync:${user.id}`, { limit: 30, windowMs: 60_000 });
    const body = (await req.json()) as {
      bountyId?: string;
      signature?: string | null;
      finderWallet?: string | null;
      claimPda?: string | null;
    };
    const bountyId = body.bountyId?.trim() || "";
    if (!bountyId) throw new ApiError(400, "Thiếu mã bounty.");

    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("wallet_pubkey,wallet_verified_at,is_arbiter")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);
    if (!profile?.wallet_pubkey || !profile.wallet_verified_at) {
      throw new ApiError(403, "Ví chưa được xác minh.");
    }

    const onchain = await fetchBounty(bountyId);
    if (!onchain) throw new ApiError(404, "Không tìm thấy bounty trên Devnet.");
    const useV2 = PROTOCOL_V2_ENABLED && onchain.protocolVersion >= 2;
    const chainClaim = useV2 && body.finderWallet
      ? await fetchClaimV2(bountyId, new PublicKey(body.finderWallet))
      : null;
    const panel = useV2 && onchain.arbitrationMode === 1
      ? await fetchArbitrationPanel(bountyId)
      : null;
    if (body.claimPda && chainClaim?.address !== body.claimPda) {
      throw new ApiError(409, "Claim PDA không khớp dữ liệu đồng bộ.");
    }
    const allowed =
      profile.wallet_pubkey === onchain.owner ||
      profile.wallet_pubkey === onchain.finder ||
      profile.wallet_pubkey === chainClaim?.finder ||
      panel?.arbiters.includes(profile.wallet_pubkey) ||
      (profile.is_arbiter && profile.wallet_pubkey === onchain.arbiter);
    if (!allowed) throw new ApiError(403, "Ví không phải thành viên của bounty.");

    let lastTx: string | null = null;
    if (body.signature) {
      const status = await fetchSignatureStatus(body.signature);
      if (!status || status.err) throw new ApiError(409, "Giao dịch chưa được Devnet xác nhận.");
      lastTx = body.signature;
    }

    const status = toDbStatus(onchain.status);
    if (useV2 && chainClaim) {
      const claimStatus = toDbStatus(chainClaim.status);
      const workflowStatus =
        chainClaim.status === "Settled"
          ? "settled"
          : chainClaim.status === "Rejected"
            ? "rejected"
            : chainClaim.status === "Disputed"
              ? "disputed"
              : chainClaim.status === "RejectionPending"
                ? "rejection_pending"
                : "";
      const { error: syncError } = await admin.rpc("sync_claim_chain_state", {
        p_bounty_id: bountyId,
        p_claim_pda: chainClaim.address,
        p_bounty_status: status,
        p_claim_status: claimStatus,
        p_workflow_status: workflowStatus,
        p_dispute_deadline: unixSecondsToIso(chainClaim.disputeDeadline),
        p_resolution_deadline: unixSecondsToIso(chainClaim.resolutionDeadline),
        p_last_tx: lastTx,
        p_last_tx_url: lastTx ? explorerTxUrl(lastTx) : null,
      });
      if (syncError) throw new Error(syncError.message);
    } else {
      const { error: updateError } = await admin
        .from("bounties")
        .update({
          status,
          ...(lastTx
            ? { last_tx: lastTx, last_tx_url: explorerTxUrl(lastTx) }
            : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", bountyId);
      if (updateError) throw new Error(updateError.message);
    }

    if (!useV2 && onchain.status === "Funded" && isDefaultKey(onchain.finder)) {
      const { error: deleteError } = await admin
        .from("claims")
        .delete()
        .eq("bounty_id", bountyId);
      if (deleteError) throw new Error(deleteError.message);
    }

    // `OnChainBounty` contains bigint balances, which Response.json cannot
    // serialize. The client only needs the authoritative status here.
    return Response.json({ ok: true, status });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

function isDefaultKey(value: string) {
  return value === "11111111111111111111111111111111";
}

function toDbStatus(status: string) {
  return status.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
}

function unixSecondsToIso(value: number) {
  if (!Number.isFinite(value) || value <= 0) return null;
  return new Date(value * 1000).toISOString();
}
