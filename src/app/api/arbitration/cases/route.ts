import { PublicKey } from "@solana/web3.js";
import {
  fetchArbitrationPanel,
  fetchBounty,
  fetchDisputeCase,
} from "@/lib/findback/program";
import { privateMediaUrl } from "@/lib/media/client";
import { ApiError, apiErrorResponse, enforceRateLimit, requireApiUser } from "@/lib/server/api-security";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type ClaimRow = {
  id: string;
  bounty_id: string;
  finder_wallet: string;
  description: string;
  location: string;
  found_at: string;
  ai_report: unknown;
  status: string;
  protocol_version: number;
  image_storage_path: string | null;
  image_data: string | null;
  bounties: {
    title: string;
    location: string;
    reward_ui: number | string;
    owner_wallet: string;
  };
};

export async function GET() {
  try {
    const user = await requireApiUser();
    enforceRateLimit(`arbitration-cases:${user.id}`, { limit: 30, windowMs: 60_000 });
    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("wallet_pubkey,wallet_verified_at,is_arbiter")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);
    if (!profile?.wallet_pubkey || !profile.wallet_verified_at) {
      throw new ApiError(403, "Hãy xác minh ví để mở hàng chờ phân xử.");
    }

    const { data, error } = await admin
      .from("claims")
      .select("id,bounty_id,finder_wallet,description,location,found_at,ai_report,status,protocol_version,image_storage_path,image_data,bounties!inner(title,location,reward_ui,owner_wallet)")
      .eq("status", "disputed")
      .order("submitted_at", { ascending: true })
      .limit(50);
    if (error) throw new Error(error.message);

    const wallet = profile.wallet_pubkey as string;
    const cases = await Promise.all(
      ((data || []) as unknown as ClaimRow[]).map(async (row) => {
        const bounty = await fetchBounty(row.bounty_id);
        if (!bounty) return null;
        const panel = bounty.arbitrationMode === 1
          ? await fetchArbitrationPanel(row.bounty_id)
          : null;
        const authorized = panel
          ? panel.arbiters.includes(wallet)
          : profile.is_arbiter && bounty.arbiter === wallet;
        if (!authorized) return null;
        const disputeCase = panel
          ? await fetchDisputeCase(row.bounty_id, new PublicKey(row.finder_wallet))
          : null;
        return {
          bountyId: row.bounty_id,
          title: row.bounties.title,
          bountyLocation: row.bounties.location,
          rewardUi: Number(row.bounties.reward_ui),
          ownerWallet: row.bounties.owner_wallet,
          finderWallet: row.finder_wallet,
          claimId: row.id,
          description: row.description,
          foundLocation: row.location,
          foundAt: row.found_at,
          aiReport: row.ai_report,
          imageUrl: row.protocol_version === 2 && row.image_storage_path
            ? privateMediaUrl({ purpose: "claim", bountyId: row.bounty_id, claimId: row.id })
            : row.image_data,
          mode: panel ? "quorum" : "single",
          panel,
          disputeCase,
        };
      })
    );
    return Response.json(
      { ok: true, cases: cases.filter(Boolean) },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
