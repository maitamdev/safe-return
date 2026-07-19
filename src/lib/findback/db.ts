/**
 * Optional Supabase persistence for bounty metadata.
 * Falls back silently when offline / table missing — localStorage still works.
 */

import { createClient } from "@/lib/supabase/client";
import type { BountyMeta } from "./store";

export async function syncBountyToSupabase(
  b: BountyMeta,
  ownerId: string
): Promise<void> {
  const supabase = createClient();
  if (!supabase || !ownerId) return;

  const row = {
    id: b.id,
    owner_id: ownerId,
    owner_wallet: b.ownerWallet ?? null,
    title: b.title,
    description: b.description,
    category: b.category,
    location: b.location,
    reward_ui: b.rewardUi,
    deadline_unix: b.deadlineUnix,
    status: b.aiReport
      ? "ai_reviewed"
      : b.claim
        ? "claim_submitted"
        : "funded",
    claim: b.claim ?? null,
    ai_report: b.aiReport ?? null,
    last_tx: b.lastTx ?? null,
    last_tx_url: b.lastTxUrl ?? null,
    updated_at: new Date().toISOString(),
  };

  try {
    const { error } = await supabase.from("bounties").upsert(row, {
      onConflict: "id",
    });
    if (error) {
      // Table missing until user runs schema.sql — not fatal
      console.warn("[findback/db] upsert skipped:", error.message);
    }
  } catch (e) {
    console.warn("[findback/db] upsert error", e);
  }
}

export async function fetchBountiesFromSupabase(): Promise<BountyMeta[]> {
  const supabase = createClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("bounties")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error || !data) {
      if (error) console.warn("[findback/db] select:", error.message);
      return [];
    }

    return data.map((row) => ({
      id: row.id as string,
      title: row.title as string,
      description: (row.description as string) || "",
      category: (row.category as string) || "Other",
      location: (row.location as string) || "",
      rewardUi: Number(row.reward_ui) || 0,
      deadlineUnix: Number(row.deadline_unix) || 0,
      ownerWallet: (row.owner_wallet as string) || undefined,
      imageDataUrl: null,
      createdAt: row.created_at
        ? new Date(row.created_at as string).getTime()
        : Date.now(),
      aiReport: (row.ai_report as BountyMeta["aiReport"]) ?? null,
      claim: (row.claim as BountyMeta["claim"]) ?? null,
      lastTx: (row.last_tx as string) || null,
      lastTxUrl: (row.last_tx_url as string) || null,
      seed: false,
    }));
  } catch (e) {
    console.warn("[findback/db] select error", e);
    return [];
  }
}
