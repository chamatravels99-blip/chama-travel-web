-- Disposable non-production database only. Synthetic rows are rolled back.
\set ON_ERROR_STOP on
begin;

select pg_catalog.set_config('test.guest_admin', pg_catalog.gen_random_uuid()::text, true);
select pg_catalog.set_config('test.guest_customer', pg_catalog.gen_random_uuid()::text, true);
select pg_catalog.set_config('test.guest_revoked_booking', pg_catalog.gen_random_uuid()::text, true);
select pg_catalog.set_config('test.guest_claim_booking', pg_catalog.gen_random_uuid()::text, true);
select pg_catalog.set_config('test.guest_revoked_key', pg_catalog.gen_random_uuid()::text, true);
select pg_catalog.set_config('test.guest_claim_key', pg_catalog.gen_random_uuid()::text, true);
select pg_catalog.set_config('test.guest_driver', pg_catalog.gen_random_uuid()::text, true);
select pg_catalog.set_config('test.guest_other_driver', pg_catalog.gen_random_uuid()::text, true);
select pg_catalog.set_config('test.guest_driver_booking', pg_catalog.gen_random_uuid()::text, true);
select pg_catalog.set_config('test.guest_driver_quote', pg_catalog.gen_random_uuid()::text, true);
select pg_catalog.set_config('test.guest_category', pg_catalog.gen_random_uuid()::text, true);
select pg_catalog.set_config('test.guest_vehicle', pg_catalog.gen_random_uuid()::text, true);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select id, 'authenticated', 'authenticated',
       'guest-security-' || id::text || '@example.invalid', '',
       pg_catalog.clock_timestamp(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       '{"full_name":"Guest Security Test"}'::jsonb,
       pg_catalog.clock_timestamp(), pg_catalog.clock_timestamp()
  from (values
    (pg_catalog.current_setting('test.guest_admin')::uuid),
    (pg_catalog.current_setting('test.guest_customer')::uuid),
    (pg_catalog.current_setting('test.guest_driver')::uuid),
    (pg_catalog.current_setting('test.guest_other_driver')::uuid)
  ) as fixture(id);

insert into public.user_roles (user_id, role_id)
select pg_catalog.current_setting('test.guest_admin')::uuid, id
  from public.roles where code = 'admin';
insert into public.user_roles (user_id, role_id)
select pg_catalog.current_setting('test.guest_driver')::uuid, id
  from public.roles where code = 'driver';
insert into public.user_roles (user_id, role_id)
select pg_catalog.current_setting('test.guest_other_driver')::uuid, id
  from public.roles where code = 'driver';

insert into public.bookings (
  id, booking_ref, customer_name, customer_email, customer_phone,
  service_type, journey_type, passenger_count, luggage_count, idempotency_key
)
select id, 'TEST-GUEST-' || id::text, 'Guest Test',
       'guest-security@example.invalid', '+94710000000',
       'airport_transfer', 'one_way', 1, 0, key
  from (values
    (pg_catalog.current_setting('test.guest_revoked_booking')::uuid,
     pg_catalog.current_setting('test.guest_revoked_key')),
    (pg_catalog.current_setting('test.guest_claim_booking')::uuid,
     pg_catalog.current_setting('test.guest_claim_key'))
  ) as fixture(id, key);

insert into public.booking_legs (
  booking_id, sequence_no, pickup_location, dropoff_location, pickup_at, planned_end_at
)
select id, 1, 'Test pickup', 'Test dropoff',
       pg_catalog.now() + interval '30 days', pg_catalog.now() + interval '30 days 2 hours'
  from (values
    (pg_catalog.current_setting('test.guest_revoked_booking')::uuid),
    (pg_catalog.current_setting('test.guest_claim_booking')::uuid)
  ) as fixture(id);

set local role service_role;
do $test$
declare
  v_token text;
  v_old_token text;
  v_booking_id uuid := pg_catalog.current_setting('test.guest_revoked_booking')::uuid;
  v_key text := pg_catalog.current_setting('test.guest_revoked_key');
begin
  select token into v_old_token from public.issue_guest_booking_tracker_token(v_booking_id, v_key);
  select token into v_token from public.issue_guest_booking_tracker_token(v_booking_id, v_key);
  if v_old_token = v_token then
    raise exception 'Retry should rotate the tracker token';
  end if;
  perform pg_catalog.set_config('test.guest_revoked_token', v_token, true);
end;
$test$;
reset role;

select pg_catalog.set_config('request.jwt.claim.sub', pg_catalog.current_setting('test.guest_admin'), true);
select pg_catalog.set_config(
  'request.jwt.claims',
  pg_catalog.jsonb_build_object('sub', pg_catalog.current_setting('test.guest_admin'), 'role', 'authenticated')::text,
  true
);
set local role authenticated;
select public.admin_revoke_guest_booking_tracker(pg_catalog.current_setting('test.guest_revoked_booking')::uuid);
reset role;

set local role service_role;
do $test$
declare
  v_token text;
  v_result uuid;
begin
  begin
    perform public.issue_guest_booking_tracker_token(
      pg_catalog.current_setting('test.guest_revoked_booking')::uuid,
      pg_catalog.current_setting('test.guest_revoked_key')
    );
    raise exception 'Revoked tracker was reissued';
  exception when others then
    if sqlerrm <> 'Booking access is unavailable' then raise; end if;
  end;
  select token into v_token from public.issue_guest_booking_tracker_token(
    pg_catalog.current_setting('test.guest_claim_booking')::uuid,
    pg_catalog.current_setting('test.guest_claim_key')
  );
  begin
    perform public.service_claim_guest_booking_access(v_token, pg_catalog.gen_random_uuid());
    raise exception 'Unknown customer was accepted';
  exception when others then
    if sqlerrm <> 'An active customer account is required' then raise; end if;
  end;
  v_result := public.service_claim_guest_booking_access(
    v_token, pg_catalog.current_setting('test.guest_customer')::uuid
  );
  if v_result <> pg_catalog.current_setting('test.guest_claim_booking')::uuid then
    raise exception 'Customer claimed the wrong booking';
  end if;
  begin
    perform public.service_claim_guest_booking_access(
      v_token, pg_catalog.current_setting('test.guest_customer')::uuid
    );
    raise exception 'Consumed tracker was reused';
  exception when others then
    if sqlerrm <> 'Booking access is unavailable' then raise; end if;
  end;
end;
$test$;
reset role;

-- A real assignment is required for invitation and document resolution.
insert into public.vehicle_categories (id, code, display_name, max_passengers, max_luggage)
values (
  pg_catalog.current_setting('test.guest_category')::uuid,
  'test-' || pg_catalog.current_setting('test.guest_category'),
  'Test category', 4, 4
);

-- The protected path binds the server authorization to the actual JWT actor
-- and the exact submitted payload. SQL role simulation does not verify JWTs.
select pg_catalog.set_config('test.submit_guest_key', pg_catalog.gen_random_uuid()::text, true);
select pg_catalog.set_config('test.submit_customer_key', pg_catalog.gen_random_uuid()::text, true);
select pg_catalog.set_config('test.submit_guest_usd_key', pg_catalog.gen_random_uuid()::text, true);
select pg_catalog.set_config('test.submit_customer_lkr_key', pg_catalog.gen_random_uuid()::text, true);
select pg_catalog.set_config('test.submit_legs', pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
  'pickup_location', 'Test pickup', 'dropoff_location', 'Test dropoff',
  'pickup_at', (pg_catalog.now() + interval '30 days')::text
))::text, true);
select pg_catalog.set_config('test.submit_guest_payload', pg_catalog.jsonb_build_object(
  'p_customer_name', 'Test Customer', 'p_customer_email', 'customer@example.invalid',
  'p_customer_phone', '+94710000000', 'p_service_type', 'airport_transfer',
  'p_journey_type', 'one_way', 'p_category_code', 'test-' || pg_catalog.current_setting('test.guest_category'),
  'p_passenger_count', 1, 'p_luggage_count', 0, 'p_customer_notes', null,
  'p_requested_currency', 'LKR', 'p_idempotency_key', pg_catalog.current_setting('test.submit_guest_key'),
  'p_legs', pg_catalog.current_setting('test.submit_legs')::jsonb
)::text, true);
select pg_catalog.set_config('test.submit_customer_payload',
  pg_catalog.jsonb_set(
    pg_catalog.jsonb_set(pg_catalog.current_setting('test.submit_guest_payload')::jsonb,
      '{p_idempotency_key}', pg_catalog.to_jsonb(pg_catalog.current_setting('test.submit_customer_key'))),
    '{p_requested_currency}', '"USD"'::jsonb
  )::text,
  true);
select pg_catalog.set_config('test.submit_guest_usd_payload',
  pg_catalog.jsonb_set(pg_catalog.current_setting('test.submit_customer_payload')::jsonb,
    '{p_idempotency_key}', pg_catalog.to_jsonb(pg_catalog.current_setting('test.submit_guest_usd_key')))::text,
  true);
select pg_catalog.set_config('test.submit_customer_lkr_payload',
  pg_catalog.jsonb_set(pg_catalog.current_setting('test.submit_guest_payload')::jsonb,
    '{p_idempotency_key}', pg_catalog.to_jsonb(pg_catalog.current_setting('test.submit_customer_lkr_key')))::text,
  true);

set local role service_role;
select pg_catalog.set_config('test.submit_guest_token',
  public.issue_booking_submission_token(null, pg_catalog.current_setting('test.submit_guest_payload')::jsonb), true);
select pg_catalog.set_config('test.submit_retry_token',
  public.issue_booking_submission_token(null, pg_catalog.current_setting('test.submit_guest_payload')::jsonb), true);
select pg_catalog.set_config('test.submit_expired_token',
  public.issue_booking_submission_token(null, pg_catalog.current_setting('test.submit_guest_payload')::jsonb), true);
select pg_catalog.set_config('test.submit_customer_token', public.issue_booking_submission_token(
  pg_catalog.current_setting('test.guest_customer')::uuid,
  pg_catalog.current_setting('test.submit_customer_payload')::jsonb
), true);
select pg_catalog.set_config('test.submit_customer_retry_token', public.issue_booking_submission_token(
  pg_catalog.current_setting('test.guest_customer')::uuid,
  pg_catalog.current_setting('test.submit_customer_payload')::jsonb
), true);
select pg_catalog.set_config('test.submit_guest_usd_token', public.issue_booking_submission_token(
  null, pg_catalog.current_setting('test.submit_guest_usd_payload')::jsonb
), true);
select pg_catalog.set_config('test.submit_customer_lkr_token', public.issue_booking_submission_token(
  pg_catalog.current_setting('test.guest_customer')::uuid,
  pg_catalog.current_setting('test.submit_customer_lkr_payload')::jsonb
), true);
reset role;
update private.booking_submission_tokens
   set expires_at = pg_catalog.clock_timestamp() - interval '1 second'
 where token_hash = extensions.digest(
   pg_catalog.convert_to(pg_catalog.current_setting('test.submit_expired_token'), 'UTF8'), 'sha256'
 );

select pg_catalog.set_config('request.jwt.claim.sub', '', true);
select pg_catalog.set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $test$
declare
  v_guest_booking uuid;
  v_retry uuid;
  v_invalid_token text;
begin
  foreach v_invalid_token in array array[
    pg_catalog.repeat('f', 64), pg_catalog.current_setting('test.submit_expired_token')
  ] loop
    begin
      perform public.service_create_booking(
        'Test Customer', 'customer@example.invalid', '+94710000000', 'airport_transfer',
        'one_way', 'test-' || pg_catalog.current_setting('test.guest_category'),
        1::smallint, 0::smallint, null, 'LKR'::text, pg_catalog.current_setting('test.submit_guest_key'),
        pg_catalog.current_setting('test.submit_legs')::jsonb, v_invalid_token
      );
      raise exception 'Missing or expired booking authorization was accepted';
    exception when others then
      if sqlerrm <> 'Booking submission is unavailable' then raise; end if;
    end;
  end loop;
  begin
    perform public.service_create_booking(
      'Test Customer', 'customer@example.invalid', '+94710000000', 'airport_transfer',
      'one_way', 'test-' || pg_catalog.current_setting('test.guest_category'),
      1::smallint, 0::smallint, null, 'LKR-extra'::text, pg_catalog.current_setting('test.submit_guest_key'),
      pg_catalog.current_setting('test.submit_legs')::jsonb, pg_catalog.current_setting('test.submit_guest_token')
    );
    raise exception 'Overlong booking currency was accepted';
  exception when others then
    if sqlerrm <> 'Booking submission is unavailable' then raise; end if;
  end;
  select booking_id into v_guest_booking from public.service_create_booking(
    'Test Customer', 'customer@example.invalid', '+94710000000', 'airport_transfer',
    'one_way', 'test-' || pg_catalog.current_setting('test.guest_category'),
    1::smallint, 0::smallint, null, 'LKR'::text, pg_catalog.current_setting('test.submit_guest_key'),
    pg_catalog.current_setting('test.submit_legs')::jsonb, pg_catalog.current_setting('test.submit_guest_token')
  );
  begin
    perform public.service_create_booking(
      'Test Customer', 'customer@example.invalid', '+94710000000', 'airport_transfer',
      'one_way', 'test-' || pg_catalog.current_setting('test.guest_category'),
      1::smallint, 0::smallint, null, 'LKR'::text, pg_catalog.current_setting('test.submit_guest_key'),
      pg_catalog.current_setting('test.submit_legs')::jsonb, pg_catalog.current_setting('test.submit_guest_token')
    );
    raise exception 'Consumed booking authorization was reused';
  exception when others then
    if sqlerrm <> 'Booking submission is unavailable' then raise; end if;
  end;
  begin
    perform public.service_create_booking(
      'Altered Customer', 'customer@example.invalid', '+94710000000', 'airport_transfer',
      'one_way', 'test-' || pg_catalog.current_setting('test.guest_category'),
      1::smallint, 0::smallint, null, 'LKR'::text, pg_catalog.current_setting('test.submit_guest_key'),
      pg_catalog.current_setting('test.submit_legs')::jsonb, pg_catalog.current_setting('test.submit_retry_token')
    );
    raise exception 'Changed booking payload was accepted';
  exception when others then
    if sqlerrm <> 'Booking submission is unavailable' then raise; end if;
  end;
  select booking_id into v_retry from public.service_create_booking(
    'Test Customer', 'customer@example.invalid', '+94710000000', 'airport_transfer',
    'one_way', 'test-' || pg_catalog.current_setting('test.guest_category'),
    1::smallint, 0::smallint, null, 'LKR'::text, pg_catalog.current_setting('test.submit_guest_key'),
    pg_catalog.current_setting('test.submit_legs')::jsonb, pg_catalog.current_setting('test.submit_retry_token')
  );
  if v_guest_booking <> v_retry then raise exception 'Guest retry created another booking'; end if;
  perform pg_catalog.set_config('test.service_guest_booking', v_guest_booking::text, true);
  select booking_id into v_guest_booking from public.service_create_booking(
    'Test Customer', 'customer@example.invalid', '+94710000000', 'airport_transfer',
    'one_way', 'test-' || pg_catalog.current_setting('test.guest_category'),
    1::smallint, 0::smallint, null, 'USD'::text, pg_catalog.current_setting('test.submit_guest_usd_key'),
    pg_catalog.current_setting('test.submit_legs')::jsonb, pg_catalog.current_setting('test.submit_guest_usd_token')
  );
  perform pg_catalog.set_config('test.service_guest_usd_booking', v_guest_booking::text, true);
end;
$test$;
reset role;

select pg_catalog.set_config('request.jwt.claim.sub', pg_catalog.current_setting('test.guest_other_driver'), true);
select pg_catalog.set_config('request.jwt.claims', pg_catalog.jsonb_build_object(
  'sub', pg_catalog.current_setting('test.guest_other_driver'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $test$
begin
  begin
    perform public.service_create_booking(
      'Test Customer', 'customer@example.invalid', '+94710000000', 'airport_transfer',
      'one_way', 'test-' || pg_catalog.current_setting('test.guest_category'),
      1::smallint, 0::smallint, null, 'USD'::text, pg_catalog.current_setting('test.submit_customer_key'),
      pg_catalog.current_setting('test.submit_legs')::jsonb, pg_catalog.current_setting('test.submit_customer_token')
    );
    raise exception 'Another user used the customer authorization';
  exception when others then
    if sqlerrm <> 'Booking submission is unavailable' then raise; end if;
  end;
end;
$test$;
reset role;

select pg_catalog.set_config('request.jwt.claim.sub', pg_catalog.current_setting('test.guest_customer'), true);
select pg_catalog.set_config('request.jwt.claims', pg_catalog.jsonb_build_object(
  'sub', pg_catalog.current_setting('test.guest_customer'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $test$
declare
  v_customer_booking uuid;
  v_retry uuid;
begin
  select booking_id into v_customer_booking from public.service_create_booking(
    'Test Customer', 'customer@example.invalid', '+94710000000', 'airport_transfer',
    'one_way', 'test-' || pg_catalog.current_setting('test.guest_category'),
    1::smallint, 0::smallint, null, 'USD'::text, pg_catalog.current_setting('test.submit_customer_key'),
    pg_catalog.current_setting('test.submit_legs')::jsonb, pg_catalog.current_setting('test.submit_customer_token')
  );
  perform pg_catalog.set_config('test.service_customer_booking', v_customer_booking::text, true);
  select booking_id into v_retry from public.service_create_booking(
    'Test Customer', 'customer@example.invalid', '+94710000000', 'airport_transfer',
    'one_way', 'test-' || pg_catalog.current_setting('test.guest_category'),
    1::smallint, 0::smallint, null, 'USD'::text, pg_catalog.current_setting('test.submit_customer_key'),
    pg_catalog.current_setting('test.submit_legs')::jsonb, pg_catalog.current_setting('test.submit_customer_retry_token')
  );
  if v_customer_booking <> v_retry then raise exception 'Customer retry created another booking'; end if;
  select booking_id into v_customer_booking from public.service_create_booking(
    'Test Customer', 'customer@example.invalid', '+94710000000', 'airport_transfer',
    'one_way', 'test-' || pg_catalog.current_setting('test.guest_category'),
    1::smallint, 0::smallint, null, 'LKR'::text, pg_catalog.current_setting('test.submit_customer_lkr_key'),
    pg_catalog.current_setting('test.submit_legs')::jsonb, pg_catalog.current_setting('test.submit_customer_lkr_token')
  );
  perform pg_catalog.set_config('test.service_customer_lkr_booking', v_customer_booking::text, true);
end;
$test$;
reset role;
do $test$
begin
  if not exists (
    select 1 from public.bookings as b
    join public.booking_events as e on e.booking_id = b.id and e.event_type = 'booking_created'
    where b.id = pg_catalog.current_setting('test.service_guest_booking')::uuid
      and b.customer_user_id is null and e.actor_user_id is null and b.requested_currency = 'LKR'
  ) or not exists (
    select 1 from public.bookings as b
    join public.booking_events as e on e.booking_id = b.id and e.event_type = 'booking_created'
    where b.id = pg_catalog.current_setting('test.service_customer_booking')::uuid
      and b.customer_user_id = pg_catalog.current_setting('test.guest_customer')::uuid
      and e.actor_user_id = b.customer_user_id and b.requested_currency = 'USD'
  ) or not exists (
    select 1 from public.bookings as b
    join public.booking_events as e on e.booking_id = b.id and e.event_type = 'booking_created'
    where b.id = pg_catalog.current_setting('test.service_guest_usd_booking')::uuid
      and b.customer_user_id is null and e.actor_user_id is null and b.requested_currency = 'USD'
  ) or not exists (
    select 1 from public.bookings as b
    join public.booking_events as e on e.booking_id = b.id and e.event_type = 'booking_created'
    where b.id = pg_catalog.current_setting('test.service_customer_lkr_booking')::uuid
      and b.customer_user_id = pg_catalog.current_setting('test.guest_customer')::uuid
      and e.actor_user_id = b.customer_user_id and b.requested_currency = 'LKR'
  ) then
    raise exception 'Service booking ownership or audit identity is incorrect';
  end if;
end;
$test$;

select pg_catalog.set_config('request.jwt.claim.sub', pg_catalog.current_setting('test.guest_admin'), true);
select pg_catalog.set_config('request.jwt.claims', pg_catalog.jsonb_build_object(
  'sub', pg_catalog.current_setting('test.guest_admin'), 'role', 'authenticated')::text, true);

do $test$
declare
  v_column text;
  v_time timestamptz;
begin
  foreach v_column in array array['pickup_at', 'planned_end_at', 'flight_arrival_at'] loop
    foreach v_time in array array['infinity'::timestamptz, '-infinity'::timestamptz] loop
      begin
        execute pg_catalog.format(
          'update public.booking_legs set %I = $1 where booking_id = $2',
          v_column
        ) using v_time, pg_catalog.current_setting('test.service_guest_booking')::uuid;
        raise exception 'Non-finite % was accepted', v_column;
      exception when check_violation then
        null;
      end;
    end loop;
  end loop;
end;
$test$;

insert into public.vehicles (id, category_id, display_name)
values (
  pg_catalog.current_setting('test.guest_vehicle')::uuid,
  pg_catalog.current_setting('test.guest_category')::uuid, 'Test vehicle'
);
insert into public.bookings (
  id, booking_ref, customer_user_id, customer_name, customer_email, customer_phone,
  service_type, journey_type, passenger_count, luggage_count, booking_status
)
values (
  pg_catalog.current_setting('test.guest_driver_booking')::uuid,
  'TEST-DRIVER-' || pg_catalog.current_setting('test.guest_driver_booking'),
  pg_catalog.current_setting('test.guest_customer')::uuid, 'Guest Test',
  'guest-security@example.invalid', '+94710000000',
  'airport_transfer', 'one_way', 1, 0, 'confirmed'
);
insert into public.booking_legs (
  booking_id, sequence_no, pickup_location, dropoff_location, pickup_at, planned_end_at
)
values (
  pg_catalog.current_setting('test.guest_driver_booking')::uuid, 1, 'Test pickup', 'Test dropoff',
  pg_catalog.now() + interval '30 days', pg_catalog.now() + interval '30 days 2 hours'
);
insert into public.booking_quotes (id, booking_id, revision, currency, total, quote_status, issued_by)
values (
  pg_catalog.current_setting('test.guest_driver_quote')::uuid,
  pg_catalog.current_setting('test.guest_driver_booking')::uuid,
  1, 'LKR', 100, 'draft', pg_catalog.current_setting('test.guest_admin')::uuid
);
insert into public.booking_quote_lines (quote_id, description, quantity, unit_amount, line_total)
values (pg_catalog.current_setting('test.guest_driver_quote')::uuid, 'Test service', 1, 100, 100);
update public.booking_quotes
   set quote_status = 'sent', issued_at = pg_catalog.clock_timestamp(),
       expires_at = pg_catalog.clock_timestamp() + interval '2 days'
 where id = pg_catalog.current_setting('test.guest_driver_quote')::uuid;
update public.booking_quotes
   set quote_status = 'accepted', accepted_at = pg_catalog.clock_timestamp()
 where id = pg_catalog.current_setting('test.guest_driver_quote')::uuid;

set local role authenticated;
select pg_catalog.set_config(
  'test.guest_assignment',
  public.create_booking_assignment(
    pg_catalog.current_setting('test.guest_driver_booking')::uuid,
    pg_catalog.current_setting('test.guest_driver')::uuid,
    pg_catalog.current_setting('test.guest_vehicle')::uuid
  )::text, true
);
select pg_catalog.set_config(
  'test.guest_driver_token', token, true
) from public.admin_create_driver_invitation(
  pg_catalog.current_setting('test.guest_assignment')::uuid, 72
);
reset role;

-- Both invitation helpers accept an active driver.
do $test$
begin
  perform private.lock_valid_driver_invitation(pg_catalog.current_setting('test.guest_driver_token'));
  perform private.resolve_driver_invitation(pg_catalog.current_setting('test.guest_driver_token'));
end;
$test$;

update public.profiles set account_status = 'inactive'
 where id = pg_catalog.current_setting('test.guest_driver')::uuid;
do $test$
begin
  begin
    perform private.lock_valid_driver_invitation(pg_catalog.current_setting('test.guest_driver_token'));
    raise exception 'Inactive driver invitation was accepted';
  exception when others then
    if sqlerrm <> 'Driver invitation is unavailable' then raise; end if;
  end;
  begin
    perform private.resolve_driver_invitation(pg_catalog.current_setting('test.guest_driver_token'));
    raise exception 'Inactive driver document invitation was accepted';
  exception when others then
    if sqlerrm <> 'Document is unavailable' then raise; end if;
  end;
end;
$test$;
update public.profiles set account_status = 'active'
 where id = pg_catalog.current_setting('test.guest_driver')::uuid;
update public.user_roles set revoked_at = pg_catalog.clock_timestamp()
 where user_id = pg_catalog.current_setting('test.guest_driver')::uuid
   and role_id = (select id from public.roles where code = 'driver');
do $test$
begin
  begin
    perform private.resolve_driver_invitation(pg_catalog.current_setting('test.guest_driver_token'));
    raise exception 'Revoked driver role was accepted';
  exception when others then
    if sqlerrm <> 'Document is unavailable' then raise; end if;
  end;
end;
$test$;
insert into public.user_roles (user_id, role_id)
select pg_catalog.current_setting('test.guest_driver')::uuid, id
  from public.roles where code = 'driver';

set local role service_role;
do $test$
begin
  begin
    perform public.service_claim_driver_invitation(
      pg_catalog.current_setting('test.guest_driver_token'),
      pg_catalog.current_setting('test.guest_customer')::uuid
    );
    raise exception 'Non-driver claimed an invitation';
  exception when others then
    if sqlerrm <> 'An active driver account is required' then raise; end if;
  end;
  begin
    perform public.service_claim_driver_invitation(
      pg_catalog.current_setting('test.guest_driver_token'),
      pg_catalog.current_setting('test.guest_other_driver')::uuid
    );
    raise exception 'Another driver claimed an invitation';
  exception when others then
    if sqlerrm <> 'Driver invitation is unavailable' then raise; end if;
  end;
  if public.service_claim_driver_invitation(
    pg_catalog.current_setting('test.guest_driver_token'),
    pg_catalog.current_setting('test.guest_driver')::uuid
  ) <> pg_catalog.current_setting('test.guest_assignment')::uuid then
    raise exception 'Driver claimed the wrong assignment';
  end if;
end;
$test$;
reset role;

set constraints all immediate;
rollback;
\echo guest_access_security_integration: all assertions passed
