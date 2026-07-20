-- SafeReturn — schema bảo mật cho Supabase.
-- Chạy toàn bộ file trong Supabase SQL Editor sau mỗi lần nâng cấp.

create extension if not exists pgcrypto;

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
  id uuid primary key default gen_random_uuid(),
  bounty_id text not null references public.bounties (id) on delete cascade,
  finder_id uuid not null references auth.users (id) on delete cascade,
  finder_wallet text not null,
  description text not null,
  location text not null default '',
  found_at text not null default '',
  image_data text,
  evidence_hash text not null,
  ai_report jsonb,
  status text not null default 'claim_submitted',
  workflow_status text not null default 'awaiting_review',
  last_tx text,
  last_tx_url text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.claims add column if not exists workflow_status text not null default 'awaiting_review';
alter table public.claims add column if not exists dispute_deadline timestamptz;
alter table public.claims add column if not exists resolution_deadline timestamptz;
alter table public.claims drop constraint if exists claims_workflow_status_check;
alter table public.claims add constraint claims_workflow_status_check check (
  workflow_status in (
    'awaiting_review', 'more_info_requested', 'handover_proposed',
    'handover_scheduled', 'finder_delivered', 'settled', 'rejected',
    'rejection_pending', 'disputed'
  )
);
create index if not exists claims_finder_idx on public.claims (finder_id);
create unique index if not exists claims_bounty_finder_unique on public.claims (bounty_id, finder_wallet);
alter table public.claims enable row level security;
drop policy if exists "Participants read private claims" on public.claims;
create policy "Participants read private claims"
  on public.claims for select to authenticated
  using (
    auth.uid() = finder_id or exists (
      select 1 from public.bounties b
      where b.id = bounty_id and b.owner_id = auth.uid()
    )
  );

-- Browser chỉ có quyền đọc claim theo RLS. Mọi ghi dữ liệu đi qua API server,
-- được kiểm tra lại với tài khoản Solana rồi dùng service-role để cập nhật.
revoke insert, update, delete on public.claims from authenticated;

create table if not exists public.claim_messages (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims (id) on delete cascade,
  bounty_id text not null references public.bounties (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  sender_role text not null check (sender_role in ('owner', 'finder')),
  kind text not null default 'message' check (kind in ('message', 'system')),
  body text not null check (char_length(body) between 1 and 1200),
  created_at timestamptz not null default now()
);

create table if not exists public.claim_handovers (
  claim_id uuid primary key references public.claims (id) on delete cascade,
  bounty_id text not null references public.bounties (id) on delete cascade,
  proposed_by uuid not null references auth.users (id) on delete cascade,
  scheduled_at timestamptz not null,
  meeting_location text not null check (char_length(meeting_location) between 3 and 200),
  note text not null default '' check (char_length(note) <= 500),
  status text not null default 'proposed' check (status in ('proposed', 'accepted', 'cancelled')),
  accepted_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  finder_delivered_at timestamptz,
  owner_received_at timestamptz,
  version bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.claim_handovers add column if not exists version bigint not null default 0;

create table if not exists public.claim_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  claim_id uuid references public.claims (id) on delete cascade,
  bounty_id text references public.bounties (id) on delete cascade,
  kind text not null check (kind in (
    'claim_submitted', 'message', 'info_requested', 'handover_proposed',
    'handover_accepted', 'handover_cancelled', 'finder_delivered',
    'rejection_pending', 'disputed', 'settled', 'rejected'
  )),
  title text not null check (char_length(title) between 1 and 120),
  body text not null default '' check (char_length(body) <= 300),
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.claim_notifications add column if not exists dedupe_key text;
create unique index if not exists claim_notifications_dedupe_idx
  on public.claim_notifications (dedupe_key) where dedupe_key is not null;
create index if not exists claim_notifications_user_created_idx
  on public.claim_notifications (user_id, created_at desc);
create index if not exists claim_notifications_user_unread_idx
  on public.claim_notifications (user_id, created_at desc) where read_at is null;
alter table public.claim_notifications enable row level security;
drop policy if exists "Users read own claim notifications" on public.claim_notifications;
create policy "Users read own claim notifications" on public.claim_notifications
  for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.claim_notifications from authenticated;
grant select on public.claim_notifications to authenticated;

create table if not exists public.api_rate_limits (
  bucket_key text primary key,
  request_count integer not null,
  reset_at timestamptz not null
);
revoke all on public.api_rate_limits from anon, authenticated;

create index if not exists claim_messages_claim_created_idx on public.claim_messages (claim_id, created_at);
create index if not exists claim_handovers_bounty_idx on public.claim_handovers (bounty_id, updated_at desc);
alter table public.claim_messages enable row level security;
alter table public.claim_handovers enable row level security;
drop policy if exists "Participants read claim messages" on public.claim_messages;
create policy "Participants read claim messages" on public.claim_messages for select to authenticated
  using (exists (
    select 1 from public.claims c join public.bounties b on b.id = c.bounty_id
    where c.id = claim_id and (c.finder_id = auth.uid() or b.owner_id = auth.uid())
  ));
drop policy if exists "Participants read claim handovers" on public.claim_handovers;
create policy "Participants read claim handovers" on public.claim_handovers for select to authenticated
  using (exists (
    select 1 from public.claims c join public.bounties b on b.id = c.bounty_id
    where c.id = claim_id and (c.finder_id = auth.uid() or b.owner_id = auth.uid())
  ));
revoke insert, update, delete on public.claim_messages from authenticated;
revoke insert, update, delete on public.claim_handovers from authenticated;

-- Không tiếp tục hiển thị kết quả heuristic từ các bản cũ.
update public.claims
set ai_report = null, updated_at = now()
where ai_report is not null and coalesce(ai_report->>'mode', '') <> 'live';

-- Bật thay đổi thời gian thực. Client chỉ nhận các hàng vượt qua RLS của chính nó.
alter table public.bounties replica identity full;
alter table public.claims replica identity full;
alter table public.claim_messages replica identity full;
alter table public.claim_handovers replica identity full;
alter table public.claim_notifications replica identity full;
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
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'claim_messages'
    ) then
      alter publication supabase_realtime add table public.claim_messages;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'claim_handovers'
    ) then
      alter publication supabase_realtime add table public.claim_handovers;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'claim_notifications'
    ) then
      alter publication supabase_realtime add table public.claim_notifications;
    end if;
  end if;
end;
$$;

drop function if exists public.submit_bounty_claim(text,text,jsonb,text,text);
drop function if exists public.record_bounty_ai_review(text,jsonb,text,text);
drop function if exists public.sync_bounty_state(text,text,text,text,boolean);
