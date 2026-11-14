create or replace function public.service_claim_guest_booking_access(p_token text, p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_token_hash bytea;
  v_access_id uuid;
  v_booking_id uuid;
  v_expires_at timestamptz;
  v_revoked_quote_count integer;
  v_now timestamptz;
begin
  if not private.has_active_role(p_user_id, array['customer']) then
    raise exception 'An active customer account is required';
  end if;
  if p_token is null or p_token !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'Booking access is unavailable';
  end if;
  v_token_hash := extensions.digest(
    pg_catalog.convert_to(pg_catalog.lower(p_token), 'UTF8'), 'sha256'
  );
  select t.id, t.booking_id into v_access_id, v_booking_id
    from private.guest_booking_access_tokens as t
   where t.token_hash = v_token_hash;
  if not found then
    raise exception 'Booking access is unavailable';
  end if;
  perform 1 from public.bookings as b where b.id = v_booking_id for update;
  if not found then
    raise exception 'Booking access is unavailable';
  end if;
  select t.expires_at into v_expires_at
    from private.guest_booking_access_tokens as t
   where t.id = v_access_id
     and t.token_hash = v_token_hash
     and t.revoked_at is null
     and t.claimed_at is null
   for update;
  if not found then
    raise exception 'Booking access is unavailable';
  end if;
  v_now := pg_catalog.clock_timestamp();
  if v_expires_at <= v_now then
    raise exception 'Booking access is unavailable';
  end if;
  update public.booking_quotes
     set token_revoked_at = v_now
   where booking_id = v_booking_id
     and quote_status = 'sent'
     and acceptance_token_hash is not null
     and token_revoked_at is null;
  get diagnostics v_revoked_quote_count = row_count;
  update public.bookings
     set customer_user_id = p_user_id
   where id = v_booking_id and customer_user_id is null;
  if not found then
    raise exception 'Booking access is unavailable';
  end if;
  update private.guest_booking_access_tokens
     set revoked_at = v_now, claimed_at = v_now, claimed_by = p_user_id
   where id = v_access_id;
  insert into public.booking_events (booking_id, event_type, actor_user_id, details, created_at)
  values (
    v_booking_id, 'guest_booking_linked_to_customer', p_user_id,
    pg_catalog.jsonb_build_object(
      'access_id', v_access_id,
      'guest_quote_links_revoked', v_revoked_quote_count
    ), v_now
  );
  return v_booking_id;
end;
$function$;

revoke all on function public.service_claim_guest_booking_access(text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.service_claim_guest_booking_access(text, uuid)
  to service_role;
