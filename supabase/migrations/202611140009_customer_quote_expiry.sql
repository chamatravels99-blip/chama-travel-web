-- Check registered-customer quote expiry only after the relevant locks are held.
create or replace function public.accept_customer_quote(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_booking_id uuid;
  v_customer_user_id uuid;
  v_account_status text;
  v_quote_status text;
  v_expires_at timestamptz;
  v_token_hash bytea;
  v_token_revoked_at timestamptz;
  v_now timestamptz;
begin
  if v_user_id is null then
    raise exception 'Quote acceptance is unavailable';
  end if;

  select q.booking_id
    into v_booking_id
    from public.booking_quotes as q
   where q.id = p_quote_id;
  if not found then
    raise exception 'Quote acceptance is unavailable';
  end if;

  select b.customer_user_id, p.account_status
    into v_customer_user_id, v_account_status
    from public.bookings as b
    join public.profiles as p on p.id = b.customer_user_id
   where b.id = v_booking_id
   for update of b, p;
  if not found
     or v_customer_user_id is distinct from v_user_id
     or v_account_status is distinct from 'active'
     or (select b.booking_status from public.bookings as b where b.id = v_booking_id)
        is distinct from 'quoted'
  then
    raise exception 'Quote acceptance is unavailable';
  end if;

  select q.quote_status, q.expires_at, q.acceptance_token_hash, q.token_revoked_at
    into v_quote_status, v_expires_at, v_token_hash, v_token_revoked_at
    from public.booking_quotes as q
   where q.id = p_quote_id
     and q.booking_id = v_booking_id
   for update;
  v_now := pg_catalog.clock_timestamp();
  if not found
     or v_quote_status <> 'sent'
     or v_expires_at is null
     or v_expires_at <= v_now
     or (v_token_hash is not null and v_token_revoked_at is null)
  then
    raise exception 'Quote acceptance is unavailable';
  end if;

  update public.booking_quotes
     set quote_status = 'accepted',
         accepted_at = v_now,
         confirmation_method = 'registered_account',
         token_consumed_at = case
           when v_token_hash is null then null
           else v_now
         end
   where id = p_quote_id;

  update public.booking_quotes
     set quote_status = 'superseded'
   where booking_id = v_booking_id
     and id <> p_quote_id
     and quote_status = 'sent';

  update public.bookings
     set booking_status = 'confirmed'
   where id = v_booking_id;
end;
$function$;
