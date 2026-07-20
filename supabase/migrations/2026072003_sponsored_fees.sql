-- Auditable quotas for server-constructed, Devnet-only sponsored transactions.

create table if not exists public.sponsored_transactions (
  request_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet text not null,
  sponsor text not null,
  action text not null check (action in ('create_bounty','fund_bounty','submit_claim_v2')),
  bounty_id text not null,
  blockhash text not null,
  last_valid_block_height bigint not null,
  signature text unique,
  status text not null default 'prepared' check (status in ('prepared','submitted','confirmed','failed','expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  confirmed_at timestamptz
);

create index if not exists sponsored_transactions_quota_idx
  on public.sponsored_transactions (user_id, created_at desc);
create index if not exists sponsored_transactions_wallet_idx
  on public.sponsored_transactions (wallet, created_at desc);

alter table public.sponsored_transactions enable row level security;
drop policy if exists "Users read own sponsored transactions" on public.sponsored_transactions;
create policy "Users read own sponsored transactions"
  on public.sponsored_transactions for select to authenticated
  using (user_id = auth.uid());

revoke insert, update, delete on public.sponsored_transactions from anon, authenticated;

-- Make newly-created tables/columns visible to PostgREST immediately so the
-- release gate cannot pass against a stale schema cache.
notify pgrst, 'reload schema';
