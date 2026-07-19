-- SafeTag: opaque public QR codes and private finder reports.
-- Public visitors never receive owner identifiers, wallet addresses or prior reports.

create table if not exists public.safe_tags (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  owner_wallet text not null,
  public_code text not null unique,
  label text not null check (char_length(label) between 1 and 80),
  public_note text not null default '' check (char_length(public_note) <= 240),
  status text not null default 'active' check (status in ('active', 'recovered', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists safe_tags_owner_idx
  on public.safe_tags (owner_id, created_at desc);
create index if not exists safe_tags_public_code_idx
  on public.safe_tags (public_code) where status = 'active';

create table if not exists public.safe_tag_reports (
  id uuid primary key default gen_random_uuid(),
  tag_id uuid not null references public.safe_tags(id) on delete cascade,
  reporter_name text not null default '' check (char_length(reporter_name) <= 80),
  contact text not null check (char_length(contact) between 3 and 200),
  location text not null default '' check (char_length(location) <= 200),
  message text not null check (char_length(message) between 3 and 1000),
  reporter_fingerprint text not null check (reporter_fingerprint ~ '^[0-9a-f]{64}$'),
  status text not null default 'unread' check (status in ('unread', 'read', 'resolved')),
  created_at timestamptz not null default now()
);

create index if not exists safe_tag_reports_tag_idx
  on public.safe_tag_reports (tag_id, created_at desc);
create index if not exists safe_tag_reports_rate_idx
  on public.safe_tag_reports (tag_id, reporter_fingerprint, created_at desc);

alter table public.safe_tags enable row level security;
alter table public.safe_tag_reports enable row level security;

drop policy if exists "Owners manage own SafeTags" on public.safe_tags;
create policy "Owners manage own SafeTags"
  on public.safe_tags for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "Owners read own SafeTag reports" on public.safe_tag_reports;
create policy "Owners read own SafeTag reports"
  on public.safe_tag_reports for select to authenticated
  using (
    exists (
      select 1 from public.safe_tags
      where safe_tags.id = safe_tag_reports.tag_id
        and safe_tags.owner_id = auth.uid()
    )
  );

drop policy if exists "Owners update own SafeTag reports" on public.safe_tag_reports;
create policy "Owners update own SafeTag reports"
  on public.safe_tag_reports for update to authenticated
  using (
    exists (
      select 1 from public.safe_tags
      where safe_tags.id = safe_tag_reports.tag_id
        and safe_tags.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.safe_tags
      where safe_tags.id = safe_tag_reports.tag_id
        and safe_tags.owner_id = auth.uid()
    )
  );

-- Anonymous inserts intentionally go through the same-origin API, which applies
-- field validation, a honeypot and per-fingerprint quotas with the service role.
revoke insert, update, delete on public.safe_tag_reports from anon, authenticated;
alter table public.safe_tag_reports replica identity full;
