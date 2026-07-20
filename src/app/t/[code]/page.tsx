"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  CheckCircle,
  LockKey,
  MapPin,
  PaperPlaneTilt,
  ShieldCheck,
  Tag,
  WarningCircle,
} from "@phosphor-icons/react";
import type { PublicSafeTag } from "@/lib/tags/types";

export default function PublicSafeTagPage() {
  const params = useParams();
  const code = String(params?.code || "");
  const [tag, setTag] = useState<PublicSafeTag | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reporterName, setReporterName] = useState("");
  const [contact, setContact] = useState("");
  const [location, setLocation] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/tags/${encodeURIComponent(code)}`, { cache: "no-store" })
      .then(async (response) => {
        const json = (await response.json().catch(() => ({}))) as {
          tag?: PublicSafeTag;
          error?: string;
        };
        if (!response.ok || !json.tag) throw new Error(json.error || "Không tìm thấy SafeTag.");
        if (!cancelled) setTag(json.tag);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Không mở được SafeTag.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      const response = await fetch(`/api/tags/${encodeURIComponent(code)}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reporterName, contact, location, message, website }),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Chưa gửi được lời nhắn.");
      setSent(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Chưa gửi được lời nhắn.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-bg text-ink">
      <header className="border-b border-line bg-bg-elevated">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="inline-flex items-center gap-2 font-bold text-forest">
            <span className="grid size-9 place-items-center rounded-xl bg-forest text-white">
              <ShieldCheck size={20} weight="fill" aria-hidden />
            </span>
            SafeReturn
          </Link>
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-ink-muted">
            <LockKey size={15} aria-hidden /> Kênh liên hệ riêng tư
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        {loading ? <PublicTagSkeleton /> : null}
        {loadError ? (
          <div className="app-card p-7 text-center sm:p-10">
            <WarningCircle size={38} className="mx-auto text-coral" weight="duotone" />
            <h1 className="mt-4 text-2xl font-bold">Không mở được SafeTag</h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink-soft">{loadError}</p>
          </div>
        ) : null}

        {tag ? (
          <div className="overflow-hidden rounded-2xl border border-line bg-bg-elevated shadow-[0_24px_70px_rgba(27,68,49,0.1)]">
            <section className="border-b border-line bg-bg-deep p-6 sm:p-9">
              <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-bg-elevated px-3 py-1.5 text-xs font-bold text-emerald-800">
                <Tag size={16} weight="duotone" aria-hidden /> SafeTag đang hoạt động
              </span>
              <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">Bạn vừa tìm thấy {tag.label}</h1>
              <p className="mt-3 max-w-xl text-sm leading-7 text-ink-soft">
                Gửi một lời nhắn để chủ sở hữu biết món đồ đang ở đâu. SafeReturn không hiển thị danh tính, ví hay thông tin liên hệ của chủ đồ trên trang này.
              </p>
              {tag.publicNote ? (
                <div className="mt-5 rounded-xl border border-emerald-200 bg-bg-elevated/80 p-4 text-sm leading-6 text-ink">
                  {tag.publicNote}
                </div>
              ) : null}
            </section>

            {tag.status === "recovered" ? (
              <div className="p-7 text-center sm:p-10">
                <CheckCircle size={42} className="mx-auto text-forest" weight="fill" />
                <h2 className="mt-4 text-xl font-bold">Món đồ đã về với chủ</h2>
                <p className="mt-2 text-sm text-ink-soft">Cảm ơn bạn đã quét và quan tâm.</p>
              </div>
            ) : sent ? (
              <div className="p-7 text-center sm:p-10" role="status">
                <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-50 text-forest">
                  <CheckCircle size={32} weight="fill" />
                </span>
                <h2 className="mt-5 text-2xl font-bold">Lời nhắn đã được chuyển</h2>
                <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink-soft">
                  Chủ SafeTag sẽ thấy cách liên hệ bạn cung cấp trong khu vực riêng tư của họ.
                </p>
              </div>
            ) : (
              <form onSubmit={submit} className="p-6 sm:p-9">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Tên của bạn" hint="Không bắt buộc">
                    <input className="app-input" value={reporterName} onChange={(event) => setReporterName(event.target.value)} maxLength={80} placeholder="Ví dụ: Minh" />
                  </Field>
                  <Field label="Cách liên hệ" hint="Bắt buộc">
                    <input className="app-input" value={contact} onChange={(event) => setContact(event.target.value)} maxLength={200} required placeholder="Số điện thoại, email hoặc Zalo" />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Vị trí món đồ" hint="Không bắt buộc">
                      <div className="relative">
                        <MapPin size={18} className="pointer-events-none absolute left-3.5 top-3.5 text-ink-muted" aria-hidden />
                        <input className="app-input pl-11" value={location} onChange={(event) => setLocation(event.target.value)} maxLength={200} placeholder="Khu vực hoặc địa điểm dễ hẹn gặp" />
                      </div>
                    </Field>
                  </div>
                  <div className="sm:col-span-2">
                    <Field label="Lời nhắn cho chủ đồ" hint="Bắt buộc">
                      <textarea className="app-input min-h-32 resize-y" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={1000} required placeholder="Mô tả tình trạng món đồ và thời gian thuận tiện để liên hệ" />
                    </Field>
                  </div>
                </div>
                <input className="hidden" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} name="website" aria-hidden />
                {submitError ? <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900" role="alert">{submitError}</p> : null}
                <button type="submit" disabled={submitting} className="app-button-primary mt-6 w-full sm:w-auto">
                  {submitting ? "Đang gửi" : "Gửi lời nhắn an toàn"} <PaperPlaneTilt size={17} weight="fill" aria-hidden />
                </button>
                <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-ink-muted">
                  <LockKey size={15} className="mt-0.5 shrink-0" aria-hidden />
                  Lời nhắn và thông tin liên hệ chỉ hiện với tài khoản sở hữu SafeTag.
                </p>
              </form>
            )}
          </div>
        ) : null}
      </div>
    </main>
  );
}

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between gap-3 text-sm font-semibold text-ink">
        {label} <span className="text-xs font-normal text-ink-muted">{hint}</span>
      </span>
      {children}
    </label>
  );
}

function PublicTagSkeleton() {
  return (
    <div className="app-card p-7 sm:p-10">
      <div className="skeleton h-7 w-36" />
      <div className="skeleton mt-6 h-11 w-4/5" />
      <div className="skeleton mt-4 h-5 w-full" />
      <div className="skeleton mt-2 h-5 w-2/3" />
      <div className="skeleton mt-8 h-48 w-full" />
    </div>
  );
}
