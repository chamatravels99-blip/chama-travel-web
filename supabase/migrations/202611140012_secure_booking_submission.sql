-- Stage the protected booking path without changing the legacy booking grants.
-- The final grant cutover is deliberately separate.
create table private.booking_submission_tokens (
  token_hash bytea primary key check (pg_catalog.octet_length(token_hash) = 32),
  customer_user_id uuid,
  payload_hash bytea not null check (pg_catalog.octet_length(payload_hash) = 32),
  expires_at timestamptz not null
);

create index booking_submission_tokens_expiry_idx
  on private.booking_submission_tokens (expires_at);
alter table private.booking_submission_tokens enable row level security;
revoke all on private.booking_submission_tokens from public, anon, authenticated, service_role;

create or replace function public.issue_booking_submission_token(
  p_customer_user_id uuid,
  p_booking jsonb
)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_token text;
begin
  if pg_catalog.jsonb_typeof(p_booking) is distinct from 'object' then
    raise exception 'Booking submission is unavailable';
  end if;

  if pg_catalog.random() < 0.01 then
    delete from private.booking_submission_tokens
     where expires_at <= pg_catalog.clock_timestamp();
  end if;

  v_token := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
  insert into private.booking_submission_tokens (
    token_hash, customer_user_id, payload_hash, expires_at
  ) values (
    extensions.digest(pg_catalog.convert_to(v_token, 'UTF8'), 'sha256'),
    p_customer_user_id,
    extensions.digest(pg_catalog.convert_to(p_booking::text, 'UTF8'), 'sha256'),
    pg_catalog.clock_timestamp() + interval '2 minutes'
  );
  return v_token;
end;
$function$;

revoke all on function public.issue_booking_submission_token(uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.issue_booking_submission_token(uuid, jsonb) to service_role;

-- Remove the staged wrapper that impersonated a caller-supplied UUID.
drop function if exists public.service_create_booking(
  text, text, text, text, text, text, smallint, smallint, text, char, text, jsonb, uuid
);

create or replace function public.service_create_booking(
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
  p_legs jsonb,
  p_submission_token text
)
returns table (booking_id uuid, booking_ref text)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_token private.booking_submission_tokens%rowtype;
  v_payload jsonb := pg_catalog.jsonb_build_object(
    'p_customer_name', p_customer_name,
    'p_customer_email', p_customer_email,
    'p_customer_phone', p_customer_phone,
    'p_service_type', p_service_type,
    'p_journey_type', p_journey_type,
    'p_category_code', p_category_code,
    'p_passenger_count', p_passenger_count,
    'p_luggage_count', p_luggage_count,
    'p_customer_notes', p_customer_notes,
    'p_requested_currency', p_requested_currency,
    'p_idempotency_key', p_idempotency_key,
    'p_legs', p_legs
  );
begin
  if p_requested_currency is null or p_requested_currency not in ('LKR', 'USD') then
    raise exception 'Booking submission is unavailable';
  end if;
  if p_submission_token is null or p_submission_token !~ '^[0-9a-f]{64}$' then
    raise exception 'Booking submission is unavailable';
  end if;

  select t.* into v_token
    from private.booking_submission_tokens as t
   where t.token_hash = extensions.digest(
     pg_catalog.convert_to(p_submission_token, 'UTF8'), 'sha256'
   )
   for update;
  if not found
     or v_token.expires_at <= pg_catalog.clock_timestamp()
     or v_token.customer_user_id is distinct from (select auth.uid())
     or v_token.payload_hash is distinct from extensions.digest(
       pg_catalog.convert_to(v_payload::text, 'UTF8'), 'sha256'
     )
  then
    raise exception 'Booking submission is unavailable';
  end if;

  delete from private.booking_submission_tokens where token_hash = v_token.token_hash;

  return query
    select b.booking_id, b.booking_ref
      from public.create_booking(
        p_customer_name, p_customer_email, p_customer_phone, p_service_type,
        p_journey_type, p_category_code, p_passenger_count, p_luggage_count,
        p_customer_notes, p_requested_currency::char(3), p_idempotency_key, p_legs
      ) as b;
end;
$function$;

revoke all on function public.service_create_booking(
  text, text, text, text, text, text, smallint, smallint, text, text, text, jsonb, text
) from public, anon, authenticated, service_role;
grant execute on function public.service_create_booking(
  text, text, text, text, text, text, smallint, smallint, text, text, text, jsonb, text
) to anon, authenticated;
