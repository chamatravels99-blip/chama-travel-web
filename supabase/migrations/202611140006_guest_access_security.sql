-- Guest-token issuance and account linking must go through rate-limited routes.
-- An explicit admin revocation permanently disables issuance with the original
-- booking idempotency key.

create or replace function public.issue_guest_booking_tracker_token(
  p_booking_id uuid,
  p_idempotency_key text
)
returns table (token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_token text;
  v_token_id uuid;
  v_revoked_count integer;
begin
  if p_booking_id is null
     or p_idempotency_key is null
     or p_idempotency_key !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
  then
    raise exception 'Booking access is unavailable';
  end if;

  perform 1
    from public.bookings as b
   where b.id = p_booking_id
     and b.customer_user_id is null
     and b.idempotency_key = p_idempotency_key
   for update;
  if not found or exists (
    select 1 from public.booking_events as e
     where e.booking_id = p_booking_id
       and e.event_type = 'guest_booking_tracker_link_revoked'
  ) then
    raise exception 'Booking access is unavailable';
  end if;

  update private.guest_booking_access_tokens
     set revoked_at = v_now
   where booking_id = p_booking_id
     and revoked_at is null
     and claimed_at is null;
  get diagnostics v_revoked_count = row_count;

  v_token := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
  insert into private.guest_booking_access_tokens (booking_id, token_hash, expires_at)
  values (
    p_booking_id,
    extensions.digest(pg_catalog.convert_to(v_token, 'UTF8'), 'sha256'),
    v_now + interval '365 days'
  )
  returning id into v_token_id;

  insert into public.booking_events (booking_id, event_type, actor_user_id, details, created_at)
  values (
    p_booking_id,
    'guest_booking_tracker_link_issued',
    (select auth.uid()),
    pg_catalog.jsonb_build_object(
      'access_id', v_token_id,
      'expires_at', v_now + interval '365 days',
      'rotated_previous_link', v_revoked_count > 0
    ),
    v_now
  );
  return query select v_token, v_now + interval '365 days';
end;
$function$;

create or replace function private.lock_valid_driver_invitation(p_token text)
returns private.driver_assignment_invitations
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_invitation private.driver_assignment_invitations%rowtype;
begin
  if p_token is null or p_token !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'Driver invitation is unavailable';
  end if;
  select i.* into v_invitation
    from private.driver_assignment_invitations as i
   where i.token_hash = private.hash_access_token(p_token)
   for update;
  if not found
     or v_invitation.revoked_at is not null
     or v_invitation.consumed_at is not null
     or v_invitation.expires_at <= pg_catalog.clock_timestamp()
     or not private.has_active_role(v_invitation.driver_user_id, array['driver'])
  then
    raise exception 'Driver invitation is unavailable';
  end if;
  return v_invitation;
end;
$function$;

create or replace function private.resolve_driver_invitation(p_token text)
returns private.driver_assignment_invitations
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_invitation private.driver_assignment_invitations%rowtype;
begin
  if p_token is null or p_token !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'Document is unavailable';
  end if;
  select i.* into v_invitation
    from private.driver_assignment_invitations as i
   where i.token_hash = private.hash_access_token(p_token)
     and i.revoked_at is null
     and i.consumed_at is null
     and i.expires_at > pg_catalog.clock_timestamp()
     and private.has_active_role(i.driver_user_id, array['driver']);
  if not found then
    raise exception 'Document is unavailable';
  end if;
  return v_invitation;
end;
$function$;

-- Only a trusted server may supply the independently authenticated user ID.
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
  v_revoked_quote_count integer;
  v_now timestamptz := pg_catalog.clock_timestamp();
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
  perform 1
    from private.guest_booking_access_tokens as t
   where t.id = v_access_id
     and t.token_hash = v_token_hash
     and t.expires_at > v_now
     and t.revoked_at is null
     and t.claimed_at is null
   for update;
  if not found then
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

create or replace function public.service_claim_driver_invitation(p_token text, p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_invitation private.driver_assignment_invitations%rowtype;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if not private.has_active_role(p_user_id, array['driver']) then
    raise exception 'An active driver account is required';
  end if;
  v_invitation := private.lock_valid_driver_invitation(p_token);
  if v_invitation.driver_user_id is distinct from p_user_id then
    raise exception 'Driver invitation is unavailable';
  end if;
  update private.driver_assignment_invitations
     set consumed_at = v_now, consumed_by = p_user_id
   where id = v_invitation.id;
  insert into public.booking_events (booking_id, event_type, actor_user_id, details, created_at)
  values (
    v_invitation.booking_id, 'driver_invitation_linked', p_user_id,
    pg_catalog.jsonb_build_object(
      'invitation_id', v_invitation.id,
      'assignment_id', v_invitation.assignment_id
    ), v_now
  );
  return v_invitation.assignment_id;
end;
$function$;

revoke all on function private.lock_valid_driver_invitation(text),
  private.resolve_driver_invitation(text)
  from public, anon, authenticated, service_role;
revoke all on function public.issue_guest_booking_tracker_token(uuid, text),
  public.claim_guest_booking_access(text),
  public.claim_driver_invitation(text),
  public.service_claim_guest_booking_access(text, uuid),
  public.service_claim_driver_invitation(text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.issue_guest_booking_tracker_token(uuid, text),
  public.service_claim_guest_booking_access(text, uuid),
  public.service_claim_driver_invitation(text, uuid)
  to service_role;
