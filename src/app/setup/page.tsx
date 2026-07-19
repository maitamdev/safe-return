"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle, Copy, ArrowRight } from "@phosphor-icons/react";

const SQL = `-- FindBack AI schema — paste in Supabase SQL Editor → Run
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  wallet_pubkey text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "Profiles are viewable by owner" on public.profiles;
create policy "Profiles are viewable by owner" on public.profiles for select using (auth.uid() = id);
drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles for update using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table if not exists public.bounties (
  id text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  owner_wallet text,
  title text not null,
  description text not null default '',
  category text not null default 'Other',
  location text not null default '',
  reward_ui numeric not null default 0,
  deadline_unix bigint not null,
  image_path text,
  metadata_hash text,
  status text not null default 'draft',
  claim jsonb,
  ai_report jsonb,
  last_tx text,
  last_tx_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bounties_owner_idx on public.bounties (owner_id);
create index if not exists bounties_created_idx on public.bounties (created_at desc);
alter table public.bounties enable row level security;

drop policy if exists "Authenticated users can read bounties" on public.bounties;
create policy "Authenticated users can read bounties" on public.bounties for select to authenticated using (true);
drop policy if exists "Owners insert own bounties" on public.bounties;
create policy "Owners insert own bounties" on public.bounties for insert to authenticated with check (auth.uid() = owner_id);
drop policy if exists "Owners update own bounties" on public.bounties;
create policy "Owners update own bounties" on public.bounties for update to authenticated using (auth.uid() = owner_id);
drop policy if exists "Authenticated can update claim on bounties" on public.bounties;
create policy "Authenticated can update claim on bounties" on public.bounties for update to authenticated using (true) with check (true);
drop policy if exists "Owners delete own bounties" on public.bounties;
create policy "Owners delete own bounties" on public.bounties for delete to authenticated using (auth.uid() = owner_id);
`;

const SQL_EDITOR =
  "https://supabase.com/dashboard/project/qqblhgyzrwlfhpxfyggc/sql/new";
const AUTH_SETTINGS =
  "https://supabase.com/dashboard/project/qqblhgyzrwlfhpxfyggc/auth/providers";

export default function SetupPage() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-dvh bg-[#070b14] px-4 py-12 text-white">
      <div className="mx-auto max-w-2xl">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#14F195]">
          Setup còn 1 phút
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold">
          Chạy SQL trên Supabase
        </h1>
        <p className="mt-2 text-sm text-white/55">
          Key đã gắn xong. Auth đã chạy. Bạn chỉ cần tạo 2 bảng{" "}
          <code className="text-white/80">profiles</code> +{" "}
          <code className="text-white/80">bounties</code> (1 lần).
        </p>

        <ol className="mt-8 space-y-4">
          <li className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs font-bold text-[#9945FF]">Bước 1</p>
            <p className="mt-1 font-semibold">Tắt Confirm email (demo nhanh)</p>
            <p className="mt-1 text-sm text-white/50">
              Authentication → Providers → Email → tắt &quot;Confirm email&quot;
              → Save. Không tắt thì đăng ký xong phải mở mail mới vào được.
            </p>
            <a
              href={AUTH_SETTINGS}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-bold hover:bg-white/15"
            >
              Mở Auth Providers <ArrowRight size={14} />
            </a>
          </li>

          <li className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs font-bold text-[#9945FF]">Bước 2</p>
            <p className="mt-1 font-semibold">Copy SQL + Run</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copy()}
                className="inline-flex items-center gap-2 rounded-full bg-[#14F195] px-4 py-2 text-xs font-bold text-black"
              >
                {copied ? (
                  <CheckCircle size={14} weight="fill" />
                ) : (
                  <Copy size={14} />
                )}
                {copied ? "Đã copy!" : "Copy toàn bộ SQL"}
              </button>
              <a
                href={SQL_EDITOR}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-[#9945FF] px-4 py-2 text-xs font-bold text-white"
              >
                Mở SQL Editor <ArrowRight size={14} />
              </a>
            </div>
            <p className="mt-3 text-xs text-white/45">
              Dán vào editor → bấm <strong className="text-white">Run</strong>{" "}
              (góc phải dưới). Thấy Success là xong.
            </p>
            <pre className="mt-3 max-h-48 overflow-auto rounded-2xl border border-white/10 bg-black/50 p-3 font-mono text-[10px] text-white/60">
              {SQL.slice(0, 500)}…
            </pre>
          </li>

          <li className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs font-bold text-[#9945FF]">Bước 3</p>
            <p className="mt-1 font-semibold">Đăng ký &amp; dùng app</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-black"
              >
                Đăng ký tài khoản
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-bold"
              >
                Đăng nhập
              </Link>
            </div>
          </li>
        </ol>

        <p className="mt-8 text-center text-xs text-white/35">
          Project:{" "}
          <a
            className="text-[#14F195] hover:underline"
            href="https://supabase.com/dashboard/project/qqblhgyzrwlfhpxfyggc"
            target="_blank"
            rel="noreferrer"
          >
            qqblhgyzrwlfhpxfyggc
          </a>
        </p>
      </div>
    </div>
  );
}
