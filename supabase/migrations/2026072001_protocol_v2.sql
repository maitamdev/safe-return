-- SafeReturn protocol v2: content-addressed media and concurrent claims.
-- Apply once in the qqblhgyzrwlfhpxfyggc project before enabling v2 clients.

create extension if not exists pgcrypto;

alter table public.bounties add column if not exists protocol_version smallint not null default 1;
alter table public.bounties add column if not exists image_storage_path text;
alter table public.bounties add column if not exists image_sha256 text;
alter table public.bounties add column if not exists image_mime_type text;
alter table public.bounties add column if not exists image_byte_size integer;

alter table public.bounties drop constraint if exists bounties_image_sha256_format;
alter table public.bounties add constraint bounties_image_sha256_format
  check (image_sha256 is null or image_sha256 ~ '^[0-9a-f]{64}$');
alter table public.bounties drop constraint if exists bounties_image_descriptor_complete;
alter table public.bounties add constraint bounties_image_descriptor_complete
  check (
    (image_storage_path is null and image_sha256 is null and image_mime_type is null and image_byte_size is null)
    or
    (image_storage_path is not null and image_sha256 is not null and image_mime_type in ('image/jpeg','image/png','image/webp') and image_byte_size > 0)
  );

alter table public.claims add column if not exists id uuid default gen_random_uuid();
update public.claims set id = gen_random_uuid() where id is null;
alter table public.claims alter column id set default gen_random_uuid();
alter table public.claims alter column id set not null;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.claims'::regclass and conname = 'claims_pkey'
  ) then
    alter table public.claims drop constraint claims_pkey;
  end if;
end $$;
alter table public.claims add constraint claims_pkey primary key (id);

alter table public.claims add column if not exists protocol_version smallint not null default 1;
alter table public.claims add column if not exists claim_pda text;
alter table public.claims add column if not exists image_storage_path text;
alter table public.claims add column if not exists image_sha256 text;
alter table public.claims add column if not exists image_mime_type text;
alter table public.claims add column if not exists image_byte_size integer;
alter table public.claims add column if not exists ai_input_hash text;
alter table public.claims add column if not exists ai_report_hash text;
alter table public.claims add column if not exists ai_model_hash text;
alter table public.claims add column if not exists ai_prompt_version text;

create unique index if not exists claims_bounty_finder_unique
  on public.claims (bounty_id, finder_wallet);
create unique index if not exists claims_pda_unique
  on public.claims (claim_pda) where claim_pda is not null;
create index if not exists claims_bounty_idx
  on public.claims (bounty_id, submitted_at desc);

alter table public.claims drop constraint if exists claims_image_sha256_format;
alter table public.claims add constraint claims_image_sha256_format
  check (image_sha256 is null or image_sha256 ~ '^[0-9a-f]{64}$');
alter table public.claims drop constraint if exists claims_image_descriptor_complete;
alter table public.claims add constraint claims_image_descriptor_complete
  check (
    (image_storage_path is null and image_sha256 is null and image_mime_type is null and image_byte_size is null)
    or
    (image_storage_path is not null and image_sha256 is not null and image_mime_type in ('image/jpeg','image/png','image/webp') and image_byte_size > 0)
  );

create table if not exists public.chain_events (
  signature text not null,
  event_index integer not null,
  program_id text not null,
  event_name text not null,
  bounty_id text,
  claim_pda text,
  slot bigint,
  payload jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  primary key (signature, event_index)
);
create index if not exists chain_events_bounty_idx
  on public.chain_events (bounty_id, observed_at desc);
alter table public.chain_events enable row level security;
revoke insert, update, delete on public.chain_events from authenticated;
drop policy if exists "Authenticated read chain events" on public.chain_events;
create policy "Authenticated read chain events"
  on public.chain_events for select to authenticated using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('listing-media', 'listing-media', false, 1200000, array['image/jpeg','image/png','image/webp']),
  ('claim-evidence', 'claim-evidence', false, 1200000, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No browser storage policies are intentionally created. All reads/writes use
-- authenticated same-origin API routes and the service role after participant
-- checks. This prevents users from guessing private evidence object paths.

alter table public.claims replica identity full;
