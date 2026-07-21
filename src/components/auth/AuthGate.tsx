"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CircleNotch, GearSix } from "@phosphor-icons/react";
import { useAuth } from "@/lib/auth/AuthProvider";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, configured } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading || !configured || user) return;
    const next = encodeURIComponent(pathname || "/bounties");
    router.replace(`/login?next=${next}`);
  }, [user, loading, configured, router, pathname]);

  if (!configured) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-bg px-4 py-12 text-ink">
        <div className="app-card w-full max-w-xl p-6 text-center sm:p-8">
          <GearSix size={34} className="mx-auto text-forest" />
          <h1 className="mt-4 text-2xl font-bold">Cần cấu hình đăng nhập</h1>
          <p className="mt-3 text-sm leading-6 text-ink-soft">Dịch vụ đăng nhập chưa sẵn sàng. Vui lòng liên hệ quản trị viên để hoàn tất cấu hình.</p>
          <pre className="mt-5 overflow-x-auto rounded-xl border border-line bg-bg-deep p-4 text-left font-mono text-xs leading-6 text-forest">{`NEXT_PUBLIC_SUPABASE_URL=https://project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...`}</pre>
          <Link href="/setup" className="app-button-primary mt-5">Mở hướng dẫn thiết lập</Link>
        </div>
      </main>
    );
  }

  if (loading || !user) {
    return <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-bg px-4 text-center text-ink"><CircleNotch size={28} className="animate-spin text-forest" /><p className="text-sm font-semibold">Đang kiểm tra phiên đăng nhập</p><p className="text-xs text-ink-muted">Nếu chưa đăng nhập, bạn sẽ được chuyển đến trang đăng nhập.</p></div>;
  }

  return <>{children}</>;
}
