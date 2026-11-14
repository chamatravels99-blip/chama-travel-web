-- Recheck invitation expiry after acquiring all locks needed for a response.
create or replace function public.guest_driver_respond_assignment(
  p_token text,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_invitation private.driver_assignment_invitations%rowtype;
  v_assignment public.booking_assignments%rowtype;
  v_booking_status text;
  v_now timestamptz;
begin
  if p_action is null or p_action not in ('accept', 'decline') then
    raise exception 'Driver invitation is unavailable';
  end if;
  v_invitation := private.lock_valid_driver_invitation(p_token);

  select ba.* into v_assignment
    from public.booking_assignments as ba
   where ba.id = v_invitation.assignment_id
   for update;
  select b.booking_status into v_booking_status
    from public.bookings as b
   where b.id = v_invitation.booking_id
   for update;
  v_now := pg_catalog.clock_timestamp();
  if not found
     or v_invitation.expires_at <= v_now
     or v_assignment.assignment_status <> 'offered'
     or v_booking_status in ('cancelled', 'rejected', 'completed')
  then
    raise exception 'Driver invitation is unavailable';
  end if;

  perform pg_catalog.set_config(
    'app.guest_driver_assignment_id', v_assignment.id::text, true
  );
  update public.booking_assignments
     set assignment_status = case p_action when 'accept' then 'accepted' else 'declined' end,
         responded_at = v_now
   where id = v_assignment.id;
  perform pg_catalog.set_config('app.guest_driver_assignment_id', '', true);

  if p_action = 'decline' then
    update public.bookings set booking_status = 'confirmed'
     where id = v_assignment.booking_id and booking_status = 'assigned';
  end if;

  insert into public.booking_events (booking_id, event_type, actor_user_id, details, created_at)
  values (
    v_assignment.booking_id, 'guest_driver_assignment_response', null,
    pg_catalog.jsonb_build_object(
      'invitation_id', v_invitation.id,
      'assignment_id', v_assignment.id,
      'action', p_action
    ),
    v_now
  );
end;
$function$;

create or replace function public.guest_driver_respond_hire_offer(
  p_token text,
  p_offer_id uuid,
  p_accept boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_invitation private.driver_assignment_invitations%rowtype;
  v_offer public.driver_hire_offers%rowtype;
  v_updated integer;
  v_now timestamptz;
begin
  if p_offer_id is null or p_accept is null then
    raise exception 'Driver invitation is unavailable';
  end if;
  v_invitation := private.lock_valid_driver_invitation(p_token);

  select o.* into v_offer
    from public.driver_hire_offers as o
    join public.booking_assignments as ba on ba.id = o.assignment_id
    join public.bookings as b on b.id = ba.booking_id and b.booking_status <> 'cancelled'
   where o.id = p_offer_id
     and o.assignment_id = v_invitation.assignment_id
     and o.driver_user_id = v_invitation.driver_user_id
     and o.is_current
     and ba.assignment_status not in ('declined', 'released')
   for update of o;
  v_now := pg_catalog.clock_timestamp();
  if not found
     or v_invitation.expires_at <= v_now
     or v_offer.offer_status <> 'offered'
  then
    raise exception 'This driver hire offer is no longer available';
  end if;

  perform pg_catalog.set_config('app.guest_driver_offer_id', v_offer.id::text, true);
  update public.driver_hire_offers
     set offer_status = case when p_accept then 'accepted' else 'declined' end,
         responded_by = v_offer.driver_user_id,
         responded_at = v_now
   where id = v_offer.id and is_current and offer_status = 'offered';
  get diagnostics v_updated = row_count;
  perform pg_catalog.set_config('app.guest_driver_offer_id', '', true);
  if v_updated <> 1 then
    raise exception 'This driver hire offer has already been answered';
  end if;
end;
$function$;
