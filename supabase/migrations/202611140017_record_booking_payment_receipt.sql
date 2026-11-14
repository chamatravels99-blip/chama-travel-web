-- Ensures customer payment recording automatically issues the linked receipt document,
-- provides the record_booking_payment RPC alias for centralized Admin operations,
-- and allows public/Admin booking submissions after the customer-role cutover.

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

  -- Customer portal accounts are no longer used; if an Admin or unroled session
  -- submits the public booking form, treat the booking as a guest customer booking
  -- (customer_user_id = null) so guest quote & tracker links work seamlessly.
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

revoke all on function public.create_booking(
  text, text, text, text, text, text, smallint, smallint, text, char, text, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.create_booking(
  text, text, text, text, text, text, smallint, smallint, text, char, text, jsonb
) to anon, authenticated;

create or replace function public.admin_record_customer_payment(
  p_booking_id uuid,
  p_quote_id uuid,
  p_amount numeric(12, 2),
  p_method text,
  p_payment_date date,
  p_reference text,
  p_request_id uuid
)
returns table (payment_id uuid, receipt_number text, created boolean)
language plpgsql
security definer
set search_path = ''
as $function$
#variable_conflict use_column
declare
  v_actor uuid := (select auth.uid());
  v_booking_status text;
  v_existing public.payments%rowtype;
  v_currency char(3);
  v_payment_id uuid;
  v_receipt_number text;
  v_reference text := nullif(pg_catalog.btrim(coalesce(p_reference, '')), '');
begin
  if not private.has_active_role(v_actor, array['admin', 'super_admin']) then
    raise exception 'An active Admin is required';
  end if;

  if p_booking_id is null
     or p_quote_id is null
     or p_amount is null
     or p_amount <= 0
     or p_method is null
     or p_method not in ('cash', 'bank_transfer')
     or p_payment_date is null
     or p_payment_date > (pg_catalog.clock_timestamp() at time zone 'Asia/Colombo')::date
     or p_request_id is null
     or pg_catalog.char_length(coalesce(p_reference, '')) > 160
  then
    raise exception 'Customer payment details are invalid';
  end if;

  select p.*
    into v_existing
    from public.payments as p
   where p.recording_request_id = p_request_id
   for update;
  if found then
    if v_existing.booking_id is distinct from p_booking_id
       or v_existing.quote_id is distinct from p_quote_id
       or v_existing.amount is distinct from p_amount
       or v_existing.method is distinct from p_method
       or v_existing.payment_date is distinct from p_payment_date
       or v_existing.provider_reference is distinct from v_reference
       or v_existing.verified_by is distinct from v_actor
    then
      raise exception 'Payment request identifier was already used with different details';
    end if;
    perform public.admin_issue_payment_receipt_document(v_existing.id);
    return query select v_existing.id, v_existing.receipt_number, false;
    return;
  end if;

  select b.booking_status
    into v_booking_status
    from public.bookings as b
   where b.id = p_booking_id
   for update;
  if not found or v_booking_status not in ('confirmed', 'assigned', 'in_progress', 'completed') then
    raise exception 'An active confirmed booking is required';
  end if;

  select q.currency
    into v_currency
    from public.booking_quotes as q
   where q.id = p_quote_id
     and q.booking_id = p_booking_id
     and q.quote_status = 'accepted'
   for update;
  if not found then
    raise exception 'An accepted booking quote is required';
  end if;

  insert into public.payments as pm (
    booking_id,
    quote_id,
    entry_type,
    amount,
    currency,
    method,
    provider_reference,
    verified_by,
    payment_date,
    recording_request_id
  )
  values (
    p_booking_id,
    p_quote_id,
    'receipt',
    p_amount,
    v_currency,
    p_method,
    v_reference,
    v_actor,
    p_payment_date,
    p_request_id
  )
  returning pm.id, pm.receipt_number
    into v_payment_id, v_receipt_number;

  perform public.admin_issue_payment_receipt_document(v_payment_id);

  return query select v_payment_id, v_receipt_number, true;
end;
$function$;

create or replace function public.record_booking_payment(
  p_booking_id uuid,
  p_quote_id uuid,
  p_amount numeric(12, 2),
  p_method text,
  p_payment_date date,
  p_reference text,
  p_request_id uuid
)
returns table (payment_id uuid, receipt_number text, created boolean)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  return query
  select r.payment_id, r.receipt_number, r.created
    from public.admin_record_customer_payment(
      p_booking_id,
      p_quote_id,
      p_amount,
      p_method,
      p_payment_date,
      p_reference,
      p_request_id
    ) as r;
end;
$function$;

revoke all on function public.admin_record_customer_payment(
  uuid, uuid, numeric, text, date, text, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.admin_record_customer_payment(
  uuid, uuid, numeric, text, date, text, uuid
) to authenticated;

revoke all on function public.record_booking_payment(
  uuid, uuid, numeric, text, date, text, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.record_booking_payment(
  uuid, uuid, numeric, text, date, text, uuid
) to authenticated;
