-- Admin operations lifecycle: trip start/complete, booking cancellation, assignment release, and dispatch resource details.

create or replace function private.guard_booking_assignment_update()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_actor_id uuid := (select auth.uid());
  v_actor_authorized boolean;
begin
  if new.booking_id is distinct from old.booking_id
     or new.driver_user_id is distinct from old.driver_user_id
     or new.vehicle_id is distinct from old.vehicle_id
     or new.assigned_by is distinct from old.assigned_by
     or new.assigned_at is distinct from old.assigned_at
     or new.reserved_period is distinct from old.reserved_period
  then
    raise exception 'Assignment identity and reservation are immutable; create a new assignment to reassign';
  end if;

  if not (
    (old.assignment_status = 'offered'
      and new.assignment_status in ('accepted', 'declined', 'released'))
    or (old.assignment_status = 'accepted'
      and new.assignment_status in ('in_progress', 'released'))
    or (old.assignment_status = 'in_progress'
      and new.assignment_status in ('completed', 'released'))
  ) then
    raise exception 'Invalid assignment status transition';
  end if;

  if new.responded_at is distinct from old.responded_at
     and (old.responded_at is not null
       or new.assignment_status not in ('accepted', 'declined')
       or new.responded_at is null)
  then
    raise exception 'Driver response time may be set only once when accepting or declining';
  end if;

  if new.released_at is distinct from old.released_at
     and (old.released_at is not null
       or new.assignment_status <> 'released'
       or new.released_at is null)
  then
    raise exception 'Assignment release time may be set only once when releasing';
  end if;

  if new.assignment_status = 'released' then
    v_actor_authorized := private.has_active_role(
      v_actor_id, array['operator', 'admin', 'super_admin']
    );
  elsif old.assignment_status = 'offered'
        and new.assignment_status in ('accepted', 'declined')
        and pg_catalog.current_setting('app.guest_driver_assignment_id', true)
              is not distinct from old.id::text
  then
    v_actor_authorized := private.has_active_role(old.driver_user_id, array['driver']);
  else
    v_actor_authorized := v_actor_id is not null
      and (
        (v_actor_id = old.driver_user_id and private.has_active_role(v_actor_id, array['driver']))
        or private.has_active_role(v_actor_id, array['admin', 'super_admin'])
      );
  end if;

  if v_actor_authorized is distinct from true then
    raise exception 'Actor is not authorized to change this assignment status';
  end if;

  return new;
end;
$function$;

revoke all on function private.guard_booking_assignment_update()
  from public, anon, authenticated, service_role;

create or replace function public.admin_start_trip(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_booking public.bookings%rowtype;
  v_assignment public.booking_assignments%rowtype;
begin
  if not private.has_active_role(v_actor, array['admin', 'super_admin']) then
    raise exception 'An active Admin is required';
  end if;

  select * into v_booking
    from public.bookings
   where id = p_booking_id
   for update;
  if not found or v_booking.booking_status not in ('assigned', 'confirmed') then
    raise exception 'Only assigned bookings can be started';
  end if;

  select * into v_assignment
    from public.booking_assignments
   where booking_id = p_booking_id
     and assignment_status in ('offered', 'accepted')
   order by assigned_at desc
   limit 1
   for update;

  if v_assignment.id is not null then
    if v_assignment.assignment_status = 'offered' then
      update public.booking_assignments
         set assignment_status = 'accepted', responded_at = pg_catalog.now()
       where id = v_assignment.id;
    end if;
    update public.booking_assignments
       set assignment_status = 'in_progress'
     where id = v_assignment.id;
  end if;

  update public.bookings
     set booking_status = 'in_progress'
   where id = p_booking_id;

  update public.booking_legs
     set trip_status = 'in_progress'
   where booking_id = p_booking_id
     and trip_status in ('not_started');
end;
$function$;

create or replace function public.admin_complete_trip(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_booking public.bookings%rowtype;
begin
  if not private.has_active_role(v_actor, array['admin', 'super_admin']) then
    raise exception 'An active Admin is required';
  end if;

  select * into v_booking
    from public.bookings
   where id = p_booking_id
   for update;
  if not found or v_booking.booking_status <> 'in_progress' then
    raise exception 'Only in-progress bookings can be completed';
  end if;

  update public.booking_assignments
     set assignment_status = 'completed'
   where booking_id = p_booking_id
     and assignment_status = 'in_progress';

  update public.bookings
     set booking_status = 'completed'
   where id = p_booking_id;

  update public.booking_legs
     set trip_status = 'completed'
   where booking_id = p_booking_id
     and trip_status in ('in_progress', 'not_started');
end;
$function$;

create or replace function public.admin_cancel_booking(
  p_booking_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_booking public.bookings%rowtype;
  v_reason text := pg_catalog.btrim(coalesce(p_reason, ''));
  v_assignment record;
begin
  if not private.has_active_role(v_actor, array['admin', 'super_admin']) then
    raise exception 'An active Admin is required';
  end if;
  if pg_catalog.char_length(v_reason) < 3 then
    raise exception 'A cancellation reason of at least 3 characters is required';
  end if;

  select * into v_booking
    from public.bookings
   where id = p_booking_id
   for update;
  if not found then
    raise exception 'Booking is unavailable';
  end if;
  if v_booking.booking_status in ('completed', 'cancelled') then
    raise exception 'Completed or cancelled bookings cannot be cancelled';
  end if;

  for v_assignment in
    select id
      from public.booking_assignments
     where booking_id = p_booking_id
       and assignment_status in ('offered', 'accepted', 'in_progress')
     for update
  loop
    update public.booking_assignments
       set assignment_status = 'released',
           released_at = pg_catalog.now(),
           release_reason = v_reason
     where id = v_assignment.id;
  end loop;

  update public.booking_quotes
     set quote_status = 'expired'
   where booking_id = p_booking_id
     and quote_status in ('draft', 'sent');

  update public.bookings
     set booking_status = 'cancelled'
   where id = p_booking_id;

  update public.booking_legs
     set trip_status = 'cancelled'
   where booking_id = p_booking_id
     and trip_status not in ('completed');

  insert into public.booking_internal_notes (
    booking_id, author_user_id, note
  )
  values (
    p_booking_id,
    v_actor,
    pg_catalog.concat('Booking cancelled by Admin. Reason: ', v_reason)
  );
end;
$function$;

create or replace function public.admin_release_driver_assignment(
  p_booking_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_booking public.bookings%rowtype;
  v_reason text := pg_catalog.btrim(coalesce(p_reason, ''));
  v_assignment record;
begin
  if not private.has_active_role(v_actor, array['admin', 'super_admin']) then
    raise exception 'An active Admin is required';
  end if;
  if pg_catalog.char_length(v_reason) < 3 then
    raise exception 'A release reason of at least 3 characters is required';
  end if;

  select * into v_booking
    from public.bookings
   where id = p_booking_id
   for update;
  if not found or v_booking.booking_status <> 'assigned' then
    raise exception 'Only assigned bookings can have assignments released';
  end if;

  for v_assignment in
    select id
      from public.booking_assignments
     where booking_id = p_booking_id
       and assignment_status in ('offered', 'accepted')
     for update
  loop
    update public.booking_assignments
       set assignment_status = 'released',
           released_at = pg_catalog.now(),
           release_reason = v_reason
     where id = v_assignment.id;
  end loop;

  update public.bookings
     set booking_status = 'confirmed'
   where id = p_booking_id;

  insert into public.booking_internal_notes (
    booking_id, author_user_id, note
  )
  values (
    p_booking_id,
    v_actor,
    pg_catalog.concat('Driver assignment released. Reason: ', v_reason)
  );
end;
$function$;

create or replace function public.list_dispatch_resources()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
begin
  if not private.has_active_role((select auth.uid()), array['admin', 'super_admin']) then
    raise exception 'An active Admin is required';
  end if;

  select pg_catalog.jsonb_build_object(
    'drivers', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', p.id,
          'full_name', p.full_name,
          'phone', p.phone
        ) order by p.full_name
      )
        from public.profiles as p
        join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
        join public.roles as r on r.id = ur.role_id and r.code = 'driver'
       where p.account_status = 'active'
    ), '[]'::jsonb),
    'vehicles', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', v.id,
          'display_name', v.display_name,
          'registration_number', v.registration_number,
          'category_id', v.category_id,
          'category_name', vc.display_name,
          'max_passengers', vc.max_passengers,
          'max_luggage', vc.max_luggage,
          'operational_status', v.operational_status
        ) order by v.display_name
      )
        from public.vehicles as v
        join public.vehicle_categories as vc on vc.id = v.category_id
       where v.operational_status = 'active'
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$function$;

create or replace function public.list_operations_bookings()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
begin
  if not private.has_active_role((select auth.uid()), array['admin', 'super_admin']) then
    raise exception 'An active Admin is required';
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', b.id,
        'booking_ref', b.booking_ref,
        'customer_name', b.customer_name,
        'customer_email', b.customer_email,
        'customer_phone', b.customer_phone,
        'service_type', b.service_type,
        'journey_type', b.journey_type,
        'booking_status', b.booking_status,
        'currency', b.requested_currency,
        'passenger_count', b.passenger_count,
        'luggage_count', b.luggage_count,
        'customer_notes', b.customer_notes,
        'created_at', b.created_at,
        'legs', coalesce((
          select pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'sequence_no', bl.sequence_no,
              'pickup_location', bl.pickup_location,
              'dropoff_location', bl.dropoff_location,
              'pickup_at', bl.pickup_at,
              'planned_end_at', bl.planned_end_at,
              'trip_status', bl.trip_status
            ) order by bl.sequence_no
          )
            from public.booking_legs as bl
           where bl.booking_id = b.id
        ), '[]'::jsonb),
        'assignment', (
          select pg_catalog.jsonb_build_object(
            'id', ba.id,
            'driver_user_id', ba.driver_user_id,
            'driver_name', dp.full_name,
            'driver_phone', dp.phone,
            'vehicle_id', ba.vehicle_id,
            'vehicle_name', v.display_name,
            'vehicle_registration', v.registration_number,
            'vehicle_category', vc.display_name,
            'assignment_status', ba.assignment_status
          )
            from public.booking_assignments as ba
            left join public.profiles as dp on dp.id = ba.driver_user_id
            left join public.vehicles as v on v.id = ba.vehicle_id
            left join public.vehicle_categories as vc on vc.id = v.category_id
           where ba.booking_id = b.id
             and ba.assignment_status in ('offered', 'accepted', 'in_progress')
           order by ba.assigned_at desc
           limit 1
        ),
        'quotes', coalesce((
          select pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'id', q.id,
              'revision', q.revision,
              'currency', q.currency,
              'total', q.total,
              'quote_status', q.quote_status,
              'expires_at', q.expires_at,
              'has_guest_acceptance_link', q.acceptance_token_hash is not null,
              'token_expires_at', q.token_expires_at,
              'token_consumed_at', q.token_consumed_at,
              'token_revoked_at', q.token_revoked_at
            ) order by q.revision desc
          )
            from public.booking_quotes as q
           where q.booking_id = b.id
        ), '[]'::jsonb),
        'financials', (
          select pg_catalog.jsonb_build_object(
            'quote_id', aq.id,
            'quote_total', aq.total,
            'currency', aq.currency,
            'total_paid', coalesce(
              pg_catalog.sum(p.amount) filter (where p.entry_type = 'receipt'),
              0
            ),
            'net_paid', coalesce(
              pg_catalog.sum(case when p.entry_type = 'receipt' then p.amount else -p.amount end),
              0
            ),
            'outstanding_balance', greatest(
              aq.total - coalesce(
                pg_catalog.sum(case when p.entry_type = 'receipt' then p.amount else -p.amount end),
                0
              ),
              0
            ),
            'payment_status', case
              when coalesce(pg_catalog.sum(case when p.entry_type = 'receipt' then p.amount else -p.amount end), 0) >= aq.total then 'paid'
              when coalesce(pg_catalog.sum(case when p.entry_type = 'receipt' then p.amount else -p.amount end), 0) > 0 then 'partially_paid'
              else 'unpaid'
            end
          )
            from public.booking_quotes as aq
            left join public.payments as p on p.booking_id = b.id and p.quote_id = aq.id
           where aq.booking_id = b.id and aq.quote_status = 'accepted'
           group by aq.id, aq.total, aq.currency
           order by aq.revision desc
           limit 1
        )
      ) order by b.created_at desc
    ),
    '[]'::jsonb
  )
    into v_result
    from public.bookings as b;

  return v_result;
end;
$function$;

revoke all on function public.admin_start_trip(uuid) from public, anon, authenticated;
grant execute on function public.admin_start_trip(uuid) to authenticated;

revoke all on function public.admin_complete_trip(uuid) from public, anon, authenticated;
grant execute on function public.admin_complete_trip(uuid) to authenticated;

revoke all on function public.admin_cancel_booking(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_cancel_booking(uuid, text) to authenticated;

revoke all on function public.admin_release_driver_assignment(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_release_driver_assignment(uuid, text) to authenticated;

revoke all on function public.list_dispatch_resources() from public, anon, authenticated;
grant execute on function public.list_dispatch_resources() to authenticated;

revoke all on function public.list_operations_bookings() from public, anon, authenticated;
grant execute on function public.list_operations_bookings() to authenticated;
