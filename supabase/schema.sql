-- SafeReturn — schema bảo mật cho Supabase.
-- Chạy toàn bộ file trong Supabase SQL Editor sau mỗi lần nâng cấp.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  wallet_pubkey text,
  wallet_verified_at timestamptz,
  is_arbiter boolean not null default false,
  wallet_nonce_hash text,
  wallet_nonce_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists wallet_verified_at timestamptz;
alter table public.profiles add column if not exists is_arbiter boolean not null default false;
alter table public.profiles add column if not exists wallet_nonce_hash text;
alter table public.profiles add column if not exists wallet_nonce_expires_at timestamptz;
create unique index if not exists profiles_wallet_unique
  on public.profiles (wallet_pubkey) where wallet_pubkey is not null;

alter table public.profiles enable row level security;
drop policy if exists "Profiles are viewable by owner" on public.profiles;
drop policy if exists "Users insert own profile" on public.profiles;
drop policy if exists "Users update own profile" on public.profiles;
create policy "Profiles are viewable by owner"
  on public.profiles for select to authenticated using (auth.uid() = id);
create policy "Users update own public profile"
  on public.profiles for update to authenticated using (auth.uid() = id)
  with check (auth.uid() = id);

-- Không cho browser tự gán ví hoặc nonce; chỉ API service-role được ghi các cột này.
revoke insert on public.profiles from authenticated;
revoke update on public.profiles from authenticated;
grant update (full_name, updated_at) on public.profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table if not exists public.bounties (
  id text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  owner_wallet text not null,
  title text not null,
  description text not null default '',
  category text not null default 'Other',
  location text not null default '',
  reward_ui numeric not null check (reward_ui > 0),
  deadline_unix bigint not null,
  image_path text,
  metadata_hash text,
  status text not null default 'draft',
  last_tx text,
  last_tx_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Xóa nơi lưu claim công khai của bản MVP cũ. Claim mới nằm ở bảng riêng có RLS.
alter table public.bounties drop column if exists claim;
alter table public.bounties drop column if exists ai_report;
create index if not exists bounties_owner_idx on public.bounties (owner_id);
create index if not exists bounties_created_idx on public.bounties (created_at desc);
alter table public.bounties enable row level security;

drop policy if exists "Authenticated users can read bounties" on public.bounties;
drop policy if exists "Owners insert own bounties" on public.bounties;
drop policy if exists "Owners update own bounties" on public.bounties;
drop policy if exists "Authenticated can update claim on bounties" on public.bounties;
drop policy if exists "Owners delete own bounties" on public.bounties;

create policy "Authenticated users can read bounties"
  on public.bounties for select to authenticated using (true);
revoke insert, update, delete on public.bounties from authenticated;

create table if not exists public.claims (
  bounty_id text primary key references public.bounties (id) on delete cascade,
  finder_id uuid not null references auth.users (id) on delete cascade,
  finder_wallet text not null,
  description text not null,
  location text not null default '',
  found_at text not null default '',
  image_data text,
  evidence_hash text not null,
  ai_report jsonb,
  status text not null default 'claim_submitted',
  last_tx text,
  last_tx_url text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists claims_finder_idx on public.claims (finder_id);
alter table public.claims enable row level security;
drop policy if exists "Participants read private claims" on public.claims;
create policy "Participants read private claims"
  on public.claims for select to authenticated
  using (
    auth.uid() = finder_id or exists (
      select 1 from public.bounties b
      where b.id = bounty_id and b.owner_id = auth.uid()
    ) or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_arbiter and p.wallet_verified_at is not null
    )
  );

-- Browser chỉ có quyền đọc claim theo RLS. Mọi ghi dữ liệu đi qua API server,
-- được kiểm tra lại với tài khoản Solana rồi dùng service-role để cập nhật.
revoke insert, update, delete on public.claims from authenticated;

-- Không tiếp tục hiển thị kết quả heuristic từ các bản cũ.
update public.claims
set ai_report = null, updated_at = now()
where ai_report is not null and coalesce(ai_report->>'mode', '') <> 'live';

-- Bật thay đổi thời gian thực. Client chỉ nhận các hàng vượt qua RLS của chính nó.
alter table public.bounties replica identity full;
alter table public.claims replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bounties'
    ) then
      alter publication supabase_realtime add table public.bounties;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'claims'
    ) then
      alter publication supabase_realtime add table public.claims;
    end if;
  end if;
end;
$$;

drop function if exists public.submit_bounty_claim(text,text,jsonb,text,text);
drop function if exists public.record_bounty_ai_review(text,jsonb,text,text);
drop function if exists public.sync_bounty_state(text,text,text,text,boolean);
