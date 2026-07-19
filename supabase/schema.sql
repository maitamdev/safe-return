-- FindBack AI — run once in Supabase SQL Editor
-- Dashboard → SQL → New query → paste → Run

-- Profiles (optional display name)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  wallet_pubkey text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by owner"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Off-chain bounty metadata (images + AI report JSON)
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

-- Anyone logged-in can browse bounties (lost & found is public listing)
create policy "Authenticated users can read bounties"
  on public.bounties for select
  to authenticated
  using (true);

create policy "Owners insert own bounties"
  on public.bounties for insert
  to authenticated
  with check (auth.uid() = owner_id);

create policy "Owners update own bounties"
  on public.bounties for update
  to authenticated
  using (auth.uid() = owner_id);

-- Finders may update claim fields on funded bounties they didn't create
-- (simple MVP: allow update if authenticated; tighten later)
create policy "Authenticated can update claim on bounties"
  on public.bounties for update
  to authenticated
  using (true)
  with check (true);

create policy "Owners delete own bounties"
  on public.bounties for delete
  to authenticated
  using (auth.uid() = owner_id);
