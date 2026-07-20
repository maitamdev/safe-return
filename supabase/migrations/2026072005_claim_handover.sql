-- Private realtime coordination for a specific finder claim.
-- All writes go through authenticated same-origin API routes. Browser clients
-- only receive rows that belong to a claim they own or submitted.

create extension if not exists pgcrypto;

alter table public.claims
  add column if not exists workflow_status text not null default 'awaiting_review';

update public.claims
set workflow_status = case
  when status = 'settled' then 'settled'
  when status = 'rejected' then 'rejected'
  when status = 'disputed' then 'disputed'
  else coalesce(nullif(workflow_status, ''), 'awaiting_review')
end
where status in ('settled', 'rejected', 'disputed')
   or workflow_status is null
   or workflow_status = '';

alter table public.claims drop constraint if exists claims_workflow_status_check;
alter table public.claims add constraint claims_workflow_status_check check (
  workflow_status in (
    'awaiting_review',
    'more_info_requested',
    'handover_proposed',
    'handover_scheduled',
    'finder_delivered',
    'settled',
    'rejected',
    'disputed'
  )
);

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

create index if not exists claim_messages_claim_created_idx
  on public.claim_messages (claim_id, created_at);

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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists claim_handovers_bounty_idx
  on public.claim_handovers (bounty_id, updated_at desc);

alter table public.claim_messages enable row level security;
alter table public.claim_handovers enable row level security;

drop policy if exists "Participants read claim messages" on public.claim_messages;
create policy "Participants read claim messages"
  on public.claim_messages for select to authenticated
  using (
    exists (
      select 1
      from public.claims c
      join public.bounties b on b.id = c.bounty_id
      where c.id = claim_id
        and (c.finder_id = auth.uid() or b.owner_id = auth.uid())
    )
  );

drop policy if exists "Participants read claim handovers" on public.claim_handovers;
create policy "Participants read claim handovers"
  on public.claim_handovers for select to authenticated
  using (
    exists (
      select 1
      from public.claims c
      join public.bounties b on b.id = c.bounty_id
      where c.id = claim_id
        and (c.finder_id = auth.uid() or b.owner_id = auth.uid())
    )
  );

revoke insert, update, delete on public.claim_messages from authenticated;
revoke insert, update, delete on public.claim_handovers from authenticated;

alter table public.claim_messages replica identity full;
alter table public.claim_handovers replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
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
  end if;
end;
$$;

notify pgrst, 'reload schema';
