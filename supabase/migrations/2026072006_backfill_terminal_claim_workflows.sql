-- The workflow_status column receives its default before the original backfill
-- can inspect existing rows. Correct terminal claims already stored in production.

update public.claims
set workflow_status = case
  when status = 'settled' then 'settled'
  when status = 'rejected' then 'rejected'
  when status = 'disputed' then 'disputed'
  else workflow_status
end,
updated_at = now()
where status in ('settled', 'rejected', 'disputed')
  and workflow_status not in ('settled', 'rejected', 'disputed');

notify pgrst, 'reload schema';
