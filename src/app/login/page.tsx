"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { CircleNotch } from "@phosphor-icons/react";
import { Suspense } from "react";

function LoginForm() {
  const { signIn, configured, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/bounties";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!configured) {
      setError("Chưa cấu hình Supabase — xem hướng dẫn bên dưới.");
      return;
    }
    setBusy(true);
    try {
      await signIn(email, password);
      router.replace(next.startsWith("/") ? next : "/bounties");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9945FF]">
        FindBack AI
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold text-white">
        Đăng nhập
      </h1>
      <p className="mt-2 text-sm text-white/55">
        Tài khoản app (email). Ví Phantom kết nối sau để ký giao dịch Solana —
        hai việc khác nhau.
      </p>

      {configured ? (
        <div className="mt-5 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs text-emerald-100">
          Supabase đã kết nối. Chưa chạy SQL bảng?{" "}
          <Link href="/setup" className="font-bold underline">
            Mở /setup (1 phút)
          </Link>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs leading-relaxed text-amber-100">
          <p className="font-bold">Chưa có Supabase env</p>
          <p className="mt-2">
            Thêm{" "}
            <code className="text-white">NEXT_PUBLIC_SUPABASE_URL</code> +{" "}
            <code className="text-white">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> rồi
            restart.
          </p>
        </div>
      )}

      <form
        onSubmit={(e) => void onSubmit(e)}
        className="mt-6 space-y-4 rounded-3xl border border-white/10 bg-white/[0.04] p-6"
      >
        <label className="block space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/45">
            Email
          </span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-[#9945FF]/50"
            placeholder="ban@email.com"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/45">
            Mật khẩu
          </span>
          <input
            type="password"
            required
            minLength={6}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-[#9945FF]/50"
            placeholder="••••••••"
          />
        </label>

        {error && (
          <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || authLoading}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#9945FF] to-[#14F195] py-3 text-sm font-bold text-black disabled:opacity-50"
        >
          {busy ? (
            <CircleNotch size={16} className="animate-spin" />
          ) : null}
          {busy ? "Đang đăng nhập…" : "Đăng nhập"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-white/50">
        Chưa có tài khoản?{" "}
        <Link href="/signup" className="font-semibold text-[#14F195] hover:underline">
          Đăng ký
        </Link>
      </p>
      <p className="mt-2 text-center text-xs text-white/35">
        <Link href="/" className="hover:text-white/60">
          ← Về trang chủ
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="relative flex min-h-dvh flex-1 items-center justify-center bg-[#070b14] px-4 py-16">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(153,69,255,0.2),_transparent_55%)]" />
      <div className="relative w-full">
        <Suspense
          fallback={
            <p className="text-center text-white/50">Loading…</p>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
