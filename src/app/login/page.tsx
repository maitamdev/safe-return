"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { CircleNotch, ShieldCheck } from "@phosphor-icons/react";
import { useAuth } from "@/lib/auth/AuthProvider";

function LoginForm() {
  const { signIn, configured, loading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/bounties";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get("error") === "auth"
      ? "Liên kết xác nhận không hợp lệ hoặc đã hết hạn."
      : params.get("reason") === "session_expired"
        ? "Phiên đăng nhập cũ không còn hợp lệ và đã được làm sạch. Vui lòng đăng nhập lại."
        : null,
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!configured) {
      setError("Ứng dụng chưa cấu hình Supabase.");
      return;
    }
    setBusy(true);
    try {
      await signIn(email, password);
      router.replace(next.startsWith("/") ? next : "/bounties");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Đăng nhập thất bại.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-forest"><ShieldCheck size={20} weight="fill" />SafeReturn</Link>
      <h1 className="mt-6 text-3xl font-bold tracking-tight">Đăng nhập</h1>
      <p className="mt-2 text-sm leading-6 text-ink-soft">Tài khoản email bảo vệ dữ liệu ứng dụng. Phantom chỉ được kết nối sau khi vào app để ký giao dịch Devnet.</p>

      {!configured && <div className="alert-box-warn mt-5 rounded-xl p-4 text-sm"><p className="font-bold">Thiếu cấu hình Supabase</p><p className="mt-1 leading-6">Thêm biến môi trường theo <Link href="/setup" className="underline">hướng dẫn thiết lập</Link>.</p></div>}

      <form onSubmit={(event) => void submit(event)} className="app-card mt-6 space-y-5 p-5 sm:p-6">
        <label className="block"><span className="text-sm font-bold">Email</span><input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="app-input mt-2" placeholder="ban@example.com" /></label>
        <label className="block"><span className="text-sm font-bold">Mật khẩu</span><input type="password" required minLength={6} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="app-input mt-2" /></label>
        {error && <p className="alert-box-danger rounded-xl p-3 text-sm" role="alert">{error}</p>}
        <button type="submit" disabled={busy || loading || !configured} className="app-button-primary w-full">{busy && <CircleNotch size={17} className="animate-spin" />}{busy ? "Đang đăng nhập" : "Đăng nhập"}</button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-soft">Chưa có tài khoản? <Link href="/signup" className="font-bold text-forest hover:underline">Đăng ký</Link></p>
    </div>
  );
}

export default function LoginPage() {
  return <main className="grid min-h-[100dvh] flex-1 bg-bg lg:grid-cols-[1.05fr_0.95fr]"><div className="relative hidden overflow-hidden lg:block"><Image src="/images/safereturn-hero-map.png" alt="Bản đồ tìm đồ thất lạc của SafeReturn" fill priority sizes="55vw" className="object-cover" /><div className="absolute inset-x-8 bottom-8 rounded-2xl border border-line bg-bg-elevated/92 p-6 shadow-[0_20px_60px_rgba(26,58,42,0.17)] backdrop-blur-md"><p className="text-lg font-bold text-ink">Giao dịch thật, tài sản thử nghiệm</p><p className="mt-2 text-sm leading-6 text-ink-soft">SOL và FIND chỉ hoạt động trên Devnet, không có giá trị tiền tệ.</p></div></div><div className="flex items-center justify-center px-4 py-12 sm:px-8"><Suspense fallback={<p className="text-sm text-ink-soft">Đang tải biểu mẫu...</p>}><LoginForm /></Suspense></div></main>;
}
