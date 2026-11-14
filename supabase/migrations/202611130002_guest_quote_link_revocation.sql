alter table public.booking_quotes
  add column token_revoked_at timestamptz,
  add constraint booking_quotes_token_revocation_check
    check (
      token_revoked_at is null
      or acceptance_token_hash is not null
    );

create or replace function private.guard_booking_quote_update()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if old.quote_status = 'draft' then
    if new.quote_status not in ('draft', 'sent', 'expired', 'superseded') then
      raise exception 'Invalid draft quote transition';
    end if;
    return new;
  end if;

  if old.quote_status = 'sent'
     and new.quote_status = 'sent'
  then
    if old.token_revoked_at is not null
       or new.token_revoked_at is null
       or new.booking_id is distinct from old.booking_id
       or new.revision is distinct from old.revision
       or new.currency is distinct from old.currency
       or new.total is distinct from old.total
       or new.issued_at is distinct from old.issued_at
       or new.expires_at is distinct from old.expires_at
       or new.issued_by is distinct from old.issued_by
       or new.accepted_at is distinct from old.accepted_at
       or new.acceptance_token_hash is distinct from old.acceptance_token_hash
       or new.token_expires_at is distinct from old.token_expires_at
       or new.token_consumed_at is distinct from old.token_consumed_at
       or new.created_at is distinct from old.created_at
       or new.quote_source is distinct from old.quote_source
    then
      raise exception 'A sent quote only permits a one-time guest-link revocation';
    end if;
    return new;
  end if;

  if old.quote_status <> 'sent'
     or new.quote_status not in ('accepted', 'expired', 'superseded', 'rejected')
     or new.booking_id is distinct from old.booking_id
     or new.revision is distinct from old.revision
     or new.currency is distinct from old.currency
     or new.total is distinct from old.total
     or new.issued_at is distinct from old.issued_at
     or new.expires_at is distinct from old.expires_at
     or new.issued_by is distinct from old.issued_by
     or new.acceptance_token_hash is distinct from old.acceptance_token_hash
     or new.token_expires_at is distinct from old.token_expires_at
     or new.token_revoked_at is distinct from old.token_revoked_at
     or new.created_at is distinct from old.created_at
     or new.quote_source is distinct from old.quote_source
  then
    raise exception 'Issued quote terms are immutable';
  end if;

  if new.quote_status = 'accepted' then
    if new.accepted_at is null then
      raise exception 'Accepted quote requires accepted_at';
    end if;
    if old.acceptance_token_hash is not null
       and new.token_consumed_at is null then
      raise exception 'Guest quote acceptance must consume its token';
    end if;
  elsif new.accepted_at is not null or new.token_consumed_at is not null then
    raise exception 'Only an accepted quote may have acceptance metadata';
  end if;

  return new;
end;
$function$;

create or replace function public.accept_guest_quote(p_quote_id uuid, p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_booking_id uuid;
  v_customer_user_id uuid;
  v_booking_status text;
  v_quote_status text;
  v_expires_at timestamptz;
  v_token_hash bytea;
  v_stored_hash bytea;
  v_token_expires_at timestamptz;
  v_token_consumed_at timestamptz;
  v_token_revoked_at timestamptz;
  v_now timestamptz;
begin
  if p_token is null or pg_catalog.char_length(p_token) < 32
     or pg_catalog.char_length(p_token) > 256
  then
    raise exception 'Quote acceptance is unavailable';
  end if;

  select q.booking_id
    into v_booking_id
    from public.booking_quotes as q
   where q.id = p_quote_id;

  if not found then
    raise exception 'Quote acceptance is unavailable';
  end if;

  select b.customer_user_id, b.booking_status
    into v_customer_user_id, v_booking_status
    from public.bookings as b
   where b.id = v_booking_id
   for update;

  select
    q.quote_status,
    q.expires_at,
    q.acceptance_token_hash,
    q.token_expires_at,
    q.token_consumed_at,
    q.token_revoked_at
    into
    v_quote_status,
    v_expires_at,
    v_stored_hash,
    v_token_expires_at,
    v_token_consumed_at,
    v_token_revoked_at
    from public.booking_quotes as q
   where q.id = p_quote_id
     and q.booking_id = v_booking_id
   for update;

  v_token_hash := extensions.digest(
    pg_catalog.convert_to(p_token, 'UTF8'),
    'sha256'
  );
  v_now := pg_catalog.clock_timestamp();

  if v_customer_user_id is not null
     or v_booking_status is distinct from 'quoted'
     or v_quote_status is distinct from 'sent'
     or v_expires_at is null
     or v_expires_at <= v_now
     or v_token_expires_at is null
     or v_token_expires_at <= v_now
     or v_token_consumed_at is not null
     or v_token_revoked_at is not null
     or v_stored_hash is null
     or v_stored_hash <> v_token_hash
  then
    raise exception 'Quote acceptance is unavailable';
  end if;

  update public.booking_quotes
     set quote_status = 'accepted',
         accepted_at = v_now,
         token_consumed_at = v_now
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

create or replace function public.admin_revoke_guest_quote_acceptance_link(
  p_quote_id uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_booking_id uuid;
  v_customer_user_id uuid;
  v_booking_status text;
  v_quote_status text;
  v_quote_expires_at timestamptz;
  v_token_hash bytea;
  v_token_expires_at timestamptz;
  v_token_consumed_at timestamptz;
  v_token_revoked_at timestamptz;
  v_now timestamptz;
begin
  if not exists (
    select 1
      from public.profiles as p
      join public.user_roles as ur
        on ur.user_id = p.id and ur.revoked_at is null
      join public.roles as r on r.id = ur.role_id
     where p.id = v_actor
       and p.account_status = 'active'
       and r.code in ('admin', 'super_admin')
  ) then
    raise exception 'An active Admin is required';
  end if;

  select q.booking_id
    into v_booking_id
    from public.booking_quotes as q
   where q.id = p_quote_id;
  if not found then
    raise exception 'Guest quote link is unavailable';
  end if;

  select b.customer_user_id, b.booking_status
    into v_customer_user_id, v_booking_status
    from public.bookings as b
   where b.id = v_booking_id
   for update;
  if not found then
    raise exception 'Guest quote link is unavailable';
  end if;

  select
    q.quote_status,
    q.expires_at,
    q.acceptance_token_hash,
    q.token_expires_at,
    q.token_consumed_at,
    q.token_revoked_at
    into
    v_quote_status,
    v_quote_expires_at,
    v_token_hash,
    v_token_expires_at,
    v_token_consumed_at,
    v_token_revoked_at
    from public.booking_quotes as q
   where q.id = p_quote_id
     and q.booking_id = v_booking_id
   for update;

  v_now := pg_catalog.clock_timestamp();
  if not found
     or v_customer_user_id is not null
     or v_booking_status is distinct from 'quoted'
     or v_quote_status is distinct from 'sent'
     or v_quote_expires_at is null
     or v_quote_expires_at <= v_now
     or v_token_hash is null
     or v_token_expires_at is null
     or v_token_expires_at <= v_now
     or v_token_consumed_at is not null
     or v_token_revoked_at is not null
  then
    raise exception 'Guest quote link is unavailable';
  end if;

  update public.booking_quotes
     set token_revoked_at = v_now
   where id = p_quote_id;

  insert into public.booking_events (
    booking_id, event_type, actor_user_id, details, created_at
  )
  values (
    v_booking_id,
    'guest_quote_acceptance_link_revoked',
    v_actor,
    pg_catalog.jsonb_build_object(
      'quote_id', p_quote_id,
      'revoked_at', v_now
    ),
    v_now
  );

  return v_now;
end;
$function$;

revoke all on function public.admin_revoke_guest_quote_acceptance_link(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_revoke_guest_quote_acceptance_link(uuid)
  to authenticated;

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

comment on column public.booking_quotes.token_revoked_at is
  'One-way revocation timestamp for the guest acceptance token; quote and booking terms are unchanged.';
comment on function public.admin_revoke_guest_quote_acceptance_link(uuid) is
  'Admin-only atomic revocation of an active guest quote token with an actor-attributed booking event.';
