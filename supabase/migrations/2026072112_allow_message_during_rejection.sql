-- Allow messaging during rejection_pending (dispute window negotiation).

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

  -- settled/rejected/disputed always closed.
  -- rejection_pending: allow send_message only so parties can negotiate.
  if claim_row.workflow_status in ('settled', 'rejected', 'disputed') then
    raise exception 'WORKFLOW_CLOSED';
  end if;
  if claim_row.workflow_status = 'rejection_pending' and p_action <> 'send_message' then
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

