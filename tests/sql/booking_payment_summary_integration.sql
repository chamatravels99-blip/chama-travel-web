-- Booking payment summary behavior checks.
-- Run only against a disposable local Supabase/PostgreSQL database or a
-- dedicated staging project after applying every migration through 202611140005.
-- All fixture rows are rolled back; database sequence values may still advance.
begin;

do $setup$
declare
  v_key text;
begin
  foreach v_key in array array[
    'test.admin_id', 'test.customer_id',
    'test.booking_a_id', 'test.booking_b_id',
    'test.quote_a_id', 'test.quote_b_old_id', 'test.quote_b_current_id',
    'test.unverified_claim_id',
    'test.payment_request_a1', 'test.payment_request_a2',
    'test.invoice_request_b1', 'test.invoice_request_b2',
    'test.missing_booking_id'
  ] loop
    perform pg_catalog.set_config(v_key, pg_catalog.gen_random_uuid()::text, true);
  end loop;
end;
$setup$;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select fixture.user_id,
       'authenticated',
       'authenticated',
       'payment-summary-' || fixture.user_id::text || '@example.invalid',
       '',
       pg_catalog.clock_timestamp(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       pg_catalog.jsonb_build_object('full_name', fixture.full_name),
       pg_catalog.clock_timestamp(),
       pg_catalog.clock_timestamp()
  from (
    values
      (pg_catalog.current_setting('test.admin_id')::uuid, 'Billing Test Admin'::text),
      (pg_catalog.current_setting('test.customer_id')::uuid, 'Billing Test Customer'::text)
  ) as fixture(user_id, full_name);

insert into public.user_roles (user_id, role_id)
select pg_catalog.current_setting('test.admin_id')::uuid, r.id
  from public.roles as r
 where r.code = 'admin';

select pg_catalog.set_config(
  'request.jwt.claim.sub',
  pg_catalog.current_setting('test.admin_id'),
  true
);
select pg_catalog.set_config(
  'request.jwt.claims',
  pg_catalog.jsonb_build_object(
    'sub', pg_catalog.current_setting('test.admin_id'),
    'role', 'authenticated'
  )::text,
  true
);

insert into public.bookings (
  id, booking_ref, customer_user_id, customer_name, customer_email,
  customer_phone, service_type, journey_type, passenger_count,
  luggage_count, booking_status
)
values
  (
    pg_catalog.current_setting('test.booking_a_id')::uuid,
    'TEST-BPS-A-' || pg_catalog.left(pg_catalog.current_setting('test.booking_a_id'), 8),
    pg_catalog.current_setting('test.customer_id')::uuid,
    'Billing Test Customer', 'payment-summary-customer@example.invalid',
    '+94710000001', 'airport_transfer', 'one_way', 1, 0, 'pending'
  ),
  (
    pg_catalog.current_setting('test.booking_b_id')::uuid,
    'TEST-BPS-B-' || pg_catalog.left(pg_catalog.current_setting('test.booking_b_id'), 8),
    pg_catalog.current_setting('test.customer_id')::uuid,
    'Billing Test Customer', 'payment-summary-customer@example.invalid',
    '+94710000001', 'airport_transfer', 'one_way', 1, 0, 'pending'
  );

insert into public.booking_legs (
  booking_id, sequence_no, pickup_location, dropoff_location,
  pickup_at, planned_end_at
)
values
  (
    pg_catalog.current_setting('test.booking_a_id')::uuid,
    1, 'Test pickup A', 'Test drop-off A',
    pg_catalog.clock_timestamp() + interval '30 days',
    pg_catalog.clock_timestamp() + interval '30 days 2 hours'
  ),
  (
    pg_catalog.current_setting('test.booking_b_id')::uuid,
    1, 'Test pickup B', 'Test drop-off B',
    pg_catalog.clock_timestamp() + interval '31 days',
    pg_catalog.clock_timestamp() + interval '31 days 2 hours'
  );

insert into public.booking_quotes (
  id, booking_id, revision, currency, total, quote_status, issued_by
)
values
  (
    pg_catalog.current_setting('test.quote_a_id')::uuid,
    pg_catalog.current_setting('test.booking_a_id')::uuid,
    1, 'LKR', 1000, 'draft',
    pg_catalog.current_setting('test.admin_id')::uuid
  ),
  (
    pg_catalog.current_setting('test.quote_b_old_id')::uuid,
    pg_catalog.current_setting('test.booking_b_id')::uuid,
    1, 'LKR', 900, 'draft',
    pg_catalog.current_setting('test.admin_id')::uuid
  ),
  (
    pg_catalog.current_setting('test.quote_b_current_id')::uuid,
    pg_catalog.current_setting('test.booking_b_id')::uuid,
    2, 'LKR', 1000, 'draft',
    pg_catalog.current_setting('test.admin_id')::uuid
  );

insert into public.booking_quote_lines (quote_id, description, quantity, unit_amount, line_total)
values
  (pg_catalog.current_setting('test.quote_a_id')::uuid, 'Test service A', 1, 1000, 1000),
  (pg_catalog.current_setting('test.quote_b_old_id')::uuid, 'Older test service', 1, 900, 900),
  (pg_catalog.current_setting('test.quote_b_current_id')::uuid, 'Current test service', 1, 1000, 1000);

update public.bookings
   set booking_status = 'reviewing'
 where id in (
   pg_catalog.current_setting('test.booking_a_id')::uuid,
   pg_catalog.current_setting('test.booking_b_id')::uuid
 );

update public.booking_quotes
   set quote_status = 'sent',
       issued_at = pg_catalog.clock_timestamp(),
       expires_at = pg_catalog.clock_timestamp() + interval '2 days'
 where id in (
   pg_catalog.current_setting('test.quote_a_id')::uuid,
   pg_catalog.current_setting('test.quote_b_old_id')::uuid,
   pg_catalog.current_setting('test.quote_b_current_id')::uuid
 );

update public.bookings
   set booking_status = 'quoted'
 where id in (
   pg_catalog.current_setting('test.booking_a_id')::uuid,
   pg_catalog.current_setting('test.booking_b_id')::uuid
 );

update public.booking_quotes
   set quote_status = 'superseded'
 where id = pg_catalog.current_setting('test.quote_b_old_id')::uuid;

update public.booking_quotes
   set quote_status = 'accepted',
       accepted_at = pg_catalog.clock_timestamp()
 where id in (
   pg_catalog.current_setting('test.quote_a_id')::uuid,
   pg_catalog.current_setting('test.quote_b_current_id')::uuid
 );

update public.bookings
   set booking_status = 'confirmed'
 where id in (
   pg_catalog.current_setting('test.booking_a_id')::uuid,
   pg_catalog.current_setting('test.booking_b_id')::uuid
 );

select pg_catalog.set_config(
  'request.jwt.claim.sub',
  pg_catalog.current_setting('test.customer_id'),
  true
);
select pg_catalog.set_config(
  'request.jwt.claims',
  pg_catalog.jsonb_build_object(
    'sub', pg_catalog.current_setting('test.customer_id'),
    'role', 'authenticated'
  )::text,
  true
);

insert into public.payment_claims (
  id, booking_id, quote_id, amount, currency, method, submitted_by
)
values (
  pg_catalog.current_setting('test.unverified_claim_id')::uuid,
  pg_catalog.current_setting('test.booking_a_id')::uuid,
  pg_catalog.current_setting('test.quote_a_id')::uuid,
  400, 'LKR', 'cash',
  pg_catalog.current_setting('test.customer_id')::uuid
);

select pg_catalog.set_config(
  'request.jwt.claim.sub',
  pg_catalog.current_setting('test.admin_id'),
  true
);
select pg_catalog.set_config(
  'request.jwt.claims',
  pg_catalog.jsonb_build_object(
    'sub', pg_catalog.current_setting('test.admin_id'),
    'role', 'authenticated'
  )::text,
  true
);

set constraints all immediate;

-- Exercise the new RPC as an authenticated Admin.
set local role authenticated;

do $admin_checks$
declare
  v_summary jsonb;
  v_quote jsonb;
begin
  select public.admin_get_booking_payment_summary(
    pg_catalog.current_setting('test.booking_a_id')::uuid
  ) into v_summary;

  select item.value into v_quote
    from pg_catalog.jsonb_array_elements(v_summary -> 'quote_summaries') as item(value)
   where item.value ->> 'quote_id' = pg_catalog.current_setting('test.quote_a_id');

  if v_quote is null
     or (v_quote ->> 'total_paid')::numeric <> 0
     or (v_quote ->> 'total_refunded')::numeric <> 0
     or (v_quote ->> 'net_paid')::numeric <> 0
     or (v_quote ->> 'outstanding_balance')::numeric <> 1000
     or v_quote ->> 'payment_status' <> 'unpaid'
     or pg_catalog.jsonb_array_length(v_summary -> 'payments') <> 0
  then
    raise exception 'Unpaid booking summary mismatch: %', v_summary;
  end if;

  begin
    perform public.admin_get_booking_payment_summary(
      pg_catalog.current_setting('test.missing_booking_id')::uuid
    );
    raise exception 'TEST_EXPECTED_MISSING_BOOKING_REJECTION';
  exception when others then
    if sqlerrm = 'TEST_EXPECTED_MISSING_BOOKING_REJECTION' then
      raise;
    end if;
    if sqlerrm <> 'Booking is unavailable' then
      raise exception 'Missing-booking error mismatch: %', sqlerrm;
    end if;
  end;
end;
$admin_checks$;

-- A customer JWT must not pass the database-side Admin role check.
reset role;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  pg_catalog.current_setting('test.customer_id'),
  true
);
select pg_catalog.set_config(
  'request.jwt.claims',
  pg_catalog.jsonb_build_object(
    'sub', pg_catalog.current_setting('test.customer_id'),
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

do $non_admin_check$
begin
  begin
    perform public.admin_get_booking_payment_summary(
      pg_catalog.current_setting('test.booking_a_id')::uuid
    );
    raise exception 'TEST_EXPECTED_NON_ADMIN_REJECTION';
  exception when others then
    if sqlerrm = 'TEST_EXPECTED_NON_ADMIN_REJECTION' then
      raise;
    end if;
    if sqlerrm <> 'An active Admin is required' then
      raise exception 'Non-admin error mismatch: %', sqlerrm;
    end if;
  end;
end;
$non_admin_check$;

-- Record payments and refunds through their existing Admin RPCs.
reset role;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  pg_catalog.current_setting('test.admin_id'),
  true
);
select pg_catalog.set_config(
  'request.jwt.claims',
  pg_catalog.jsonb_build_object(
    'sub', pg_catalog.current_setting('test.admin_id'),
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

select pg_catalog.set_config('test.invoice_b1_id', invoice.invoice_id::text, true)
  from public.admin_issue_invoice(
    pg_catalog.current_setting('test.booking_b_id')::uuid,
    pg_catalog.current_setting('test.quote_b_current_id')::uuid,
    pg_catalog.current_setting('test.invoice_request_b1')::uuid
  ) as invoice;

select pg_catalog.set_config('test.invoice_b2_id', invoice.invoice_id::text, true)
  from public.admin_replace_invoice(
    pg_catalog.current_setting('test.invoice_b1_id')::uuid,
    'Integration test invoice replacement',
    pg_catalog.current_setting('test.invoice_request_b2')::uuid
  ) as invoice;

select pg_catalog.set_config(
  'test.payment_a1_id',
  payment.payment_id::text,
  true
)
  from public.admin_record_customer_payment(
    pg_catalog.current_setting('test.booking_a_id')::uuid,
    pg_catalog.current_setting('test.quote_a_id')::uuid,
    300,
    'cash',
    (pg_catalog.clock_timestamp() at time zone 'Asia/Colombo')::date,
    'Integration payment A1',
    pg_catalog.current_setting('test.payment_request_a1')::uuid
  ) as payment;

do $partial_payment_check$
declare
  v_summary jsonb;
  v_quote jsonb;
begin
  select public.admin_get_booking_payment_summary(
    pg_catalog.current_setting('test.booking_a_id')::uuid
  ) into v_summary;
  select item.value into v_quote
    from pg_catalog.jsonb_array_elements(v_summary -> 'quote_summaries') as item(value)
   where item.value ->> 'quote_id' = pg_catalog.current_setting('test.quote_a_id');

  if (v_quote ->> 'total_paid')::numeric <> 300
     or (v_quote ->> 'total_refunded')::numeric <> 0
     or (v_quote ->> 'net_paid')::numeric <> 300
     or (v_quote ->> 'outstanding_balance')::numeric <> 700
     or v_quote ->> 'payment_status' <> 'partially_paid'
     or pg_catalog.jsonb_array_length(v_summary -> 'payments') <> 1
     or v_summary #>> '{payments,0,status}' <> 'verified'
  then
    raise exception 'Partial payment summary mismatch: %', v_summary;
  end if;
end;
$partial_payment_check$;

select pg_catalog.set_config(
  'test.refund_a1_partial_id',
  public.record_payment_refund(
    pg_catalog.current_setting('test.payment_a1_id')::uuid,
    100,
    'Integration partial refund'
  )::text,
  true
);

do $partial_refund_check$
declare
  v_quote jsonb;
begin
  select item.value into v_quote
    from pg_catalog.jsonb_array_elements(
      public.admin_get_booking_payment_summary(
        pg_catalog.current_setting('test.booking_a_id')::uuid
      ) -> 'quote_summaries'
    ) as item(value)
   where item.value ->> 'quote_id' = pg_catalog.current_setting('test.quote_a_id');

  if (v_quote ->> 'total_paid')::numeric <> 300
     or (v_quote ->> 'total_refunded')::numeric <> 100
     or (v_quote ->> 'net_paid')::numeric <> 200
     or (v_quote ->> 'outstanding_balance')::numeric <> 800
     or v_quote ->> 'payment_status' <> 'partially_paid'
  then
    raise exception 'Partial refund summary mismatch: %', v_quote;
  end if;
end;
$partial_refund_check$;

select pg_catalog.set_config(
  'test.payment_a2_id',
  payment.payment_id::text,
  true
)
  from public.admin_record_customer_payment(
    pg_catalog.current_setting('test.booking_a_id')::uuid,
    pg_catalog.current_setting('test.quote_a_id')::uuid,
    800,
    'bank_transfer',
    (pg_catalog.clock_timestamp() at time zone 'Asia/Colombo')::date,
    'Integration payment A2',
    pg_catalog.current_setting('test.payment_request_a2')::uuid
  ) as payment;

do $full_payment_check$
declare
  v_quote jsonb;
begin
  select item.value into v_quote
    from pg_catalog.jsonb_array_elements(
      public.admin_get_booking_payment_summary(
        pg_catalog.current_setting('test.booking_a_id')::uuid
      ) -> 'quote_summaries'
    ) as item(value)
   where item.value ->> 'quote_id' = pg_catalog.current_setting('test.quote_a_id');

  if (v_quote ->> 'total_paid')::numeric <> 1100
     or (v_quote ->> 'total_refunded')::numeric <> 100
     or (v_quote ->> 'net_paid')::numeric <> 1000
     or (v_quote ->> 'outstanding_balance')::numeric <> 0
     or v_quote ->> 'payment_status' <> 'paid'
  then
    raise exception 'Full payment summary mismatch: %', v_quote;
  end if;
end;
$full_payment_check$;

select public.record_payment_refund(
  pg_catalog.current_setting('test.payment_a1_id')::uuid,
  200,
  'Integration remaining refund'
);
select public.record_payment_refund(
  pg_catalog.current_setting('test.payment_a2_id')::uuid,
  800,
  'Integration full refund'
);

do $full_refund_check$
declare
  v_summary jsonb;
  v_quote jsonb;
begin
  select public.admin_get_booking_payment_summary(
    pg_catalog.current_setting('test.booking_a_id')::uuid
  ) into v_summary;
  select item.value into v_quote
    from pg_catalog.jsonb_array_elements(v_summary -> 'quote_summaries') as item(value)
   where item.value ->> 'quote_id' = pg_catalog.current_setting('test.quote_a_id');

  if (v_quote ->> 'total_paid')::numeric <> 1100
     or (v_quote ->> 'total_refunded')::numeric <> 1100
     or (v_quote ->> 'net_paid')::numeric <> 0
     or (v_quote ->> 'outstanding_balance')::numeric <> 1000
     or v_quote ->> 'payment_status' <> 'refunded'
     or pg_catalog.jsonb_array_length(v_summary -> 'payments') <> 4
  then
    raise exception 'Full refund summary mismatch: %', v_summary;
  end if;

  begin
    perform public.record_payment_refund(
      pg_catalog.current_setting('test.payment_a1_id')::uuid,
      0.01,
      'Expected excess refund rejection'
    );
    raise exception 'TEST_EXPECTED_EXCESS_REFUND_REJECTION';
  exception when others then
    if sqlerrm = 'TEST_EXPECTED_EXCESS_REFUND_REJECTION' then
      raise;
    end if;
    if sqlerrm <> 'Refund amount exceeds the remaining refundable balance' then
      raise exception 'Excess-refund error mismatch: %', sqlerrm;
    end if;
  end;

  select public.admin_get_booking_payment_summary(
    pg_catalog.current_setting('test.booking_b_id')::uuid
  ) into v_summary;

  if pg_catalog.jsonb_array_length(v_summary -> 'quote_summaries') <> 2 then
    raise exception 'Expected both quote revisions in summary: %', v_summary;
  end if;

  select item.value into v_quote
    from pg_catalog.jsonb_array_elements(v_summary -> 'quote_summaries') as item(value)
   where item.value ->> 'quote_id' = pg_catalog.current_setting('test.quote_b_old_id');
  if v_quote ->> 'quote_status' <> 'superseded'
     or v_quote ->> 'invoice_status' is not null
  then
    raise exception 'Superseded quote summary mismatch: %', v_quote;
  end if;

  select item.value into v_quote
    from pg_catalog.jsonb_array_elements(v_summary -> 'quote_summaries') as item(value)
   where item.value ->> 'quote_id' = pg_catalog.current_setting('test.quote_b_current_id');
  if v_quote ->> 'quote_status' <> 'accepted'
     or v_quote ->> 'invoice_status' <> 'issued'
  then
    raise exception 'Current quote invoice summary mismatch: %', v_quote;
  end if;

  v_summary := public.admin_list_booking_billing_documents(
    pg_catalog.current_setting('test.booking_b_id')::uuid
  );
  if pg_catalog.jsonb_array_length(v_summary -> 'invoices') <> 2
     or not exists (
       select 1
         from pg_catalog.jsonb_array_elements(v_summary -> 'invoices') as invoice(value)
        where invoice.value ->> 'id' = pg_catalog.current_setting('test.invoice_b1_id')
          and invoice.value ->> 'revision' = '1'
          and invoice.value ->> 'status' = 'cancelled'
     )
     or not exists (
       select 1
         from pg_catalog.jsonb_array_elements(v_summary -> 'invoices') as invoice(value)
        where invoice.value ->> 'id' = pg_catalog.current_setting('test.invoice_b2_id')
          and invoice.value ->> 'revision' = '2'
          and invoice.value ->> 'status' = 'issued'
          and invoice.value ->> 'supersedes_invoice_id' = pg_catalog.current_setting('test.invoice_b1_id')
     )
  then
    raise exception 'Invoice revision history mismatch: %', v_summary -> 'invoices';
  end if;
end;
$full_refund_check$;

-- The recording RPC obtains currency from the quote. Verify that a direct
-- ledger insert cannot bypass the quote-currency relationship either.
reset role;
do $currency_mismatch_check$
begin
  begin
    insert into public.payments (
      booking_id, quote_id, entry_type, amount, currency, method, verified_by
    )
    values (
      pg_catalog.current_setting('test.booking_a_id')::uuid,
      pg_catalog.current_setting('test.quote_a_id')::uuid,
      'receipt', 1, 'USD', 'cash',
      pg_catalog.current_setting('test.admin_id')::uuid
    );
    raise exception 'TEST_EXPECTED_CURRENCY_MISMATCH_REJECTION';
  exception when others then
    if sqlerrm = 'TEST_EXPECTED_CURRENCY_MISMATCH_REJECTION' then
      raise;
    end if;
    if sqlerrm <> 'Payments must reference the accepted quote for the booking' then
      raise exception 'Currency-mismatch error mismatch: %', sqlerrm;
    end if;
  end;
end;
$currency_mismatch_check$;

select 'booking_payment_summary_integration: all assertions passed (fixture transaction rolled back)' as result;
rollback;
