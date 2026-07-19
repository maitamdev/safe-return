/** Supabase lưu metadata; Solana Devnet vẫn là nguồn sự thật của trạng thái tiền. */

import { createClient } from "@/lib/supabase/client";
import type { BountyMeta } from "./store";

export async function syncBountyToSupabase(
  bounty: BountyMeta,
  ownerId: string
): Promise<void> {
  const supabase = createClient();
  if (!supabase || !ownerId) return;
  const { error } = await supabase.from("bounties").upsert(
    {
      id: bounty.id,
      owner_id: ownerId,
      owner_wallet: bounty.ownerWallet,
      title: bounty.title,
      description: bounty.description,
      category: bounty.category,
      location: bounty.location,
      reward_ui: bounty.rewardUi,
      deadline_unix: bounty.deadlineUnix,
      image_path: bounty.imageDataUrl ?? null,
      status: toDbStatus(bounty.status || "Draft"),
      last_tx: bounty.lastTx ?? null,
      last_tx_url: bounty.lastTxUrl ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (error) throw new Error(`Không đồng bộ được bounty: ${error.message}`);
}

export async function syncBountyStateToSupabase(
  bounty: BountyMeta
): Promise<void> {
  const response = await fetch("/api/bounties/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bountyId: bounty.id, signature: bounty.lastTx ?? null }),
  });
  const json = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(json.error || "Không đồng bộ được trạng thái.");
}

export async function syncClaimToSupabase(bounty: BountyMeta): Promise<void> {
  if (!bounty.claim) return;
  const response = await fetch("/api/bounties/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bountyId: bounty.id,
      signature: bounty.lastTx ?? null,
      claim: bounty.claim,
      aiReport: bounty.aiReport ?? null,
    }),
  });
  const json = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(json.error || "Không đồng bộ được claim.");
}

export async function fetchBountiesFromSupabase(): Promise<BountyMeta[]> {
  const supabase = createClient();
  if (!supabase) return [];
  try {
    const [{ data: rows, error }, { data: claims, error: claimError }] =
      await Promise.all([
        supabase
          .from("bounties")
          .select(
            "id,owner_wallet,title,description,category,location,reward_ui,deadline_unix,image_path,status,last_tx,last_tx_url,created_at"
          )
          .order("created_at", { ascending: false })
          .limit(100),
        supabase.from("claims").select("*"),
      ]);
    if (error || !rows) {
      if (error) console.warn("[safereturn/db] bounties:", error.message);
      return [];
    }
    if (claimError) console.warn("[safereturn/db] claims:", claimError.message);
    const claimMap = new Map((claims || []).map((claim) => [claim.bounty_id, claim]));

    return rows.map((row) => {
      const claim = claimMap.get(row.id);
      return {
        id: row.id,
        title: row.title,
        description: row.description || "",
        category: row.category || "Other",
        location: row.location || "",
        rewardUi: Number(row.reward_ui) || 0,
        deadlineUnix: Number(row.deadline_unix) || 0,
        ownerWallet: row.owner_wallet || undefined,
        imageDataUrl: row.image_path || null,
        createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
        status: fromDbStatus(row.status || "draft"),
        aiReport: (claim?.ai_report as BountyMeta["aiReport"]) ?? null,
        claim: claim
          ? {
              finderWallet: claim.finder_wallet,
              description: claim.description,
              location: claim.location,
              foundAt: claim.found_at,
              imageDataUrl: claim.image_data,
              submittedAt: new Date(claim.submitted_at).getTime(),
              evidenceHashHex: claim.evidence_hash,
            }
          : null,
        lastTx: row.last_tx || null,
        lastTxUrl: row.last_tx_url || null,
        seed: false,
      } satisfies BountyMeta;
    });
  } catch (error) {
    console.warn("[safereturn/db] select error", error);
    return [];
  }
}

function toDbStatus(status: string) {
  return status.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
}

function fromDbStatus(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}
