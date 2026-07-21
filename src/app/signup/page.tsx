"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CircleNotch, ShieldCheck } from "@phosphor-icons/react";
import { useAuth } from "@/lib/auth/AuthProvider";

export default function SignupPage() {
  const { signUp, configured } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setInfo(null);
    if (!configured) {
      setError("Ứng dụng chưa cấu hình đăng nhập.");
      return;
    }
    if (password.length < 6) {
      setError("Mật khẩu cần ít nhất 6 ký tự.");
      return;
    }
    setBusy(true);
    try {
      const note = await signUp(email, password, name);
      if (note) setInfo("Tài khoản đã được tạo. Hãy mở email để xác nhận rồi đăng nhập.");
      else {
        router.replace("/bounties");
        router.refresh();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Đăng ký thất bại.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-[100dvh] flex-1 bg-bg lg:grid-cols-[1.05fr_0.95fr]">
      <div className="relative hidden overflow-hidden lg:block">
        <Image src="/images/safereturn-hero-map.png" alt="Bản đồ tìm đồ thất lạc của SafeReturn" fill priority sizes="55vw" className="object-cover" />
        <div className="absolute inset-x-8 bottom-8 rounded-2xl border border-line bg-bg-elevated/92 p-6 shadow-[0_20px_60px_rgba(26,58,42,0.17)] backdrop-blur-md">
          <p className="text-lg font-bold text-ink">Không bao giờ chia sẻ cụm từ khôi phục ví</p>
          <p className="mt-2 text-sm leading-6 text-ink-soft">SafeReturn chỉ yêu cầu chữ ký giao dịch trên mạng thử nghiệm trong cửa sổ Phantom.</p>
        </div>
      </div>
      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
      <div className="w-full max-w-md">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-forest"><ShieldCheck size={20} weight="fill" />SafeReturn</Link>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">Tạo tài khoản</h1>
        <p className="mt-2 text-sm leading-6 text-ink-soft">Đăng ký bằng email trước. Bạn không cần cung cấp cụm từ khôi phục ví hay kết nối ví ở bước này.</p>
        {!configured && <div className="alert-box-warn mt-5 rounded-xl p-4 text-sm">Thiếu cấu hình đăng nhập. Xem <Link href="/setup" className="font-bold underline">trang thiết lập</Link>.</div>}
        <form onSubmit={(event) => void submit(event)} className="app-card mt-6 space-y-5 p-5 sm:p-6">
          <label className="block"><span className="text-sm font-bold">Tên hiển thị</span><input value={name} onChange={(event) => setName(event.target.value)} className="app-input mt-2" autoComplete="name" placeholder="Tên của bạn" maxLength={80} /></label>
          <label className="block"><span className="text-sm font-bold">Email</span><input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="app-input mt-2" placeholder="ban@example.com" /></label>
          <label className="block"><span className="text-sm font-bold">Mật khẩu</span><span className="mt-1 block text-xs text-ink-muted">Ít nhất 6 ký tự.</span><input type="password" required minLength={6} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="app-input mt-2" /></label>
          {error && <p className="alert-box-danger rounded-xl p-3 text-sm" role="alert">{error}</p>}
          {info && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900" role="status">{info} <Link href="/login" className="font-bold underline">Đăng nhập</Link></p>}
          <button type="submit" disabled={busy || !configured} className="app-button-primary w-full">{busy && <CircleNotch size={17} className="animate-spin" />}{busy ? "Đang tạo tài khoản" : "Đăng ký"}</button>
        </form>
        <p className="mt-6 text-center text-sm text-ink-soft">Đã có tài khoản? <Link href="/login" className="font-bold text-forest hover:underline">Đăng nhập</Link></p>
      </div>
      </div>
    </main>
  );
}
