-- Make the private handover workflow atomic, observable and safe under
-- concurrent requests. All mutations are executed by service-role APIs.

create extension if not exists pgcrypto;

alter table public.claims
  add column if not exists dispute_deadline timestamptz,
  add column if not exists resolution_deadline timestamptz;

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
    'rejection_pending',
    'disputed'
  )
);

alter table public.claim_handovers
  add column if not exists version bigint not null default 0;

create table if not exists public.claim_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  claim_id uuid references public.claims (id) on delete cascade,
  bounty_id text references public.bounties (id) on delete cascade,
  kind text not null check (kind in (
    'claim_submitted',
    'message',
    'info_requested',
    'handover_proposed',
    'handover_accepted',
    'handover_cancelled',
    'finder_delivered',
    'rejection_pending',
    'disputed',
    'settled',
    'rejected'
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
  on public.claim_notifications (user_id, created_at desc)
  where read_at is null;

alter table public.claim_notifications enable row level security;
drop policy if exists "Users read own claim notifications" on public.claim_notifications;
create policy "Users read own claim notifications"
  on public.claim_notifications for select to authenticated
  using (user_id = auth.uid());
revoke insert, update, delete on public.claim_notifications from authenticated;
grant select on public.claim_notifications to authenticated;

create table if not exists public.api_rate_limits (
  bucket_key text primary key,
  request_count integer not null,
  reset_at timestamptz not null
);
revoke all on public.api_rate_limits from anon, authenticated;

create or replace function public.consume_api_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.api_rate_limits%rowtype;
begin
  if p_limit < 1 or p_window_seconds < 1 then
    return false;
  end if;

  insert into public.api_rate_limits (bucket_key, request_count, reset_at)
  values (p_bucket_key, 0, now() + make_interval(secs => p_window_seconds))
  on conflict (bucket_key) do nothing;

  select * into current_row
  from public.api_rate_limits
  where bucket_key = p_bucket_key
  for update;

  if current_row.reset_at <= now() then
    update public.api_rate_limits
    set request_count = 1,
        reset_at = now() + make_interval(secs => p_window_seconds)
    where bucket_key = p_bucket_key;
    return true;
  end if;

  if current_row.request_count >= p_limit then
    return false;
  end if;

  update public.api_rate_limits
  set request_count = request_count + 1
  where bucket_key = p_bucket_key;
  return true;
end;
$$;

create or replace function public.apply_claim_workflow_action(
  p_claim_id uuid,
  p_actor_id uuid,
  p_action text,
  p_message text default '',
  p_scheduled_at timestamptz default null,
  p_meeting_location text default '',
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  claim_row public.claims%rowtype;
  bounty_row public.bounties%rowtype;
  handover_row public.claim_handovers%rowtype;
  actor_role text;
  recipient_id uuid;
  next_status text;
  system_body text;
  notification_kind text;
  notification_title text;
  notification_body text;
  action_now timestamptz := now();
begin
  select c.* into claim_row
  from public.claims c
  where c.id = p_claim_id
  for update;
  if not found then raise exception 'WORKFLOW_NOT_FOUND'; end if;

  select b.* into bounty_row
  from public.bounties b
  where b.id = claim_row.bounty_id
  for update;
  if not found then raise exception 'BOUNTY_NOT_FOUND'; end if;

  if claim_row.finder_id = p_actor_id then
    actor_role := 'finder';
    recipient_id := bounty_row.owner_id;
  elsif bounty_row.owner_id = p_actor_id then
    actor_role := 'owner';
    recipient_id := claim_row.finder_id;
  else
    raise exception 'WORKFLOW_FORBIDDEN';
  end if;

  if claim_row.workflow_status in ('settled', 'rejected', 'rejection_pending', 'disputed') then
    raise exception 'WORKFLOW_CLOSED';
  end if;

  next_status := claim_row.workflow_status;

  if p_action = 'send_message' then
    if char_length(p_message) < 1 or char_length(p_message) > 1200 then
      raise exception 'MESSAGE_INVALID';
    end if;
    insert into public.claim_messages
      (claim_id, bounty_id, sender_id, sender_role, kind, body)
    values
      (claim_row.id, bounty_row.id, p_actor_id, actor_role, 'message', p_message);
    notification_kind := 'message';
    notification_title := case when actor_role = 'owner'
      then 'Chủ đồ đã nhắn cho bạn' else 'Người tìm thấy đã nhắn cho bạn' end;
    notification_body := left(p_message, 300);

  elsif p_action = 'request_info' then
    if actor_role <> 'owner' then raise exception 'OWNER_ONLY'; end if;
    if claim_row.workflow_status not in ('awaiting_review', 'more_info_requested') then
      raise exception 'WORKFLOW_STATE_CHANGED';
    end if;
    next_status := 'more_info_requested';
    system_body := 'Chủ đồ yêu cầu bổ sung đặc điểm hoặc ảnh trước khi hẹn giao.';
    notification_kind := 'info_requested';
    notification_title := 'Cần bổ sung bằng chứng';
    notification_body := 'Chủ đồ cần thêm thông tin trước khi hẹn nhận lại đồ.';

  elsif p_action = 'propose_handover' then
    if claim_row.workflow_status not in ('awaiting_review', 'more_info_requested') then
      raise exception 'WORKFLOW_STATE_CHANGED';
    end if;
    if p_scheduled_at is null
       or p_scheduled_at < action_now - interval '5 minutes'
       or p_scheduled_at > action_now + interval '60 days' then
      raise exception 'SCHEDULE_INVALID';
    end if;
    if char_length(p_meeting_location) < 3 or char_length(p_meeting_location) > 200 then
      raise exception 'LOCATION_INVALID';
    end if;
    if char_length(p_note) > 500 then raise exception 'NOTE_INVALID'; end if;

    select * into handover_row
    from public.claim_handovers
    where claim_id = claim_row.id
    for update;
    if found and handover_row.status in ('proposed', 'accepted') then
      raise exception 'HANDOVER_ALREADY_ACTIVE';
    end if;

    insert into public.claim_handovers (
      claim_id, bounty_id, proposed_by, scheduled_at, meeting_location, note,
      status, accepted_by, accepted_at, finder_delivered_at, owner_received_at,
      version, updated_at
    ) values (
      claim_row.id, bounty_row.id, p_actor_id, p_scheduled_at,
      p_meeting_location, p_note, 'proposed', null, null, null, null, 1, action_now
    ) on conflict (claim_id) do update set
      proposed_by = excluded.proposed_by,
      scheduled_at = excluded.scheduled_at,
      meeting_location = excluded.meeting_location,
      note = excluded.note,
      status = 'proposed',
      accepted_by = null,
      accepted_at = null,
      finder_delivered_at = null,
      owner_received_at = null,
      version = public.claim_handovers.version + 1,
      updated_at = action_now;
    next_status := 'handover_proposed';
    system_body := case when actor_role = 'owner' then 'Chủ đồ' else 'Người tìm thấy' end
      || ' đã đề xuất một lịch giao đồ riêng tư.';
    notification_kind := 'handover_proposed';
    notification_title := 'Có lịch giao đồ mới';
    notification_body := 'Mở tin để xem thời gian, địa điểm và xác nhận lịch hẹn.';

  elsif p_action = 'accept_handover' then
    select * into handover_row
    from public.claim_handovers
    where claim_id = claim_row.id
    for update;
    if not found or handover_row.status <> 'proposed' then
      raise exception 'HANDOVER_NOT_PROPOSED';
    end if;
    if handover_row.proposed_by = p_actor_id then raise exception 'OTHER_PARTY_REQUIRED'; end if;
    update public.claim_handovers set
      status = 'accepted', accepted_by = p_actor_id, accepted_at = action_now,
      version = version + 1, updated_at = action_now
    where claim_id = claim_row.id;
    next_status := 'handover_scheduled';
    system_body := 'Hai bên đã xác nhận lịch giao đồ.';
    notification_kind := 'handover_accepted';
    notification_title := 'Lịch giao đồ đã được xác nhận';
    notification_body := 'Hai bên đã thống nhất thời gian và địa điểm gặp.';

  elsif p_action = 'cancel_handover' then
    select * into handover_row
    from public.claim_handovers
    where claim_id = claim_row.id
    for update;
    if not found or handover_row.status not in ('proposed', 'accepted') then
      raise exception 'HANDOVER_NOT_ACTIVE';
    end if;
    if handover_row.finder_delivered_at is not null then raise exception 'DELIVERY_ALREADY_MARKED'; end if;
    update public.claim_handovers set
      status = 'cancelled', version = version + 1, updated_at = action_now
    where claim_id = claim_row.id;
    next_status := 'awaiting_review';
    system_body := 'Lịch giao đồ đã được hủy. Hai bên có thể đề xuất lịch mới.';
    notification_kind := 'handover_cancelled';
    notification_title := 'Lịch giao đồ đã hủy';
    notification_body := 'Bạn có thể trao đổi và đề xuất một lịch khác.';

  elsif p_action = 'mark_delivered' then
    if actor_role <> 'finder' then raise exception 'FINDER_ONLY'; end if;
    select * into handover_row
    from public.claim_handovers
    where claim_id = claim_row.id
    for update;
    if not found or handover_row.status <> 'accepted' then
      raise exception 'HANDOVER_NOT_ACCEPTED';
    end if;
    if handover_row.finder_delivered_at is not null then raise exception 'DELIVERY_ALREADY_MARKED'; end if;
    if handover_row.scheduled_at > action_now + interval '30 minutes' then
      raise exception 'DELIVERY_TOO_EARLY';
    end if;
    update public.claim_handovers set
      finder_delivered_at = action_now, version = version + 1, updated_at = action_now
    where claim_id = claim_row.id;
    next_status := 'finder_delivered';
    system_body := 'Người tìm thấy xác nhận đã giao đồ. Chủ đồ cần kiểm tra trực tiếp trước khi trả thưởng.';
    notification_kind := 'finder_delivered';
    notification_title := 'Đồ đã được giao';
    notification_body := 'Hãy kiểm tra trực tiếp rồi mới xác nhận nhận đồ và trả thưởng.';
  else
    raise exception 'ACTION_INVALID';
  end if;

  if next_status <> claim_row.workflow_status then
    update public.claims
    set workflow_status = next_status, updated_at = action_now
    where id = claim_row.id;
  end if;

  if system_body is not null then
    insert into public.claim_messages
      (claim_id, bounty_id, sender_id, sender_role, kind, body)
    values
      (claim_row.id, bounty_row.id, p_actor_id, actor_role, 'system', system_body);
  end if;

  if recipient_id <> p_actor_id and notification_kind is not null then
    insert into public.claim_notifications
      (user_id, claim_id, bounty_id, kind, title, body)
    values
      (recipient_id, claim_row.id, bounty_row.id, notification_kind,
       notification_title, notification_body);
  end if;

  return jsonb_build_object('status', next_status);
end;
$$;

create or replace function public.sync_claim_chain_state(
  p_bounty_id text,
  p_claim_pda text,
  p_bounty_status text,
  p_claim_status text,
  p_workflow_status text,
  p_dispute_deadline timestamptz default null,
  p_resolution_deadline timestamptz default null,
  p_last_tx text default null,
  p_last_tx_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  claim_row public.claims%rowtype;
  bounty_row public.bounties%rowtype;
  action_now timestamptz := now();
  notify_kind text;
  notify_title text;
begin
  select * into bounty_row from public.bounties
  where id = p_bounty_id for update;
  if not found then raise exception 'BOUNTY_NOT_FOUND'; end if;
  select * into claim_row from public.claims
  where bounty_id = p_bounty_id and claim_pda = p_claim_pda for update;
  if not found then raise exception 'WORKFLOW_NOT_FOUND'; end if;

  update public.bounties set
    status = p_bounty_status,
    last_tx = coalesce(p_last_tx, last_tx),
    last_tx_url = coalesce(p_last_tx_url, last_tx_url),
    updated_at = action_now
  where id = p_bounty_id;

  update public.claims set
    status = p_claim_status,
    workflow_status = coalesce(nullif(p_workflow_status, ''), workflow_status),
    dispute_deadline = p_dispute_deadline,
    resolution_deadline = p_resolution_deadline,
    last_tx = coalesce(p_last_tx, last_tx),
    last_tx_url = coalesce(p_last_tx_url, last_tx_url),
    updated_at = action_now
  where id = claim_row.id;

  if p_workflow_status = 'settled' then
    update public.claim_handovers set
      owner_received_at = coalesce(owner_received_at, action_now), updated_at = action_now
    where claim_id = claim_row.id;
    update public.claims set workflow_status = 'rejected', updated_at = action_now
    where bounty_id = p_bounty_id and id <> claim_row.id
      and workflow_status in (
        'awaiting_review', 'more_info_requested', 'handover_proposed',
        'handover_scheduled', 'finder_delivered', 'rejection_pending', 'disputed'
      );
    notify_kind := 'settled';
    notify_title := 'Đã nhận đồ và trả thưởng';
  elsif p_workflow_status = 'rejection_pending' then
    notify_kind := 'rejection_pending';
    notify_title := 'Bằng chứng đang chờ từ chối';
  elsif p_workflow_status = 'disputed' then
    notify_kind := 'disputed';
    notify_title := 'Tranh chấp đã được mở';
  elsif p_workflow_status = 'rejected' then
    notify_kind := 'rejected';
    notify_title := 'Bằng chứng đã kết thúc';
  end if;

  if notify_kind is not null and claim_row.workflow_status is distinct from p_workflow_status then
    insert into public.claim_notifications (user_id, claim_id, bounty_id, kind, title, body)
    select target_id, claim_row.id, p_bounty_id, notify_kind, notify_title,
      'Trạng thái được đối chiếu trực tiếp với Solana Devnet.'
    from (values (claim_row.finder_id), (bounty_row.owner_id)) recipients(target_id)
    where target_id is not null;
  end if;
  return claim_row.id;
end;
$$;

revoke all on function public.consume_api_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.apply_claim_workflow_action(uuid, uuid, text, text, timestamptz, text, text) from public, anon, authenticated;
revoke all on function public.sync_claim_chain_state(text, text, text, text, text, timestamptz, timestamptz, text, text) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, integer, integer) to service_role;
grant execute on function public.apply_claim_workflow_action(uuid, uuid, text, text, timestamptz, text, text) to service_role;
grant execute on function public.sync_claim_chain_state(text, text, text, text, text, timestamptz, timestamptz, text, text) to service_role;

alter table public.claim_notifications replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'claim_notifications'
     ) then
    alter publication supabase_realtime add table public.claim_notifications;
  end if;
end;
$$;

notify pgrst, 'reload schema';
