"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { CircleNotch } from "@phosphor-icons/react";

/**
 * Client-side gate for /bounties when middleware cannot run
 * (or Supabase just configured). Shows setup if env missing.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, configured } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!configured) return; // SetupBanner handles this
    if (!user) {
      const next = encodeURIComponent(pathname || "/bounties");
      router.replace(`/login?next=${next}`);
    }
  }, [user, loading, configured, router, pathname]);

  if (!configured) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9945FF]">
          Cần Supabase
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold text-white">
          Chưa cấu hình đăng nhập
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-white/60">
          Tạo project miễn phí tại{" "}
          <a
            href="https://supabase.com"
            target="_blank"
            rel="noreferrer"
            className="text-[#14F195] underline"
          >
            supabase.com
          </a>
          , bật Email Auth, rồi thêm vào{" "}
          <code className="text-white/80">.env.local</code>:
        </p>
        <pre className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-4 text-left font-mono text-[11px] text-[#14F195]">
{`NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...`}
        </pre>
        <p className="mt-4 text-xs text-white/40">
          Chạy SQL trong file <code>supabase/schema.sql</code> → SQL Editor.
          Xem <code>HUONG_DAN.md</code> mục Supabase.
        </p>
        <a
          href="/login"
          className="mt-6 inline-block rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black"
        >
          Mở trang đăng nhập
        </a>
      </div>
    );
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-white/60">
        <CircleNotch size={28} className="animate-spin text-[#14F195]" />
        <p className="text-sm">Đang kiểm tra đăng nhập…</p>
      </div>
    );
  }

  return <>{children}</>;
}
