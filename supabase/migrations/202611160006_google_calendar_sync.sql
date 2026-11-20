-- Real-Time Google Calendar Sync tracking columns and SECURITY DEFINER helpers for public.bookings

alter table public.bookings
  add column if not exists google_calendar_event_id text,
  add column if not exists google_calendar_synced_at timestamptz,
  add column if not exists google_calendar_sync_error text;

create index if not exists bookings_google_calendar_event_idx
  on public.bookings (google_calendar_event_id)
  where google_calendar_event_id is not null;

create or replace function public.get_booking_for_calendar_sync(
  p_booking_id uuid default null,
  p_quote_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_booking_id uuid := p_booking_id;
  v_result jsonb;
begin
  if coalesce((select auth.role()), '') <> 'service_role'
     and current_user <> 'service_role'
     and not private.is_active_admin() then
    raise exception 'An active Admin is required';
  end if;

  if v_booking_id is null and p_quote_id is not null then
    select q.booking_id
      into v_booking_id
      from public.booking_quotes as q
     where q.id = p_quote_id;
  end if;

  if v_booking_id is null then
    return null;
  end if;

  select pg_catalog.jsonb_build_object(
    'id', b.id,
    'booking_ref', b.booking_ref,
    'customer_name', b.customer_name,
    'customer_email', b.customer_email,
    'customer_phone', b.customer_phone,
    'service_type', b.service_type,
    'journey_type', b.journey_type,
    'booking_status', b.booking_status,
    'currency', pg_catalog.btrim(b.requested_currency::text),
    'passenger_count', b.passenger_count,
    'luggage_count', b.luggage_count,
    'customer_notes', b.customer_notes,
    'google_calendar_event_id', b.google_calendar_event_id,
    'google_calendar_synced_at', b.google_calendar_synced_at,
    'google_calendar_sync_error', b.google_calendar_sync_error,
    'created_at', b.created_at,
    'legs', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'sequence_no', bl.sequence_no,
          'pickup_location', bl.pickup_location,
          'dropoff_location', bl.dropoff_location,
          'pickup_at', bl.pickup_at,
          'planned_end_at', bl.planned_end_at,
          'flight_number', bl.flight_number,
          'trip_notes', bl.trip_notes,
          'trip_status', bl.trip_status
        ) order by bl.sequence_no asc
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
        and ba.assignment_status in ('offered', 'accepted', 'in_progress', 'completed')
      order by ba.assigned_at desc
      limit 1
    ),
    'accepted_quote', (
      select pg_catalog.jsonb_build_object(
        'id', q.id,
        'revision', q.revision,
        'currency', pg_catalog.btrim(q.currency::text),
        'total', q.total,
        'quote_status', q.quote_status
      )
      from public.booking_quotes as q
      where q.booking_id = b.id
        and q.quote_status in ('accepted', 'sent')
      order by (case when q.quote_status = 'accepted' then 0 else 1 end), q.revision desc
      limit 1
    )
  )
    into v_result
    from public.bookings as b
   where b.id = v_booking_id;

  return v_result;
end;
$function$;

create or replace function public.record_booking_calendar_sync_result(
  p_booking_id uuid,
  p_event_id text,
  p_synced_at timestamptz,
  p_sync_error text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if coalesce((select auth.role()), '') <> 'service_role'
     and current_user <> 'service_role'
     and not private.is_active_admin() then
    raise exception 'An active Admin is required';
  end if;

  if p_booking_id is null then
    raise exception 'Booking ID is required';
  end if;

  update public.bookings
     set google_calendar_event_id = p_event_id,
         google_calendar_synced_at = p_synced_at,
         google_calendar_sync_error = p_sync_error
   where id = p_booking_id;
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
        'google_calendar_event_id', b.google_calendar_event_id,
        'google_calendar_synced_at', b.google_calendar_synced_at,
        'google_calendar_sync_error', b.google_calendar_sync_error,
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
             and ba.assignment_status in ('offered', 'accepted', 'in_progress', 'completed')
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

revoke all on function public.get_booking_for_calendar_sync(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_booking_for_calendar_sync(uuid, uuid)
  to authenticated, service_role;

revoke all on function public.record_booking_calendar_sync_result(uuid, text, timestamptz, text)
  from public, anon, authenticated, service_role;
grant execute on function public.record_booking_calendar_sync_result(uuid, text, timestamptz, text)
  to authenticated, service_role;

revoke all on function public.list_operations_bookings()
  from public, anon, authenticated, service_role;
grant execute on function public.list_operations_bookings()
  to authenticated;

create or replace function public.create_booking(
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_service_type text,
  p_journey_type text,
  p_category_code text,
  p_passenger_count smallint,
  p_luggage_count smallint,
  p_customer_notes text,
  p_requested_currency char(3),
  p_idempotency_key text,
  p_legs jsonb
)
returns table (booking_id uuid, booking_ref text)
language plpgsql
security definer
set search_path = ''
as $function$
#variable_conflict use_column
declare
  v_user_id uuid := (select auth.uid());
  v_is_admin boolean := private.is_active_admin();
  v_category_id uuid;
  v_booking_id uuid;
  v_booking_ref text;
  v_leg jsonb;
  v_leg_count integer;
  v_sequence smallint := 0;
begin
  if p_customer_name is null or pg_catalog.char_length(pg_catalog.btrim(p_customer_name)) not between 2 and 120
     or p_customer_email is null or pg_catalog.char_length(p_customer_email) > 254
     or p_customer_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
     or p_customer_phone is null or pg_catalog.char_length(pg_catalog.btrim(p_customer_phone)) not between 7 and 30
     or p_customer_phone !~ '^\+?[0-9[:space:]()-]+$'
     or pg_catalog.char_length(pg_catalog.regexp_replace(p_customer_phone, '[^0-9]', '', 'g')) not between 7 and 15
     or (p_customer_notes is not null and pg_catalog.char_length(p_customer_notes) > 1000)
     or p_service_type not in ('airport_transfer', 'day_trip', 'round_tour', 'vehicle_hire', 'custom')
     or p_journey_type not in ('one_way', 'return', 'multi_leg')
     or p_requested_currency not in ('LKR', 'USD')
     or p_passenger_count not between 1 and 14
     or p_luggage_count not between 0 and 14
     or p_idempotency_key is null
     or p_idempotency_key !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
     or pg_catalog.jsonb_typeof(p_legs) is distinct from 'array'
  then
    raise exception 'Booking details are invalid';
  end if;

  v_leg_count := pg_catalog.jsonb_array_length(p_legs);
  if (p_journey_type = 'one_way' and v_leg_count <> 1)
     or (p_journey_type = 'return' and v_leg_count <> 2)
     or (p_journey_type = 'multi_leg' and (v_leg_count < 2 or v_leg_count > 8))
     or v_leg_count > 8
  then
    raise exception 'The number of booking legs does not match the journey type';
  end if;

  if v_user_id is not null then
    if not exists (
      select 1
        from public.profiles as p
        join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
        join public.roles as r on r.id = ur.role_id and r.code = 'customer'
       where p.id = v_user_id and p.account_status = 'active'
    ) then
      v_user_id := null;
    end if;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(74124, pg_catalog.hashtext(p_idempotency_key));

  select vc.id
    into v_category_id
    from public.vehicle_categories as vc
   where vc.code = p_category_code
     and vc.is_active;
  if not found then
    raise exception 'The selected vehicle category is unavailable';
  end if;

  select b.id, b.booking_ref
    into v_booking_id, v_booking_ref
    from public.bookings as b
   where b.idempotency_key = p_idempotency_key;
  if found then
    if (select b.customer_user_id from public.bookings as b where b.id = v_booking_id)
       is distinct from v_user_id then
      raise exception 'Booking submission could not be completed';
    end if;
    return query select v_booking_id, v_booking_ref;
    return;
  end if;

  v_booking_ref := 'CT-' || pg_catalog.upper(
    pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 12)
  );
  insert into public.bookings as bk (
    booking_ref, customer_user_id, customer_name, customer_email, customer_phone,
    service_type, journey_type, requested_category_id, passenger_count,
    luggage_count, customer_notes, requested_currency, idempotency_key
  )
  values (
    v_booking_ref, v_user_id, pg_catalog.btrim(p_customer_name),
    pg_catalog.lower(pg_catalog.btrim(p_customer_email)),
    pg_catalog.btrim(p_customer_phone), p_service_type, p_journey_type,
    v_category_id, p_passenger_count, p_luggage_count,
    nullif(pg_catalog.btrim(coalesce(p_customer_notes, '')), ''),
    p_requested_currency, p_idempotency_key
  )
  returning bk.id into v_booking_id;

  for v_leg in select value from pg_catalog.jsonb_array_elements(p_legs)
  loop
    v_sequence := v_sequence + 1;
    if pg_catalog.jsonb_typeof(v_leg) is distinct from 'object'
       or pg_catalog.char_length(pg_catalog.btrim(coalesce(v_leg ->> 'pickup_location', ''))) not between 2 and 200
       or pg_catalog.char_length(pg_catalog.btrim(coalesce(v_leg ->> 'dropoff_location', ''))) not between 2 and 200
       or coalesce(v_leg ->> 'pickup_at', '') = ''
    then
      raise exception 'Each booking leg requires pickup, drop-off, and pickup time';
    end if;
    if (not v_is_admin and (v_leg ->> 'pickup_at')::timestamptz <= pg_catalog.now())
       or (nullif(v_leg ->> 'planned_end_at', '') is not null
           and (v_leg ->> 'planned_end_at')::timestamptz <= (v_leg ->> 'pickup_at')::timestamptz)
       or pg_catalog.char_length(coalesce(v_leg ->> 'flight_number', '')) > 20
       or pg_catalog.char_length(coalesce(v_leg ->> 'trip_notes', '')) > 1000
    then
      raise exception 'Booking leg schedule or details are invalid';
    end if;

    insert into public.booking_legs (
      booking_id, sequence_no, pickup_location, dropoff_location, pickup_at,
      planned_end_at, flight_number, flight_arrival_at, trip_notes
    )
    values (
      v_booking_id,
      v_sequence,
      pg_catalog.btrim(v_leg ->> 'pickup_location'),
      pg_catalog.btrim(v_leg ->> 'dropoff_location'),
      (v_leg ->> 'pickup_at')::timestamptz,
      nullif(v_leg ->> 'planned_end_at', '')::timestamptz,
      nullif(pg_catalog.btrim(v_leg ->> 'flight_number'), ''),
      nullif(v_leg ->> 'flight_arrival_at', '')::timestamptz,
      nullif(pg_catalog.btrim(v_leg ->> 'trip_notes'), '')
    );
  end loop;

  return query select v_booking_id, v_booking_ref;
end;
$function$;

revoke all on function public.create_booking(
  text, text, text, text, text, text, smallint, smallint, text, char, text, jsonb
) from public, anon, authenticated, service_role;

create or replace function public.admin_create_manual_booking(
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_service_type text,
  p_journey_type text,
  p_category_code text,
  p_passenger_count smallint,
  p_luggage_count smallint,
  p_customer_notes text,
  p_requested_currency text,
  p_idempotency_key text,
  p_legs jsonb
)
returns table (booking_id uuid, booking_ref text)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not private.is_active_admin() then
    raise exception 'An active Admin is required';
  end if;

  if p_requested_currency is null or p_requested_currency not in ('LKR', 'USD') then
    raise exception 'Booking details are invalid';
  end if;

  return query
    select b.booking_id, b.booking_ref
      from public.create_booking(
        p_customer_name,
        p_customer_email,
        p_customer_phone,
        p_service_type,
        p_journey_type,
        p_category_code,
        p_passenger_count,
        p_luggage_count,
        p_customer_notes,
        p_requested_currency::char(3),
        p_idempotency_key,
        p_legs
      ) as b;
end;
$function$;

revoke all on function public.admin_create_manual_booking(
  text, text, text, text, text, text, smallint, smallint, text, text, text, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.admin_create_manual_booking(
  text, text, text, text, text, text, smallint, smallint, text, text, text, jsonb
) to authenticated;
