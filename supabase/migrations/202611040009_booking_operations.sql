alter table public.bookings
  add column requested_currency char(3) not null default 'LKR',
  add constraint bookings_requested_currency_check
    check (requested_currency in ('LKR', 'USD'));

alter table public.payments
  add column refund_reason text,
  add constraint payments_refund_reason_check
    check (
      (entry_type = 'receipt' and refund_reason is null)
      or (entry_type = 'refund' and nullif(pg_catalog.btrim(refund_reason), '') is not null)
    ) not valid;

insert into public.vehicle_categories (code, display_name, max_passengers, max_luggage)
values
  ('sedan', 'Sedan', 3, 2),
  ('luxury_van', 'Luxury Van / KDH', 7, 6),
  ('mini_bus', 'Mini Bus', 14, 14)
on conflict (code) do nothing;

create or replace function public.get_my_roles()
returns text[]
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(pg_catalog.array_agg(r.code order by r.code), array[]::text[])
    from public.user_roles as ur
    join public.roles as r on r.id = ur.role_id
    join public.profiles as p on p.id = ur.user_id
   where ur.user_id = (select auth.uid())
     and ur.revoked_at is null
     and p.account_status = 'active';
$function$;

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
declare
  v_user_id uuid := (select auth.uid());
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
      raise exception 'An active customer account is required';
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
  insert into public.bookings (
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
  returning id into v_booking_id;

  for v_leg in select value from pg_catalog.jsonb_array_elements(p_legs)
  loop
    v_sequence := v_sequence + 1;
    if pg_catalog.jsonb_typeof(v_leg) is distinct from 'object'
       or pg_catalog.char_length(pg_catalog.btrim(coalesce(v_leg ->> 'pickup_location', ''))) not between 2 and 200
       or pg_catalog.char_length(pg_catalog.btrim(coalesce(v_leg ->> 'dropoff_location', ''))) not between 2 and 200
       or coalesce(v_leg ->> 'pickup_at', '') = ''
       or coalesce(v_leg ->> 'planned_end_at', '') = ''
    then
      raise exception 'Each booking leg requires pickup, drop-off, pickup time, and expected end time';
    end if;
    if (v_leg ->> 'pickup_at')::timestamptz <= pg_catalog.now()
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

create or replace function public.issue_booking_quote(
  p_booking_id uuid,
  p_currency char(3),
  p_expires_at timestamptz
)
returns table (quote_id uuid, guest_token text, total numeric(12, 2))
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_booking public.bookings%rowtype;
  v_package_id uuid;
  v_quote_id uuid;
  v_token text;
  v_total numeric(12, 2) := 0;
  v_quantity numeric(10, 2);
  v_days numeric(10, 2);
  v_legs integer;
  v_rule record;
  v_revision integer;
begin
  if not exists (
    select 1
      from public.profiles as p
      join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
      join public.roles as r on r.id = ur.role_id
     where p.id = v_actor
       and p.account_status = 'active'
       and r.code in ('operator', 'admin', 'super_admin')
  ) then
    raise exception 'An active Operator or Admin is required';
  end if;
  if p_currency not in ('LKR', 'USD')
     or p_expires_at <= pg_catalog.now()
     or p_expires_at > pg_catalog.now() + interval '30 days'
  then
    raise exception 'Quote currency or expiry is invalid';
  end if;

  select b.* into v_booking
    from public.bookings as b
   where b.id = p_booking_id
   for update;
  if not found or v_booking.booking_status not in ('pending', 'reviewing', 'quoted') then
    raise exception 'This booking cannot be quoted';
  end if;
  if v_booking.requested_currency <> p_currency then
    raise exception 'Quote currency must match the customer request';
  end if;

  if v_booking.booking_status in ('pending', 'quoted') then
    update public.bookings
       set booking_status = 'reviewing'
     where id = p_booking_id;
  end if;
  update public.booking_quotes
     set quote_status = 'superseded'
   where booking_id = p_booking_id
     and quote_status = 'sent';

  select pp.id
    into v_package_id
    from public.pricing_packages as pp
   where pp.service_type = v_booking.service_type
     and pp.currency = p_currency
     and pp.is_active
     and (pp.valid_from is null or pp.valid_from <= pg_catalog.now())
     and (pp.valid_until is null or pp.valid_until > pg_catalog.now())
   order by pp.valid_from desc nulls last, pp.created_at desc, pp.id
   limit 1;
  if v_package_id is null then
    raise exception 'No active pricing package is configured for this service and currency';
  end if;

  select pg_catalog.count(*)::integer,
         greatest(
           1::numeric,
           pg_catalog.ceil(
             pg_catalog.date_part('epoch', pg_catalog.max(bl.planned_end_at) - pg_catalog.min(bl.pickup_at))
             / 86400
           )
         )::numeric(10, 2)
    into v_legs, v_days
    from public.booking_legs as bl
   where bl.booking_id = p_booking_id;

  select coalesce(pg_catalog.max(q.revision), 0) + 1
    into v_revision
    from public.booking_quotes as q
   where q.booking_id = p_booking_id;

  v_token := case when v_booking.customer_user_id is null
    then pg_catalog.encode(extensions.gen_random_bytes(32), 'hex')
    else null end;

  insert into public.booking_quotes (
    booking_id, revision, currency, total, quote_status, issued_by,
    acceptance_token_hash, token_expires_at
  )
  values (
    p_booking_id, v_revision, p_currency, 0, 'draft', v_actor,
    case when v_token is null then null
         else extensions.digest(pg_catalog.convert_to(v_token, 'UTF8'), 'sha256') end,
    case when v_token is null then null else p_expires_at end
  )
  returning id into v_quote_id;

  for v_rule in
    select pr.id, pr.rule_type, pr.unit, pr.amount, pr.min_quantity,
           pr.max_quantity
      from public.pricing_rules as pr
     where pr.package_id = v_package_id
       and pr.is_active
       and (pr.category_id is null or pr.category_id = v_booking.requested_category_id)
     order by pr.id
  loop
    v_quantity := case v_rule.unit
      when 'booking' then 1
      when 'leg' then v_legs
      when 'passenger' then v_booking.passenger_count
      when 'day' then v_days
      else null
    end;
    if v_quantity is null then
      raise exception 'Pricing rule unit "%" is not supported', v_rule.unit;
    end if;
    if (v_rule.min_quantity is not null and v_quantity < v_rule.min_quantity)
       or (v_rule.max_quantity is not null and v_quantity > v_rule.max_quantity)
    then
      continue;
    end if;
    insert into public.booking_quote_lines (
      quote_id, pricing_rule_id, description, quantity, unit_amount, line_total
    )
    values (
      v_quote_id, v_rule.id, v_rule.rule_type || ' (' || v_rule.unit || ')',
      v_quantity, v_rule.amount, pg_catalog.round(v_quantity * v_rule.amount, 2)
    );
    v_total := v_total + pg_catalog.round(v_quantity * v_rule.amount, 2);
  end loop;

  if not exists (
    select 1 from public.booking_quote_lines as ql where ql.quote_id = v_quote_id
  ) then
    raise exception 'No applicable pricing rules are configured for this booking';
  end if;

  update public.booking_quotes
     set total = v_total, quote_status = 'sent', issued_at = pg_catalog.now(),
         expires_at = p_expires_at
   where id = v_quote_id;
  update public.bookings
     set booking_status = 'quoted'
   where id = p_booking_id;

  return query select v_quote_id, v_token, v_total;
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
  if not exists (
    select 1
      from public.profiles as p
      join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
      join public.roles as r on r.id = ur.role_id
     where p.id = (select auth.uid())
       and p.account_status = 'active'
       and r.code in ('operator', 'admin', 'super_admin')
  ) then
    raise exception 'An active Operator or Admin is required';
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
            'vehicle_id', ba.vehicle_id,
            'assignment_status', ba.assignment_status
          )
            from public.booking_assignments as ba
           where ba.booking_id = b.id
             and ba.assignment_status in ('offered', 'accepted', 'in_progress')
           limit 1
        ),
        'quotes', coalesce((
          select pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'id', q.id, 'revision', q.revision, 'currency', q.currency,
              'total', q.total, 'quote_status', q.quote_status,
              'expires_at', q.expires_at
            ) order by q.revision desc
          )
            from public.booking_quotes as q
           where q.booking_id = b.id
        ), '[]'::jsonb)
      ) order by b.created_at desc
    ),
    '[]'::jsonb
  )
    into v_result
    from public.bookings as b;
  return v_result;
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
  if not exists (
    select 1
      from public.profiles as p
      join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
      join public.roles as r on r.id = ur.role_id
     where p.id = (select auth.uid())
       and p.account_status = 'active'
       and r.code in ('operator', 'admin', 'super_admin')
  ) then
    raise exception 'An active Operator or Admin is required';
  end if;

  select pg_catalog.jsonb_build_object(
    'drivers', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', p.id, 'full_name', p.full_name, 'phone', p.phone
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
          'id', v.id, 'display_name', v.display_name,
          'category_id', v.category_id, 'category_name', vc.display_name
        ) order by v.display_name
      )
        from public.vehicles as v
        join public.vehicle_categories as vc on vc.id = v.category_id
       where v.operational_status = 'active' and vc.is_active
    ), '[]'::jsonb)
  )
    into v_result;
  return v_result;
end;
$function$;

create or replace function public.list_driver_assignments()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_result jsonb;
begin
  if not exists (
    select 1
      from public.profiles as p
      join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
      join public.roles as r on r.id = ur.role_id and r.code = 'driver'
     where p.id = v_user_id and p.account_status = 'active'
  ) then
    raise exception 'An active Driver account is required';
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', ba.id,
        'assignment_status', ba.assignment_status,
        'booking', pg_catalog.jsonb_build_object(
          'id', b.id,
          'booking_ref', b.booking_ref,
          'service_type', b.service_type,
          'booking_status', b.booking_status,
          'customer_name', b.customer_name,
          'customer_phone', b.customer_phone,
          'passenger_count', b.passenger_count,
          'luggage_count', b.luggage_count
        ),
        'vehicle', pg_catalog.jsonb_build_object(
          'display_name', v.display_name,
          'category_name', vc.display_name
        ),
        'legs', (
          select coalesce(
            pg_catalog.jsonb_agg(
              pg_catalog.jsonb_build_object(
                'sequence_no', bl.sequence_no,
                'pickup_location', bl.pickup_location,
                'dropoff_location', bl.dropoff_location,
                'pickup_at', bl.pickup_at,
                'planned_end_at', bl.planned_end_at,
                'flight_number', bl.flight_number,
                'trip_notes', bl.trip_notes,
                'trip_status', bl.trip_status
              ) order by bl.sequence_no
            ),
            '[]'::jsonb
          )
            from public.booking_legs as bl
           where bl.booking_id = b.id
        )
      ) order by ba.assigned_at desc
    ),
    '[]'::jsonb
  )
    into v_result
    from public.booking_assignments as ba
    join public.bookings as b on b.id = ba.booking_id
    join public.vehicles as v on v.id = ba.vehicle_id
    join public.vehicle_categories as vc on vc.id = v.category_id
   where ba.driver_user_id = v_user_id
     and ba.assignment_status in ('offered', 'accepted', 'in_progress', 'completed');
  return v_result;
end;
$function$;

create or replace function public.create_booking_assignment(
  p_booking_id uuid,
  p_driver_user_id uuid,
  p_vehicle_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_start timestamptz;
  v_end timestamptz;
  v_assignment_id uuid;
begin
  if not exists (
    select 1
      from public.profiles as p
      join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
      join public.roles as r on r.id = ur.role_id
     where p.id = v_actor and p.account_status = 'active'
       and r.code in ('operator', 'admin', 'super_admin')
  ) then
    raise exception 'An active Operator or Admin is required';
  end if;

  perform 1 from public.bookings as b
   where b.id = p_booking_id and b.booking_status = 'confirmed'
   for update;
  if not found then
    raise exception 'Only confirmed bookings can be assigned';
  end if;

  select pg_catalog.min(bl.pickup_at), pg_catalog.max(bl.planned_end_at)
    into v_start, v_end
    from public.booking_legs as bl
   where bl.booking_id = p_booking_id;
  if v_start is null or v_end is null then
    raise exception 'All booking legs require planned end times before assignment';
  end if;

  insert into public.booking_assignments (
    booking_id, driver_user_id, vehicle_id, assigned_by, reserved_period
  )
  values (
    p_booking_id, p_driver_user_id, p_vehicle_id, v_actor,
    pg_catalog.tstzrange(v_start, v_end, '[)')
  )
  returning id into v_assignment_id;

  update public.bookings
     set booking_status = 'assigned'
   where id = p_booking_id;
  return v_assignment_id;
end;
$function$;

create or replace function public.update_driver_assignment(
  p_assignment_id uuid,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_assignment public.booking_assignments%rowtype;
  v_booking_status text;
  v_now timestamptz := pg_catalog.now();
begin
  select ba.* into v_assignment
    from public.booking_assignments as ba
   where ba.id = p_assignment_id
   for update;
  if not found or v_assignment.driver_user_id is distinct from (select auth.uid()) then
    raise exception 'Assignment is unavailable';
  end if;

  select b.booking_status into v_booking_status
    from public.bookings as b
   where b.id = v_assignment.booking_id
   for update;

  if p_action in ('accept', 'decline') and v_assignment.assignment_status = 'offered' then
    update public.booking_assignments
       set assignment_status = case p_action when 'accept' then 'accepted' else 'declined' end,
           responded_at = v_now
     where id = p_assignment_id;
    if p_action = 'decline' then
      update public.bookings set booking_status = 'confirmed'
       where id = v_assignment.booking_id and booking_status = 'assigned';
    end if;
  elsif p_action = 'start'
        and v_assignment.assignment_status = 'accepted'
        and v_booking_status = 'assigned' then
    update public.booking_assignments set assignment_status = 'in_progress'
     where id = p_assignment_id;
    update public.bookings set booking_status = 'in_progress'
     where id = v_assignment.booking_id;
    update public.booking_legs set trip_status = 'in_progress'
     where booking_id = v_assignment.booking_id and trip_status = 'not_started';
  elsif p_action = 'complete'
        and v_assignment.assignment_status = 'in_progress'
        and v_booking_status = 'in_progress' then
    update public.booking_assignments set assignment_status = 'completed'
     where id = p_assignment_id;
    update public.bookings set booking_status = 'completed'
     where id = v_assignment.booking_id;
    update public.booking_legs set trip_status = 'completed'
     where booking_id = v_assignment.booking_id and trip_status = 'in_progress';
  else
    raise exception 'This assignment action is not permitted in its current state';
  end if;
end;
$function$;

create or replace function public.submit_payment_claim(
  p_booking_id uuid,
  p_quote_id uuid,
  p_amount numeric(12, 2),
  p_method text,
  p_customer_reference text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_currency char(3);
  v_claim_id uuid;
begin
  if v_user_id is null or not exists (
    select 1
      from public.profiles as p
      join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
      join public.roles as r on r.id = ur.role_id and r.code = 'customer'
     where p.id = v_user_id
       and p.account_status = 'active'
  ) then
    raise exception 'An active customer account is required';
  end if;
  select q.currency into v_currency
    from public.booking_quotes as q
    join public.bookings as b on b.id = q.booking_id
   where q.id = p_quote_id
     and q.booking_id = p_booking_id
     and q.quote_status = 'accepted'
     and b.customer_user_id = v_user_id;
  if not found then
    raise exception 'Payment claim is unavailable';
  end if;

  insert into public.payment_claims (
    booking_id, quote_id, amount, currency, method, customer_reference, submitted_by
  )
  values (
    p_booking_id, p_quote_id, p_amount, v_currency, p_method,
    nullif(pg_catalog.btrim(coalesce(p_customer_reference, '')), ''),
    v_user_id
  )
  returning id into v_claim_id;
  return v_claim_id;
end;
$function$;

create or replace function public.review_payment_claim(
  p_claim_id uuid,
  p_approve boolean,
  p_review_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_claim public.payment_claims%rowtype;
  v_payment_id uuid;
begin
  if not exists (
    select 1
      from public.profiles as p
      join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
      join public.roles as r on r.id = ur.role_id
     where p.id = v_actor and p.account_status = 'active'
       and r.code in ('admin', 'super_admin')
  ) then
    raise exception 'Only an active Admin may review payment claims';
  end if;
  select pc.* into v_claim
    from public.payment_claims as pc where pc.id = p_claim_id for update;
  if not found or v_claim.claim_status <> 'submitted' then
    raise exception 'Payment claim is unavailable';
  end if;

  update public.payment_claims
     set claim_status = case when p_approve then 'verified' else 'rejected' end,
         reviewed_by = v_actor,
         reviewed_at = pg_catalog.now(),
         review_note = nullif(pg_catalog.btrim(coalesce(p_review_note, '')), '')
   where id = p_claim_id;

  if p_approve then
    insert into public.payments (
      booking_id, quote_id, claim_id, entry_type, amount, currency, method,
      provider_reference, verified_by
    )
    values (
      v_claim.booking_id, v_claim.quote_id, v_claim.id, 'receipt',
      v_claim.amount, v_claim.currency, v_claim.method,
      v_claim.customer_reference, v_actor
    )
    returning id into v_payment_id;
  end if;
  return v_payment_id;
end;
$function$;

create or replace function public.record_payment_refund(
  p_original_payment_id uuid,
  p_amount numeric(12, 2),
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_original public.payments%rowtype;
  v_refund_id uuid;
begin
  if not exists (
    select 1
      from public.profiles as p
      join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
      join public.roles as r on r.id = ur.role_id
     where p.id = v_actor and p.account_status = 'active'
       and r.code in ('admin', 'super_admin')
  ) then
    raise exception 'Only an active Admin may issue refunds';
  end if;
  if nullif(pg_catalog.btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'A refund reason is required';
  end if;

  select p.* into v_original
    from public.payments as p
   where p.id = p_original_payment_id and p.entry_type = 'receipt'
   for update;
  if not found then
    raise exception 'Original receipt is unavailable';
  end if;
  insert into public.payments (
    booking_id, quote_id, entry_type, original_payment_id, amount, currency,
    method, verified_by, refund_reason
  )
  values (
    v_original.booking_id, v_original.quote_id, 'refund', v_original.id,
    p_amount, v_original.currency, v_original.method, v_actor,
    nullif(pg_catalog.btrim(p_reason), '')
  )
  returning id into v_refund_id;
  return v_refund_id;
end;
$function$;

create or replace function public.admin_assign_driver_role(
  p_user_id uuid,
  p_actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_driver_role_id smallint;
  v_customer_role_id smallint;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'Trusted server execution is required';
  end if;
  if not exists (
    select 1
      from public.profiles as p
      join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
      join public.roles as r on r.id = ur.role_id
     where p.id = p_actor_user_id
       and p.account_status = 'active'
       and r.code in ('admin', 'super_admin')
  ) then
    raise exception 'An active Admin is required to create a driver account';
  end if;
  if not exists (
    select 1 from public.profiles as p
     where p.id = p_user_id and p.account_status = 'active'
  ) then
    raise exception 'The new Auth profile is unavailable';
  end if;

  select r.id into v_driver_role_id from public.roles as r where r.code = 'driver';
  select r.id into v_customer_role_id from public.roles as r where r.code = 'customer';
  if v_driver_role_id is null or v_customer_role_id is null then
    raise exception 'Required account roles are not configured';
  end if;

  update public.user_roles
     set revoked_at = pg_catalog.now()
   where user_id = p_user_id
     and role_id = v_customer_role_id
     and revoked_at is null;
  insert into public.user_roles (user_id, role_id, assigned_by)
  select p_user_id, v_driver_role_id, p_actor_user_id
   where not exists (
     select 1 from public.user_roles as ur
      where ur.user_id = p_user_id
        and ur.role_id = v_driver_role_id
        and ur.revoked_at is null
   );
  insert into private.privileged_audit_events (
    event_type, actor_user_id, target_user_id, details
  )
  values (
    'driver_role_assigned',
    p_actor_user_id,
    p_user_id,
    pg_catalog.jsonb_build_object('assigned_at', pg_catalog.now())
  );
end;
$function$;

create or replace function public.admin_deactivate_profile(
  p_user_id uuid,
  p_actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'Trusted server execution is required';
  end if;
  if not exists (
    select 1
      from public.profiles as p
      join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
      join public.roles as r on r.id = ur.role_id
     where p.id = p_actor_user_id
       and p.account_status = 'active'
       and r.code in ('admin', 'super_admin')
  ) then
    raise exception 'An active Admin is required';
  end if;

  update public.profiles
     set account_status = 'inactive'
   where id = p_user_id;
  if not found then
    raise exception 'The target profile is unavailable';
  end if;
  insert into private.privileged_audit_events (
    event_type, actor_user_id, target_user_id, details
  )
  values (
    'incomplete_driver_account_deactivated',
    p_actor_user_id,
    p_user_id,
    pg_catalog.jsonb_build_object('deactivated_at', pg_catalog.now())
  );
end;
$function$;

create or replace function public.list_payment_claims()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
begin
  if not exists (
    select 1
      from public.profiles as p
      join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
      join public.roles as r on r.id = ur.role_id
     where p.id = (select auth.uid())
       and p.account_status = 'active'
       and r.code in ('admin', 'super_admin')
  ) then
    raise exception 'An active Admin is required';
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', pc.id,
        'booking_id', pc.booking_id,
        'booking_ref', b.booking_ref,
        'customer_name', b.customer_name,
        'quote_id', pc.quote_id,
        'amount', pc.amount,
        'currency', pc.currency,
        'method', pc.method,
        'customer_reference', pc.customer_reference,
        'claim_status', pc.claim_status,
        'submitted_at', pc.submitted_at,
        'review_note', pc.review_note
      ) order by pc.submitted_at desc
    ),
    '[]'::jsonb
  )
    into v_result
    from (
      select * from public.payment_claims
       order by submitted_at desc
       limit 200
    ) as pc
    join public.bookings as b on b.id = pc.booking_id;
  return v_result;
end;
$function$;

create or replace function public.list_financial_records()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
begin
  if not exists (
    select 1
      from public.profiles as p
      join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
      join public.roles as r on r.id = ur.role_id
     where p.id = (select auth.uid())
       and p.account_status = 'active'
       and r.code in ('admin', 'super_admin')
  ) then
    raise exception 'An active Admin is required';
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', p.id,
        'booking_id', p.booking_id,
        'booking_ref', b.booking_ref,
        'quote_id', p.quote_id,
        'entry_type', p.entry_type,
        'original_payment_id', p.original_payment_id,
        'amount', p.amount,
        'currency', p.currency,
        'method', p.method,
        'provider_reference', p.provider_reference,
        'refund_reason', p.refund_reason,
        'verified_at', p.verified_at
      ) order by p.created_at desc
    ),
    '[]'::jsonb
  )
    into v_result
    from (
      select * from public.payments
       order by created_at desc
       limit 200
    ) as p
    join public.bookings as b on b.id = p.booking_id;
  return v_result;
end;
$function$;

create or replace function public.list_fleet_resources()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
begin
  if not exists (
    select 1
      from public.profiles as p
      join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
      join public.roles as r on r.id = ur.role_id
     where p.id = (select auth.uid())
       and p.account_status = 'active'
       and r.code in ('admin', 'super_admin')
  ) then
    raise exception 'An active Admin is required';
  end if;

  select pg_catalog.jsonb_build_object(
    'categories', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', vc.id, 'code', vc.code, 'display_name', vc.display_name,
          'max_passengers', vc.max_passengers, 'max_luggage', vc.max_luggage,
          'is_active', vc.is_active
        ) order by vc.display_name
      ) from public.vehicle_categories as vc
    ), '[]'::jsonb),
    'vehicles', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', v.id, 'category_id', v.category_id,
          'category_name', vc.display_name, 'display_name', v.display_name,
          'registration_number', v.registration_number,
          'operational_status', v.operational_status
        ) order by v.display_name
      )
        from public.vehicles as v
        join public.vehicle_categories as vc on vc.id = v.category_id
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$function$;

create or replace function public.save_vehicle_category(
  p_category_id uuid,
  p_code text,
  p_display_name text,
  p_max_passengers smallint,
  p_max_luggage smallint,
  p_is_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_category_id uuid;
begin
  if not exists (
    select 1 from public.profiles as p
    join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
    join public.roles as r on r.id = ur.role_id
     where p.id = v_actor and p.account_status = 'active'
       and r.code in ('admin', 'super_admin')
  ) then
    raise exception 'An active Admin is required';
  end if;
  if p_code !~ '^[a-z][a-z0-9_]{1,39}$'
     or pg_catalog.char_length(pg_catalog.btrim(p_display_name)) not between 2 and 80
     or p_max_passengers not between 1 and 50
     or p_max_luggage not between 0 and 50
     or p_is_active is null
  then
    raise exception 'Vehicle category details are invalid';
  end if;

  if p_category_id is null then
    insert into public.vehicle_categories (
      code, display_name, max_passengers, max_luggage, is_active
    ) values (
      p_code, pg_catalog.btrim(p_display_name), p_max_passengers, p_max_luggage, p_is_active
    ) returning id into v_category_id;
  else
    update public.vehicle_categories
       set code = p_code, display_name = pg_catalog.btrim(p_display_name),
           max_passengers = p_max_passengers, max_luggage = p_max_luggage,
           is_active = p_is_active
     where id = p_category_id
     returning id into v_category_id;
    if not found then
      raise exception 'Vehicle category is unavailable';
    end if;
  end if;
  return v_category_id;
end;
$function$;

create or replace function public.save_vehicle(
  p_vehicle_id uuid,
  p_category_id uuid,
  p_display_name text,
  p_registration_number text,
  p_operational_status text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_vehicle_id uuid;
begin
  if not exists (
    select 1 from public.profiles as p
    join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
    join public.roles as r on r.id = ur.role_id
     where p.id = v_actor and p.account_status = 'active'
       and r.code in ('admin', 'super_admin')
  ) then
    raise exception 'An active Admin is required';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(p_display_name)) not between 2 and 120
     or p_operational_status not in ('active', 'inactive', 'maintenance')
     or not exists (
       select 1 from public.vehicle_categories as vc where vc.id = p_category_id
     )
  then
    raise exception 'Vehicle details are invalid';
  end if;

  if p_vehicle_id is null then
    insert into public.vehicles (
      category_id, display_name, registration_number, operational_status
    ) values (
      p_category_id, pg_catalog.btrim(p_display_name),
      nullif(pg_catalog.btrim(coalesce(p_registration_number, '')), ''),
      p_operational_status
    ) returning id into v_vehicle_id;
  else
    update public.vehicles
       set category_id = p_category_id,
           display_name = pg_catalog.btrim(p_display_name),
           registration_number = nullif(pg_catalog.btrim(coalesce(p_registration_number, '')), ''),
           operational_status = p_operational_status
     where id = p_vehicle_id
     returning id into v_vehicle_id;
    if not found then
      raise exception 'Vehicle is unavailable';
    end if;
  end if;
  return v_vehicle_id;
end;
$function$;

create or replace function public.list_pricing_configuration()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
begin
  if not exists (
    select 1 from public.profiles as p
    join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
    join public.roles as r on r.id = ur.role_id
     where p.id = (select auth.uid()) and p.account_status = 'active'
       and r.code in ('admin', 'super_admin')
  ) then
    raise exception 'An active Admin is required';
  end if;

  select coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'id', pp.id, 'code', pp.code, 'name', pp.name,
      'service_type', pp.service_type, 'currency', pp.currency,
      'is_active', pp.is_active, 'valid_from', pp.valid_from,
      'valid_until', pp.valid_until,
      'rules', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', pr.id, 'category_id', pr.category_id, 'rule_type', pr.rule_type,
          'unit', pr.unit, 'amount', pr.amount, 'min_quantity', pr.min_quantity,
          'max_quantity', pr.max_quantity, 'is_active', pr.is_active
        ) order by pr.id)
          from public.pricing_rules as pr where pr.package_id = pp.id
      ), '[]'::jsonb)
    ) order by pp.created_at desc
  ), '[]'::jsonb)
    into v_result
    from public.pricing_packages as pp;
  return v_result;
end;
$function$;

create or replace function public.save_pricing_package(
  p_package_id uuid,
  p_code text,
  p_name text,
  p_service_type text,
  p_currency char(3),
  p_is_active boolean,
  p_valid_from timestamptz,
  p_valid_until timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_package_id uuid;
begin
  if not exists (
    select 1 from public.profiles as p
    join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
    join public.roles as r on r.id = ur.role_id
     where p.id = v_actor and p.account_status = 'active'
       and r.code in ('admin', 'super_admin')
  ) then
    raise exception 'An active Admin is required';
  end if;
  if p_code !~ '^[A-Za-z0-9_-]{2,60}$'
     or pg_catalog.char_length(pg_catalog.btrim(p_name)) not between 2 and 120
     or p_service_type not in ('airport_transfer', 'day_trip', 'round_tour', 'vehicle_hire', 'custom')
     or p_currency not in ('LKR', 'USD')
     or p_is_active is null
     or (p_valid_from is not null and p_valid_until is not null and p_valid_until <= p_valid_from)
  then
    raise exception 'Pricing package details are invalid';
  end if;

  if p_package_id is null then
    insert into public.pricing_packages (
      code, name, service_type, currency, is_active, valid_from, valid_until, created_by
    ) values (
      p_code, pg_catalog.btrim(p_name), p_service_type, p_currency,
      p_is_active, p_valid_from, p_valid_until, v_actor
    ) returning id into v_package_id;
  else
    update public.pricing_packages
       set code = p_code, name = pg_catalog.btrim(p_name),
           service_type = p_service_type, currency = p_currency,
           is_active = p_is_active, valid_from = p_valid_from, valid_until = p_valid_until
     where id = p_package_id
     returning id into v_package_id;
    if not found then
      raise exception 'Pricing package is unavailable';
    end if;
  end if;
  return v_package_id;
end;
$function$;

create or replace function public.save_pricing_rule(
  p_rule_id uuid,
  p_package_id uuid,
  p_category_id uuid,
  p_rule_type text,
  p_unit text,
  p_amount numeric(12, 2),
  p_min_quantity numeric(10, 2),
  p_max_quantity numeric(10, 2),
  p_is_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_rule_id uuid;
begin
  if not exists (
    select 1 from public.profiles as p
    join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
    join public.roles as r on r.id = ur.role_id
     where p.id = v_actor and p.account_status = 'active'
       and r.code in ('admin', 'super_admin')
  ) then
    raise exception 'An active Admin is required';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(p_rule_type)) not between 2 and 80
     or p_unit not in ('booking', 'leg', 'passenger', 'day')
     or p_amount is null or p_amount < 0
     or (p_min_quantity is not null and p_min_quantity < 0)
     or (p_max_quantity is not null and p_max_quantity < 0)
     or (p_min_quantity is not null and p_max_quantity is not null and p_max_quantity < p_min_quantity)
     or p_is_active is null
     or not exists (select 1 from public.pricing_packages as pp where pp.id = p_package_id)
     or (p_category_id is not null and not exists (
       select 1 from public.vehicle_categories as vc where vc.id = p_category_id
     ))
  then
    raise exception 'Pricing rule details are invalid';
  end if;

  if p_rule_id is null then
    insert into public.pricing_rules (
      package_id, category_id, rule_type, unit, amount,
      min_quantity, max_quantity, is_active
    ) values (
      p_package_id, p_category_id, pg_catalog.btrim(p_rule_type), p_unit, p_amount,
      p_min_quantity, p_max_quantity, p_is_active
    ) returning id into v_rule_id;
  else
    update public.pricing_rules
       set package_id = p_package_id, category_id = p_category_id,
           rule_type = pg_catalog.btrim(p_rule_type), unit = p_unit,
           amount = p_amount, min_quantity = p_min_quantity,
           max_quantity = p_max_quantity, is_active = p_is_active
     where id = p_rule_id
     returning id into v_rule_id;
    if not found then
      raise exception 'Pricing rule is unavailable';
    end if;
  end if;
  return v_rule_id;
end;
$function$;

revoke all on function public.get_my_roles() from public, anon, authenticated;
revoke all on function public.create_booking(text, text, text, text, text, text, smallint, smallint, text, char, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.issue_booking_quote(uuid, char, timestamptz) from public, anon, authenticated;
revoke all on function public.list_operations_bookings() from public, anon, authenticated;
revoke all on function public.list_dispatch_resources() from public, anon, authenticated;
revoke all on function public.list_driver_assignments() from public, anon, authenticated;
revoke all on function public.create_booking_assignment(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.update_driver_assignment(uuid, text) from public, anon, authenticated;
revoke all on function public.submit_payment_claim(uuid, uuid, numeric, text, text) from public, anon, authenticated;
revoke all on function public.review_payment_claim(uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.record_payment_refund(uuid, numeric, text) from public, anon, authenticated;
revoke all on function public.admin_assign_driver_role(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.admin_deactivate_profile(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.list_payment_claims() from public, anon, authenticated;
revoke all on function public.list_financial_records() from public, anon, authenticated;
revoke all on function public.list_fleet_resources() from public, anon, authenticated;
revoke all on function public.save_vehicle_category(uuid, text, text, smallint, smallint, boolean) from public, anon, authenticated;
revoke all on function public.save_vehicle(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.list_pricing_configuration() from public, anon, authenticated;
revoke all on function public.save_pricing_package(uuid, text, text, text, char, boolean, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.save_pricing_rule(uuid, uuid, uuid, text, text, numeric, numeric, numeric, boolean) from public, anon, authenticated;

grant execute on function public.get_my_roles() to authenticated;
grant execute on function public.create_booking(text, text, text, text, text, text, smallint, smallint, text, char, text, jsonb)
  to anon, authenticated;
grant execute on function public.issue_booking_quote(uuid, char, timestamptz) to authenticated;
grant execute on function public.list_operations_bookings() to authenticated;
grant execute on function public.list_dispatch_resources() to authenticated;
grant execute on function public.list_driver_assignments() to authenticated;
grant execute on function public.create_booking_assignment(uuid, uuid, uuid) to authenticated;
grant execute on function public.update_driver_assignment(uuid, text) to authenticated;
grant execute on function public.submit_payment_claim(uuid, uuid, numeric, text, text) to authenticated;
grant execute on function public.review_payment_claim(uuid, boolean, text) to authenticated;
grant execute on function public.record_payment_refund(uuid, numeric, text) to authenticated;
grant execute on function public.admin_assign_driver_role(uuid, uuid) to service_role;
grant execute on function public.admin_deactivate_profile(uuid, uuid) to service_role;
grant execute on function public.list_payment_claims() to authenticated;
grant execute on function public.list_financial_records() to authenticated;
grant execute on function public.list_fleet_resources() to authenticated;
grant execute on function public.save_vehicle_category(uuid, text, text, smallint, smallint, boolean) to authenticated;
grant execute on function public.save_vehicle(uuid, uuid, text, text, text) to authenticated;
grant execute on function public.list_pricing_configuration() to authenticated;
grant execute on function public.save_pricing_package(uuid, text, text, text, char, boolean, timestamptz, timestamptz) to authenticated;
grant execute on function public.save_pricing_rule(uuid, uuid, uuid, text, text, numeric, numeric, numeric, boolean) to authenticated;

comment on column public.payments.refund_reason is
  'Required explanation for an immutable refund ledger entry; not exposed to customer browser roles.';
comment on function public.admin_assign_driver_role(uuid, uuid) is
  'Trusted-server-only role assignment for a newly created driver Auth account, with customer-role revocation and audit.';

comment on column public.bookings.requested_currency is
  'Currency requested by the customer; quote issuance must use the same currency.';
comment on function public.create_booking(text, text, text, text, text, text, smallint, smallint, text, char, text, jsonb) is
  'Atomically creates a guest or authenticated booking and ordered legs; ownership is derived from auth.uid().';
comment on function public.issue_booking_quote(uuid, char, timestamptz) is
  'Creates an immutable quote from active server-side rules and returns a guest acceptance token once.';
comment on function public.update_driver_assignment(uuid, text) is
  'Atomically synchronizes driver assignment, booking lifecycle, and leg trip status.';
