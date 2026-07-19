"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { CircleNotch } from "@phosphor-icons/react";

export default function SignupPage() {
  const { signUp, configured } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!configured) {
      setError("Chưa cấu hình Supabase. Xem trang Đăng nhập để biết cách setup.");
      return;
    }
    if (password.length < 6) {
      setError("Mật khẩu tối thiểu 6 ký tự.");
      return;
    }
    setBusy(true);
    try {
      const note = await signUp(email, password, name);
      if (note) {
        setInfo(
          note +
            " → Supabase Dashboard: Auth → Providers → Email → tắt Confirm email, rồi đăng nhập lại. Hoặc mở email xác nhận."
        );
      } else {
        router.replace("/bounties");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng ký thất bại");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh flex-1 items-center justify-center bg-[#070b14] px-4 py-16">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(20,241,149,0.12),_transparent_50%)]" />
      <div className="relative mx-auto w-full max-w-md">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#14F195]">
          FindBack AI
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-white">
          Tạo tài khoản
        </h1>
        <p className="mt-2 text-sm text-white/55">
          Đăng ký bằng email. Sau khi vào app mới nối Phantom để khóa thưởng
          on-chain.
        </p>

        <form
          onSubmit={(e) => void onSubmit(e)}
          className="mt-6 space-y-4 rounded-3xl border border-white/10 bg-white/[0.04] p-6"
        >
          <label className="block space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/45">
              Tên hiển thị
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-[#14F195]/40"
              placeholder="Mai / Quinn…"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/45">
              Email
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-[#14F195]/40"
              placeholder="ban@email.com"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/45">
              Mật khẩu (≥ 6 ký tự)
            </span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-[#14F195]/40"
            />
          </label>

          {error && (
            <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {error}
            </p>
          )}
          {info && (
            <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
              {info}{" "}
              <Link href="/login" className="underline">
                Đăng nhập
              </Link>
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-3 text-sm font-bold text-black disabled:opacity-50"
          >
            {busy && <CircleNotch size={16} className="animate-spin" />}
            {busy ? "Đang tạo…" : "Đăng ký"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-white/50">
          Đã có tài khoản?{" "}
          <Link href="/login" className="font-semibold text-[#14F195] hover:underline">
            Đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
}
