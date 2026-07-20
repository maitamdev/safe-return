import { PublicKey } from "@solana/web3.js";
import { fetchBounty, fetchClaimV2 } from "@/lib/findback/program";
import {
  apiErrorResponse,
  enforceDistributedRateLimit,
  enforceRateLimit,
  requireApiUser,
  requireSameOrigin,
} from "@/lib/server/api-security";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type ClaimLink = {
  bounty_id: string;
  claim_pda: string | null;
  finder_wallet: string;
};

export async function POST(req: Request) {
  try {
    requireSameOrigin(req);
    const user = await requireApiUser();
    enforceRateLimit(`reconcile:${user.id}`, { limit: 6, windowMs: 60_000 });
    const admin = createAdminClient();
    await enforceDistributedRateLimit(admin, `reconcile:${user.id}`, {
      limit: 6,
      windowMs: 60_000,
    });

    const [{ data: owned, error: ownedError }, { data: submitted, error: submittedError }] =
      await Promise.all([
        admin.from("bounties").select("id").eq("owner_id", user.id).limit(25),
        admin
          .from("claims")
          .select("bounty_id,claim_pda,finder_wallet")
          .eq("finder_id", user.id)
          .limit(25),
      ]);
    if (ownedError) throw new Error(ownedError.message);
    if (submittedError) throw new Error(submittedError.message);

    const ownedIds = (owned || []).map((row) => String(row.id));
    let ownerClaims: ClaimLink[] = [];
    if (ownedIds.length) {
      const { data, error } = await admin
        .from("claims")
        .select("bounty_id,claim_pda,finder_wallet")
        .in("bounty_id", ownedIds)
        .limit(75);
      if (error) throw new Error(error.message);
      ownerClaims = (data || []) as ClaimLink[];
    }

    const links = dedupeLinks([
      ...ownerClaims,
      ...((submitted || []) as ClaimLink[]),
    ]).slice(0, 75);
    const bountyIds = [...new Set([...ownedIds, ...links.map((item) => item.bounty_id)])];
    let reconciled = 0;

    for (const bountyId of bountyIds) {
      const onchain = await fetchBounty(bountyId);
      if (!onchain) continue;
      const related = links.filter((item) => item.bounty_id === bountyId);
      if (!related.length || onchain.protocolVersion < 2) {
        const { error } = await admin
          .from("bounties")
          .update({ status: toDbStatus(onchain.status), updated_at: new Date().toISOString() })
          .eq("id", bountyId);
        if (error) throw new Error(error.message);
        reconciled += 1;
        continue;
      }

      for (const link of related) {
        let finder: PublicKey;
        try {
          finder = new PublicKey(link.finder_wallet);
        } catch {
          continue;
        }
        const claim = await fetchClaimV2(bountyId, finder);
        if (!claim || (link.claim_pda && link.claim_pda !== claim.address)) continue;
        const workflowStatus = toWorkflowStatus(claim.status);
        const { error } = await admin.rpc("sync_claim_chain_state", {
          p_bounty_id: bountyId,
          p_claim_pda: claim.address,
          p_bounty_status: toDbStatus(onchain.status),
          p_claim_status: toDbStatus(claim.status),
          p_workflow_status: workflowStatus,
          p_dispute_deadline: unixSecondsToIso(claim.disputeDeadline),
          p_resolution_deadline: unixSecondsToIso(claim.resolutionDeadline),
          p_last_tx: null,
          p_last_tx_url: null,
        });
        if (error) throw new Error(error.message);
        reconciled += 1;
      }
    }

    return Response.json(
      { ok: true, reconciled },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

function dedupeLinks(rows: ClaimLink[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.bounty_id}:${row.finder_wallet}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function toDbStatus(status: string) {
  return status.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
}

function toWorkflowStatus(status: string) {
  if (status === "Settled") return "settled";
  if (status === "Rejected") return "rejected";
  if (status === "RejectionPending") return "rejection_pending";
  if (status === "Disputed") return "disputed";
  return "";
}

function unixSecondsToIso(value: number) {
  return Number.isFinite(value) && value > 0
    ? new Date(value * 1000).toISOString()
    : null;
}
