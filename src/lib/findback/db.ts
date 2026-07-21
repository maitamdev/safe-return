/** Supabase lưu metadata; Solana Devnet vẫn là nguồn sự thật của trạng thái tiền. */
import { normalizeClaimStatus } from "@/lib/findback/status";

import { createClient } from "@/lib/supabase/client";
import {
  clearInvalidLocalSession,
  getSupabaseAuthStorageKey,
  isJwtTimingError,
  repairJwtTimingSession,
  SESSION_REAUTH_REQUIRED_MESSAGE,
} from "@/lib/supabase/auth-recovery";
import { getSupabaseEnv } from "@/lib/supabase/config";
import { privateMediaUrl } from "@/lib/media/client";
import type { StoredMedia } from "@/lib/media/types";
import type { ClaimWorkflowStatus } from "./workflow";
import { PROTOCOL_V2_ENABLED } from "./config";
import type { BountyMeta } from "./store";

const SYNC_OUTBOX_KEY = "safereturn:sync-outbox:v1";
const SYNC_OUTBOX_TTL_MS = 24 * 60 * 60_000;

type PendingSync = {
  key: string;
  kind: "bounty" | "claim" | "state";
  bounty: BountyMeta;
  claim?: BountyMeta["claim"];
  createdAt: number;
};

type BountyRow = {
  id: string;
  owner_wallet: string;
  title: string;
  description: string | null;
  category: string | null;
  location: string | null;
  reward_ui: number | string;
  deadline_unix: number | string;
  image_path: string | null;
  metadata_hash: string | null;
  status: string | null;
  last_tx: string | null;
  last_tx_url: string | null;
  created_at: string;
  protocol_version?: number;
  image_storage_path?: string | null;
  image_sha256?: string | null;
  image_mime_type?: StoredMedia["mimeType"] | null;
  image_byte_size?: number | null;
};

type ClaimRow = {
  id?: string;
  bounty_id: string;
  finder_wallet: string;
  description: string;
  location: string;
  found_at: string;
  image_data?: string | null;
  evidence_hash: string;
  ai_report?: unknown;
  ai_input_hash?: string | null;
  ai_report_hash?: string | null;
  ai_model_hash?: string | null;
  ai_prompt_version?: string | null;
  status?: string;
  workflow_status?: ClaimWorkflowStatus;
  dispute_deadline?: string | null;
  resolution_deadline?: string | null;
  last_tx?: string | null;
  last_tx_url?: string | null;
  submitted_at: string;
  protocol_version?: number;
  claim_pda?: string | null;
  image_storage_path?: string | null;
  image_sha256?: string | null;
  image_mime_type?: StoredMedia["mimeType"] | null;
  image_byte_size?: number | null;
};

function requireClient() {
  const supabase = createClient();
  if (!supabase) {
    throw new Error("Ứng dụng chưa cấu hình kết nối dữ liệu.");
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
  if (!response.ok) throw new Error(json.error || "Không lưu được thông tin tin thất lạc.");
}

export async function syncBountyStateToSupabase(
  bounty: BountyMeta,
  claim?: BountyMeta["claim"]
): Promise<void> {
  const response = await fetch("/api/bounties/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bountyId: bounty.id,
      signature: bounty.lastTx ?? null,
      finderWallet: claim?.finderWallet ?? null,
      claimPda: claim?.claimPda ?? null,
    }),
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
  if (!response.ok) throw new Error(json.error || "Không đồng bộ được hồ sơ tìm thấy.");
}

export function queuePendingSync(
  kind: PendingSync["kind"],
  bounty: BountyMeta,
  claim?: BountyMeta["claim"],
) {
  if (typeof window === "undefined") return;
  const finder = claim?.finderWallet || bounty.claim?.finderWallet || "bounty";
  const entry: PendingSync = {
    key: `${kind}:${bounty.id}:${finder}`,
    kind,
    bounty,
    claim,
    createdAt: Date.now(),
  };
  const existing = readPendingSyncs().filter((item) => item.key !== entry.key);
  window.localStorage.setItem(
    SYNC_OUTBOX_KEY,
    JSON.stringify([...existing, entry].slice(-20)),
  );
}

export async function flushPendingSyncs() {
  if (typeof window === "undefined") return 0;
  const pending = readPendingSyncs();
  const failed: PendingSync[] = [];
  let completed = 0;
  for (const item of pending) {
    try {
      if (item.kind === "bounty") await syncBountyToSupabase(item.bounty);
      else if (item.kind === "claim") await syncClaimToSupabase(item.bounty);
      else await syncBountyStateToSupabase(item.bounty, item.claim);
      completed += 1;
    } catch {
      failed.push(item);
    }
  }
  if (failed.length) {
    window.localStorage.setItem(SYNC_OUTBOX_KEY, JSON.stringify(failed));
  } else {
    window.localStorage.removeItem(SYNC_OUTBOX_KEY);
  }
  return completed;
}

function readPendingSyncs(): PendingSync[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(SYNC_OUTBOX_KEY) || "[]",
    ) as PendingSync[];
    const now = Date.now();
    return Array.isArray(parsed)
      ? parsed.filter(
          (item) =>
            item &&
            typeof item.key === "string" &&
            now - Number(item.createdAt) <= SYNC_OUTBOX_TTL_MS,
        )
      : [];
  } catch {
    window.localStorage.removeItem(SYNC_OUTBOX_KEY);
    return [];
  }
}

export async function fetchBountiesFromSupabase(): Promise<BountyMeta[]> {
  const supabase = requireClient();
  const bountyColumns = PROTOCOL_V2_ENABLED
    ? "id,owner_wallet,title,description,category,location,reward_ui,deadline_unix,image_path,metadata_hash,status,last_tx,last_tx_url,created_at,protocol_version,image_storage_path,image_sha256,image_mime_type,image_byte_size"
    : "id,owner_wallet,title,description,category,location,reward_ui,deadline_unix,image_path,metadata_hash,status,last_tx,last_tx_url,created_at";
  const query = () =>
    Promise.all([
      supabase
        .from("bounties")
        .select(bountyColumns)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("claims").select("*"),
    ]);

  let [bountyResult, claimResult] = await query();
  if (isJwtTimingError(bountyResult.error) || isJwtTimingError(claimResult.error)) {
    const repaired = await repairJwtTimingSession(supabase);
    if (repaired) {
      [bountyResult, claimResult] = await query();
    }

    if (
      !repaired ||
      isJwtTimingError(bountyResult.error) ||
      isJwtTimingError(claimResult.error)
    ) {
      const storageKey = getSupabaseAuthStorageKey(getSupabaseEnv().url);
      await clearInvalidLocalSession(supabase, storageKey);
      throw new Error(SESSION_REAUTH_REQUIRED_MESSAGE);
    }
  }

  const { data: rows, error } = bountyResult;
  const { data: claims, error: claimError } = claimResult;
  if (error || !rows) throw new Error(error?.message || "Không đọc được danh sách tin.");
  if (claimError) throw new Error(claimError.message);
  const bountyRows = rows as unknown as BountyRow[];
  const claimRows = (claims || []) as unknown as ClaimRow[];
  const claimGroups = new Map<string, ClaimRow[]>();
  for (const claim of claimRows) {
    const group = claimGroups.get(claim.bounty_id) || [];
    group.push(claim);
    claimGroups.set(claim.bounty_id, group);
  }

  return bountyRows.map((row) => {
    const listingMedia = storedMediaFromRow(row);
    const bountyClaims = (claimGroups.get(row.id) || []).sort(
      (left, right) => Date.parse(right.submitted_at) - Date.parse(left.submitted_at)
    );
    const claim = bountyClaims.find((candidate) => {
      const report = candidate.ai_report as BountyMeta["aiReport"] | undefined;
      return report?.mode === "live";
    }) || bountyClaims[0];
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
      imageDataUrl:
        PROTOCOL_V2_ENABLED && row.protocol_version === 2 && row.image_storage_path
          ? privateMediaUrl({ purpose: "listing", bountyId: row.id })
          : row.image_path || null,
      media: PROTOCOL_V2_ENABLED ? listingMedia : null,
      protocolVersion: PROTOCOL_V2_ENABLED ? row.protocol_version : 1,
      metadataHashHex: row.metadata_hash || null,
      createdAt,
      status: fromDbStatus(row.status || "draft"),
      aiReport: liveReport,
      claim: claim
        ? fromClaimRow(row.id, claim)
        : null,
      claims: PROTOCOL_V2_ENABLED
        ? bountyClaims.map((claimRow) => fromClaimRow(row.id, claimRow))
        : undefined,
      lastTx: row.last_tx || null,
      lastTxUrl: row.last_tx_url || null,
    } satisfies BountyMeta;
  });
}

function fromClaimRow(bountyId: string, claim: ClaimRow) {
  const isV2 = PROTOCOL_V2_ENABLED && claim.protocol_version === 2;
  const media = isV2 ? storedMediaFromRow(claim) : null;
  const storedReport = claim.ai_report as BountyMeta["aiReport"] | undefined;
  return {
    id: claim.id,
    claimPda: claim.claim_pda,
    protocolVersion: isV2 ? 2 : 1,
    finderWallet: claim.finder_wallet,
    description: claim.description,
    location: claim.location,
    foundAt: claim.found_at,
    imageDataUrl:
      isV2 && claim.image_storage_path && claim.id
        ? privateMediaUrl({ purpose: "claim", bountyId, claimId: claim.id })
        : claim.image_data,
    media,
    submittedAt: Date.parse(claim.submitted_at),
    evidenceHashHex: claim.evidence_hash,
    aiReport: storedReport?.mode === "live" ? storedReport : null,
    aiInputHash: claim.ai_input_hash,
    aiReportHash: claim.ai_report_hash,
    aiModelHash: claim.ai_model_hash,
    aiPromptVersion: claim.ai_prompt_version,
    status: normalizeClaimStatus(claim.status),
    workflowStatus: claim.workflow_status || "awaiting_review",
    disputeDeadline: claim.dispute_deadline
      ? Date.parse(claim.dispute_deadline)
      : null,
    resolutionDeadline: claim.resolution_deadline
      ? Date.parse(claim.resolution_deadline)
      : null,
    lastTx: claim.last_tx,
    lastTxUrl: claim.last_tx_url,
  } satisfies NonNullable<BountyMeta["claim"]>;
}

function storedMediaFromRow(row: {
  image_storage_path?: string | null;
  image_sha256?: string | null;
  image_mime_type?: StoredMedia["mimeType"] | null;
  image_byte_size?: number | null;
}): StoredMedia | null {
  if (
    !row.image_storage_path ||
    !row.image_sha256 ||
    !row.image_mime_type ||
    !row.image_byte_size
  ) {
    return null;
  }
  return {
    storagePath: row.image_storage_path,
    sha256: row.image_sha256,
    mimeType: row.image_mime_type,
    byteSize: row.image_byte_size,
  };
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
