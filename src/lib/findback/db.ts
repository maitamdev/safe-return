/** Supabase lưu metadata; Solana Devnet vẫn là nguồn sự thật của trạng thái tiền. */

import { createClient } from "@/lib/supabase/client";
import type { BountyMeta } from "./store";

function requireClient() {
  const supabase = createClient();
  if (!supabase) {
    throw new Error("Ứng dụng chưa cấu hình kết nối Supabase.");
  }
  return supabase;
}

export async function syncBountyToSupabase(
  bounty: BountyMeta
): Promise<void> {
  const response = await fetch("/api/bounties/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bounty }),
  });
  const json = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(json.error || "Không lưu được metadata bounty.");
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
    }),
  });
  const json = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(json.error || "Không đồng bộ được claim.");
}

export async function fetchBountiesFromSupabase(): Promise<BountyMeta[]> {
  const supabase = requireClient();
  const [{ data: rows, error }, { data: claims, error: claimError }] =
    await Promise.all([
      supabase
        .from("bounties")
        .select(
          "id,owner_wallet,title,description,category,location,reward_ui,deadline_unix,image_path,metadata_hash,status,last_tx,last_tx_url,created_at"
        )
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("claims").select("*"),
    ]);
  if (error || !rows) throw new Error(error?.message || "Không đọc được danh sách bounty.");
  if (claimError) throw new Error(claimError.message);
  const claimMap = new Map((claims || []).map((claim) => [claim.bounty_id, claim]));

  return rows.map((row) => {
    const claim = claimMap.get(row.id);
    const storedReport = claim?.ai_report as BountyMeta["aiReport"] | undefined;
    const liveReport = storedReport?.mode === "live" ? storedReport : null;
    const createdAt = Date.parse(row.created_at);
    if (!Number.isFinite(createdAt)) {
      throw new Error(`Bounty ${row.id} thiếu thời điểm tạo hợp lệ.`);
    }
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
      metadataHashHex: row.metadata_hash || null,
      createdAt,
      status: fromDbStatus(row.status || "draft"),
      aiReport: liveReport,
      claim: claim
        ? {
            finderWallet: claim.finder_wallet,
            description: claim.description,
            location: claim.location,
            foundAt: claim.found_at,
            imageDataUrl: claim.image_data,
            submittedAt: Date.parse(claim.submitted_at),
            evidenceHashHex: claim.evidence_hash,
          }
        : null,
      lastTx: row.last_tx || null,
      lastTxUrl: row.last_tx_url || null,
    } satisfies BountyMeta;
  });
}

export function subscribeToBountyChanges(
  onChange: () => void,
  onError: (message: string) => void
) {
  const supabase = requireClient();
  const channel = supabase
    .channel(`findback-live-${crypto.randomUUID()}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "bounties" },
      onChange
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "claims" },
      onChange
    )
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        onError("Kết nối dữ liệu thời gian thực bị gián đoạn.");
      }
    });

  return () => {
    void supabase.removeChannel(channel);
  };
}

function fromDbStatus(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}
