-- Staged replacement: existing create_booking grants are intentionally unchanged.
-- Only the trusted server may supply the independently authenticated user ID.
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
  p_requested_currency char(3),
  p_idempotency_key text,
  p_legs jsonb,
  p_customer_user_id uuid
)
returns table (booking_id uuid, booking_ref text)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_old_sub text := pg_catalog.current_setting('request.jwt.claim.sub', true);
  v_old_claims text := pg_catalog.current_setting('request.jwt.claims', true);
begin
  if p_customer_user_id is not null
     and not private.has_active_role(p_customer_user_id, array['customer'])
  then
    raise exception 'An active customer account is required';
  end if;

  perform pg_catalog.set_config(
    'request.jwt.claim.sub', coalesce(p_customer_user_id::text, ''), true
  );
  perform pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('sub', p_customer_user_id)::text,
    true
  );

  return query
    select b.booking_id, b.booking_ref
      from public.create_booking(
        p_customer_name, p_customer_email, p_customer_phone, p_service_type,
        p_journey_type, p_category_code, p_passenger_count, p_luggage_count,
        p_customer_notes, p_requested_currency, p_idempotency_key, p_legs
      ) as b;

  perform pg_catalog.set_config('request.jwt.claim.sub', coalesce(v_old_sub, ''), true);
  perform pg_catalog.set_config('request.jwt.claims', coalesce(v_old_claims, ''), true);
end;
$function$;

revoke all on function public.service_create_booking(
  text, text, text, text, text, text, smallint, smallint, text, char, text, jsonb, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.service_create_booking(
  text, text, text, text, text, text, smallint, smallint, text, char, text, jsonb, uuid
) to service_role;
