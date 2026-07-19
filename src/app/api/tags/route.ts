import { randomBytes } from "node:crypto";
import type { SafeTag, SafeTagReportStatus, SafeTagStatus } from "@/lib/tags/types";
import {
  ApiError,
  apiErrorResponse,
  enforceRateLimit,
  requireApiUser,
  requireSameOrigin,
} from "@/lib/server/api-security";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type TagRow = {
  id: string;
  public_code: string;
  label: string;
  public_note: string;
  status: SafeTagStatus;
  owner_wallet: string;
  created_at: string;
};

type ReportRow = {
  id: string;
  tag_id: string;
  reporter_name: string;
  contact: string;
  location: string;
  message: string;
  status: SafeTagReportStatus;
  created_at: string;
};

export async function GET() {
  try {
    const user = await requireApiUser();
    const admin = createAdminClient();
    const { data: tags, error: tagError } = await admin
      .from("safe_tags")
      .select("id,public_code,label,public_note,status,owner_wallet,created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });
    if (tagError) throw new Error(tagError.message);

    const tagRows = (tags || []) as TagRow[];
    const tagIds = tagRows.map((tag) => tag.id);
    const reports = tagIds.length
      ? await admin
          .from("safe_tag_reports")
          .select("id,tag_id,reporter_name,contact,location,message,status,created_at")
          .in("tag_id", tagIds)
          .order("created_at", { ascending: false })
      : { data: [], error: null };
    if (reports.error) throw new Error(reports.error.message);

    const reportRows = (reports.data || []) as ReportRow[];
    const result = tagRows.map((tag) => toSafeTag(tag, reportRows));
    return Response.json({ ok: true, tags: result }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    requireSameOrigin(req);
    const user = await requireApiUser();
    enforceRateLimit(`safe-tag-create:${user.id}`, { limit: 8, windowMs: 60_000 });
    const body = (await req.json()) as { label?: string; publicNote?: string };
    const label = cleanText(body.label, 80);
    const publicNote = cleanText(body.publicNote, 240);
    if (!label) throw new ApiError(400, "Hãy nhập tên đồ vật cho SafeTag.");

    const admin = createAdminClient();
    const [{ data: profile, error: profileError }, { count, error: countError }] =
      await Promise.all([
        admin
          .from("profiles")
          .select("wallet_pubkey,wallet_verified_at")
          .eq("id", user.id)
          .maybeSingle(),
        admin
          .from("safe_tags")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", user.id)
          .neq("status", "disabled"),
      ]);
    if (profileError) throw new Error(profileError.message);
    if (countError) throw new Error(countError.message);
    if (!profile?.wallet_pubkey || !profile.wallet_verified_at) {
      throw new ApiError(403, "Hãy kết nối và xác minh ví trước khi tạo SafeTag.");
    }
    if ((count || 0) >= 20) {
      throw new ApiError(409, "Mỗi tài khoản được duy trì tối đa 20 SafeTag.");
    }

    const row = {
      owner_id: user.id,
      owner_wallet: profile.wallet_pubkey,
      public_code: randomBytes(18).toString("base64url"),
      label,
      public_note: publicNote,
      status: "active" satisfies SafeTagStatus,
    };
    const { data, error } = await admin
      .from("safe_tags")
      .insert(row)
      .select("id,public_code,label,public_note,status,owner_wallet,created_at")
      .single();
    if (error) throw new Error(error.message);
    return Response.json(
      { ok: true, tag: toSafeTag(data as TagRow, []) },
      { status: 201 }
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(req: Request) {
  try {
    requireSameOrigin(req);
    const user = await requireApiUser();
    enforceRateLimit(`safe-tag-update:${user.id}`, { limit: 30, windowMs: 60_000 });
    const body = (await req.json()) as {
      tagId?: string;
      status?: SafeTagStatus;
      reportId?: string;
      reportStatus?: SafeTagReportStatus;
    };
    const admin = createAdminClient();

    if (body.reportId && body.reportStatus) {
      if (!(["unread", "read", "resolved"] as string[]).includes(body.reportStatus)) {
        throw new ApiError(400, "Trạng thái báo tìm thấy không hợp lệ.");
      }
      const { data: report, error: reportError } = await admin
        .from("safe_tag_reports")
        .select("tag_id")
        .eq("id", body.reportId)
        .maybeSingle();
      if (reportError) throw new Error(reportError.message);
      if (!report) throw new ApiError(404, "Không tìm thấy báo cáo.");
      const { data: tag, error: tagError } = await admin
        .from("safe_tags")
        .select("owner_id")
        .eq("id", report.tag_id)
        .maybeSingle();
      if (tagError) throw new Error(tagError.message);
      if (!tag || tag.owner_id !== user.id) throw new ApiError(403, "Bạn không sở hữu SafeTag này.");
      const { error } = await admin
        .from("safe_tag_reports")
        .update({ status: body.reportStatus })
        .eq("id", body.reportId);
      if (error) throw new Error(error.message);
      return Response.json({ ok: true });
    }

    if (!body.tagId || !body.status) throw new ApiError(400, "Thiếu SafeTag cần cập nhật.");
    if (!(["active", "recovered", "disabled"] as string[]).includes(body.status)) {
      throw new ApiError(400, "Trạng thái SafeTag không hợp lệ.");
    }
    const { data, error } = await admin
      .from("safe_tags")
      .update({ status: body.status, updated_at: new Date().toISOString() })
      .eq("id", body.tagId)
      .eq("owner_id", user.id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new ApiError(404, "Không tìm thấy SafeTag thuộc tài khoản này.");
    return Response.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

function toSafeTag(tag: TagRow, reports: ReportRow[]): SafeTag {
  return {
    id: tag.id,
    publicCode: tag.public_code,
    label: tag.label,
    publicNote: tag.public_note,
    status: tag.status,
    ownerWallet: tag.owner_wallet,
    createdAt: tag.created_at,
    reports: reports
      .filter((report) => report.tag_id === tag.id)
      .map((report) => ({
        id: report.id,
        reporterName: report.reporter_name,
        contact: report.contact,
        location: report.location,
        message: report.message,
        status: report.status,
        createdAt: report.created_at,
      })),
  };
}
