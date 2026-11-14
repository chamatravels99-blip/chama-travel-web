create table private.guest_booking_access_tokens (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete restrict,
  token_hash bytea not null unique,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  claimed_at timestamptz,
  claimed_by uuid references public.profiles (id) on delete restrict,
  constraint guest_booking_access_token_hash_length
    check (pg_catalog.octet_length(token_hash) = 32),
  constraint guest_booking_access_token_expiry
    check (expires_at > created_at),
  constraint guest_booking_access_token_claim_state
    check (
      (claimed_at is null and claimed_by is null)
      or (claimed_at is not null and claimed_by is not null and revoked_at is not null)
    ),
  constraint guest_booking_access_token_revocation_time
    check (revoked_at is null or revoked_at >= created_at)
);

create index guest_booking_access_tokens_booking_created_idx
  on private.guest_booking_access_tokens (booking_id, created_at desc);

alter table private.guest_booking_access_tokens enable row level security;
revoke all on private.guest_booking_access_tokens
  from public, anon, authenticated, service_role;

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
  if not found then
    raise exception 'Booking access is unavailable';
  end if;

  update private.guest_booking_access_tokens
     set revoked_at = v_now
   where booking_id = p_booking_id
     and revoked_at is null
     and claimed_at is null;
  get diagnostics v_revoked_count = row_count;

  v_token := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
  insert into private.guest_booking_access_tokens (
    booking_id,
    token_hash,
    expires_at
  )
  values (
    p_booking_id,
    extensions.digest(pg_catalog.convert_to(v_token, 'UTF8'), 'sha256'),
    v_now + interval '365 days'
  )
  returning id into v_token_id;

  insert into public.booking_events (
    booking_id, event_type, actor_user_id, details, created_at
  )
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

create or replace function public.get_guest_booking_tracker(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_booking_id uuid;
  v_token_hash bytea;
  v_result jsonb;
begin
  if p_token is null or p_token !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'Booking tracker is unavailable';
  end if;

  v_token_hash := extensions.digest(
    pg_catalog.convert_to(pg_catalog.lower(p_token), 'UTF8'),
    'sha256'
  );

  select t.booking_id
    into v_booking_id
    from private.guest_booking_access_tokens as t
    join public.bookings as b on b.id = t.booking_id
   where t.token_hash = v_token_hash
     and t.expires_at > pg_catalog.statement_timestamp()
     and t.revoked_at is null
     and t.claimed_at is null
     and b.customer_user_id is null;
  if not found then
    raise exception 'Booking tracker is unavailable';
  end if;

  select pg_catalog.jsonb_build_object(
    'booking', pg_catalog.jsonb_build_object(
      'booking_ref', b.booking_ref,
      'service_type', b.service_type,
      'journey_type', b.journey_type,
      'booking_status', b.booking_status,
      'passenger_count', b.passenger_count,
      'luggage_count', b.luggage_count,
      'created_at', b.created_at
    ),
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
    'quotes', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'revision', q.revision,
          'currency', q.currency,
          'total', q.total,
          'quote_status', q.quote_status,
          'issued_at', q.issued_at,
          'expires_at', q.expires_at,
          'accepted_at', q.accepted_at,
          'lines', coalesce((
            select pg_catalog.jsonb_agg(
              pg_catalog.jsonb_build_object(
                'description', ql.description,
                'quantity', ql.quantity,
                'unit_amount', ql.unit_amount,
                'line_total', ql.line_total
              ) order by ql.id
            )
              from public.booking_quote_lines as ql
             where ql.quote_id = q.id
          ), '[]'::jsonb)
        ) order by q.revision desc
      )
        from public.booking_quotes as q
       where q.booking_id = b.id
         and q.quote_status in ('sent', 'accepted', 'expired', 'rejected', 'superseded')
    ), '[]'::jsonb),
    'payments', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'entry_type', p.entry_type,
          'amount', p.amount,
          'currency', p.currency,
          'method', p.method,
          'receipt_number', p.receipt_number,
          'payment_date', p.payment_date,
          'recorded_at', p.verified_at
        ) order by p.created_at
      )
        from public.payments as p
       where p.booking_id = b.id
    ), '[]'::jsonb),
    'payment_summary', (
      select pg_catalog.jsonb_build_object(
        'currency', q.currency,
        'total', q.total,
        'paid', coalesce(
          pg_catalog.sum(
            case when p.entry_type = 'receipt' then p.amount else -p.amount end
          ),
          0
        ),
        'balance', greatest(
          q.total - coalesce(
            pg_catalog.sum(
              case when p.entry_type = 'receipt' then p.amount else -p.amount end
            ),
            0
          ),
          0
        )
      )
        from public.booking_quotes as q
        left join public.payments as p
          on p.booking_id = b.id and p.quote_id = q.id
       where q.booking_id = b.id and q.quote_status = 'accepted'
       group by q.id
    ),
    'progress', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'event_type', e.event_type,
          'from_status', e.from_status,
          'to_status', e.to_status,
          'created_at', e.created_at
        ) order by e.created_at
      )
        from public.booking_events as e
       where e.booking_id = b.id
         and e.event_type in (
           'booking_created',
           'booking_status_changed',
           'driver_on_the_way',
           'driver_assignment_status_changed'
         )
    ), '[]'::jsonb),
    'driver', (
      select pg_catalog.jsonb_build_object(
        'name', dp.full_name,
        'phone', dp.phone,
        'vehicle_name', v.display_name,
        'vehicle_type', vc.display_name,
        'registration_number', v.registration_number
      )
        from public.booking_assignments as ba
        join public.profiles as dp on dp.id = ba.driver_user_id
        join public.vehicles as v on v.id = ba.vehicle_id
        join public.vehicle_categories as vc on vc.id = v.category_id
       where ba.booking_id = b.id
         and ba.assignment_status in ('accepted', 'in_progress', 'completed')
       order by ba.assigned_at desc
       limit 1
    )
  )
    into v_result
    from public.bookings as b
   where b.id = v_booking_id
     and b.customer_user_id is null;

  return v_result;
end;
$function$;

create or replace function public.claim_guest_booking_access(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_token_hash bytea;
  v_access_id uuid;
  v_booking_id uuid;
  v_revoked_quote_count integer;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if not exists (
    select 1
      from public.profiles as p
      join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
      join public.roles as r on r.id = ur.role_id
     where p.id = v_actor
       and p.account_status = 'active'
       and r.code = 'customer'
  ) then
    raise exception 'An active customer account is required';
  end if;

  if p_token is null or p_token !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'Booking access is unavailable';
  end if;

  v_token_hash := extensions.digest(
    pg_catalog.convert_to(pg_catalog.lower(p_token), 'UTF8'),
    'sha256'
  );

  select t.id, t.booking_id
    into v_access_id, v_booking_id
    from private.guest_booking_access_tokens as t
   where t.token_hash = v_token_hash;
  if not found then
    raise exception 'Booking access is unavailable';
  end if;

  perform 1
    from public.bookings as b
   where b.id = v_booking_id
   for update;
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
     set customer_user_id = v_actor
   where id = v_booking_id
     and customer_user_id is null;
  if not found then
    raise exception 'Booking access is unavailable';
  end if;

  update private.guest_booking_access_tokens
     set revoked_at = v_now,
         claimed_at = v_now,
         claimed_by = v_actor
   where id = v_access_id;

  insert into public.booking_events (
    booking_id, event_type, actor_user_id, details, created_at
  )
  values (
    v_booking_id,
    'guest_booking_linked_to_customer',
    v_actor,
    pg_catalog.jsonb_build_object(
      'access_id', v_access_id,
      'guest_quote_links_revoked', v_revoked_quote_count
    ),
    v_now
  );

  return v_booking_id;
end;
$function$;

create or replace function private.assert_booking_quote_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_booking_id uuid;
  v_booking_status text;
  v_customer_user_id uuid;
  v_has_sent_quote boolean;
  v_has_accepted_quote boolean;
begin
  if tg_table_name = 'bookings' then
    v_booking_id := coalesce(new.id, old.id);
  else
    v_booking_id := coalesce(new.booking_id, old.booking_id);
  end if;

  select b.booking_status, b.customer_user_id
    into v_booking_status, v_customer_user_id
    from public.bookings as b
   where b.id = v_booking_id;
  if not found then
    return null;
  end if;

  select
    coalesce(pg_catalog.bool_or(q.quote_status = 'sent'), false),
    coalesce(pg_catalog.bool_or(q.quote_status = 'accepted'), false)
    into v_has_sent_quote, v_has_accepted_quote
    from public.booking_quotes as q
   where q.booking_id = v_booking_id;

  if v_booking_status = 'quoted' and not v_has_sent_quote then
    raise exception 'A quoted booking must have a sent quote';
  end if;
  if v_booking_status in ('confirmed', 'assigned', 'in_progress', 'completed')
     and not v_has_accepted_quote
  then
    raise exception 'A confirmed or active booking must have an accepted quote';
  end if;
  if exists (
    select 1
      from public.booking_quotes as q
     where q.booking_id = v_booking_id
       and q.quote_status = 'sent'
       and v_booking_status <> 'quoted'
  ) then
    raise exception 'A sent quote requires a booking in quoted status';
  end if;
  if exists (
    select 1
      from public.booking_quotes as q
     where q.booking_id = v_booking_id
       and (
         (v_customer_user_id is null
           and q.quote_status in ('sent', 'accepted')
           and (q.acceptance_token_hash is null or q.token_expires_at is null))
         or (v_customer_user_id is not null
           and q.acceptance_token_hash is not null
           and q.quote_status in ('sent', 'accepted')
           and q.token_revoked_at is null
           and q.token_consumed_at is null)
         or (q.quote_status = 'accepted'
           and q.acceptance_token_hash is not null
           and q.token_consumed_at is null)
       )
  ) then
    raise exception 'Quote acceptance token state does not match booking ownership';
  end if;
  if v_has_accepted_quote
     and v_booking_status not in (
       'confirmed', 'assigned', 'in_progress', 'completed', 'cancelled'
     )
  then
    raise exception 'An accepted quote requires a confirmed or subsequently cancelled booking';
  end if;
  return null;
end;
$function$;

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
  v_now timestamptz := pg_catalog.clock_timestamp();
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

create or replace function public.admin_revoke_guest_booking_tracker(p_booking_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_revoked_count integer;
begin
  if not exists (
    select 1
      from public.profiles as p
      join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
      join public.roles as r on r.id = ur.role_id
     where p.id = v_actor
       and p.account_status = 'active'
       and r.code in ('admin', 'super_admin')
  ) then
    raise exception 'An active Admin is required';
  end if;

  perform 1
    from public.bookings as b
   where b.id = p_booking_id
     and b.customer_user_id is null
   for update;
  if not found then
    raise exception 'Guest booking access is unavailable';
  end if;

  update private.guest_booking_access_tokens
     set revoked_at = v_now
   where booking_id = p_booking_id
     and revoked_at is null
     and claimed_at is null;
  get diagnostics v_revoked_count = row_count;
  if v_revoked_count = 0 then
    raise exception 'Guest booking access is unavailable';
  end if;

  insert into public.booking_events (
    booking_id, event_type, actor_user_id, details, created_at
  )
  values (
    p_booking_id,
    'guest_booking_tracker_link_revoked',
    v_actor,
    pg_catalog.jsonb_build_object('revoked_at', v_now),
    v_now
  );

  return v_now;
end;
$function$;

create or replace function public.admin_list_guest_booking_tracker_states()
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
        'booking_id', b.id,
        'expires_at', latest.expires_at,
        'revoked_at', latest.revoked_at,
        'active', latest.id is not null
          and latest.revoked_at is null
          and latest.expires_at > pg_catalog.statement_timestamp()
      ) order by b.created_at desc
    ),
    '[]'::jsonb
  )
    into v_result
    from public.bookings as b
    left join lateral (
      select t.id, t.expires_at, t.revoked_at
        from private.guest_booking_access_tokens as t
       where t.booking_id = b.id
       order by t.created_at desc
       limit 1
    ) as latest on true
   where b.customer_user_id is null;

  return v_result;
end;
$function$;

revoke all on function public.issue_guest_booking_tracker_token(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.get_guest_booking_tracker(text)
  from public, anon, authenticated, service_role;
revoke all on function public.claim_guest_booking_access(text)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_revoke_guest_booking_tracker(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_list_guest_booking_tracker_states()
  from public, anon, authenticated, service_role;

grant execute on function public.issue_guest_booking_tracker_token(uuid, text)
  to anon, authenticated;
grant execute on function public.get_guest_booking_tracker(text)
  to anon, authenticated;
grant execute on function public.claim_guest_booking_access(text)
  to authenticated;
grant execute on function public.admin_revoke_guest_booking_tracker(uuid)
  to authenticated;
grant execute on function public.admin_list_guest_booking_tracker_states()
  to authenticated;

comment on table private.guest_booking_access_tokens is
  'Hash-only expiring guest booking tracker capabilities; direct application table access is denied.';
comment on function public.issue_guest_booking_tracker_token(uuid, text) is
  'Issues or rotates a guest tracker token only when the caller knows the booking creation idempotency key.';
comment on function public.get_guest_booking_tracker(text) is
  'Returns a minimized guest booking DTO only for a valid, unexpired, unrevoked token.';
comment on function public.claim_guest_booking_access(text) is
  'Links one guest booking to the authenticated customer only with a valid tracker token, then revokes that token.';
comment on function public.admin_revoke_guest_booking_tracker(uuid) is
  'Revokes guest tracker access for an unclaimed guest booking and records an Admin event.';
