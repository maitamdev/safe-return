-- Private claim evidence is readable directly only by its finder and bounty owner.
-- Assigned arbiters receive disputed evidence through the authenticated server API,
-- which verifies their on-chain panel membership before using the service role.

alter table public.claims enable row level security;

drop policy if exists "Participants read private claims" on public.claims;
create policy "Participants read private claims"
  on public.claims for select to authenticated
  using (
    auth.uid() = finder_id or exists (
      select 1
      from public.bounties b
      where b.id = bounty_id
        and b.owner_id = auth.uid()
    )
  );

comment on column public.claims.location is
  'Private evidence. Exposed only through participant RLS or verified arbitration APIs.';

notify pgrst, 'reload schema';
