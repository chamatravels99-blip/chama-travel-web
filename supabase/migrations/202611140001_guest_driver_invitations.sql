-- Guest driver invitations and secure account linking.
--
-- Drivers always own a provisioned Auth/profile record (booking_assignments
-- references profiles). An invitation lets that driver review and answer one
-- specific assignment from a secure link without signing in, and later link
-- the invitation to the authenticated account that owns the assignment.

create or replace function private.has_active_role(p_user_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select p_user_id is not null
    and exists (
      select 1
        from public.profiles as p
        join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
        join public.roles as r on r.id = ur.role_id
       where p.id = p_user_id
         and p.account_status = 'active'
         and r.code = any (p_roles)
    );
$function$;

create or replace function private.hash_access_token(p_token text)
returns bytea
language sql
immutable
set search_path = ''
as $function$
  select extensions.digest(pg_catalog.convert_to(pg_catalog.lower(p_token), 'UTF8'), 'sha256');
$function$;

revoke all on function private.has_active_role(uuid, text[])
  from public, anon, authenticated, service_role;
revoke all on function private.hash_access_token(text)
  from public, anon, authenticated, service_role;

create table private.driver_assignment_invitations (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  assignment_id uuid not null references public.booking_assignments (id) on delete restrict,
  booking_id uuid not null references public.bookings (id) on delete restrict,
  driver_user_id uuid not null references public.profiles (id) on delete restrict,
  token_hash bytea not null unique,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  expires_at timestamptz not null,
  first_viewed_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete restrict,
  consumed_at timestamptz,
  consumed_by uuid references public.profiles (id) on delete restrict,
  constraint driver_invitation_token_hash_length
    check (pg_catalog.octet_length(token_hash) = 32),
  constraint driver_invitation_expiry check (expires_at > created_at),
  constraint driver_invitation_revocation_state
    check ((revoked_at is null) = (revoked_by is null)),
  constraint driver_invitation_consumption_state
    check ((consumed_at is null) = (consumed_by is null)),
  constraint driver_invitation_consumed_by_driver
    check (consumed_by is null or consumed_by = driver_user_id)
);

create unique index driver_invitations_one_active_per_assignment
  on private.driver_assignment_invitations (assignment_id)
  where revoked_at is null and consumed_at is null;
create index driver_invitations_booking_idx
  on private.driver_assignment_invitations (booking_id, created_at desc);

alter table private.driver_assignment_invitations enable row level security;
revoke all on private.driver_assignment_invitations
  from public, anon, authenticated, service_role;

-- Guards: allow a guest-driver response only from the SECURITY DEFINER guest
-- functions below, which set a transaction-local marker naming the exact row.
create or replace function private.guard_booking_assignment_update()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_actor_id uuid := (select auth.uid());
  v_actor_authorized boolean;
begin
  if new.booking_id is distinct from old.booking_id
     or new.driver_user_id is distinct from old.driver_user_id
     or new.vehicle_id is distinct from old.vehicle_id
     or new.assigned_by is distinct from old.assigned_by
     or new.assigned_at is distinct from old.assigned_at
     or new.reserved_period is distinct from old.reserved_period
  then
    raise exception 'Assignment identity and reservation are immutable; create a new assignment to reassign';
  end if;

  if not (
    (old.assignment_status = 'offered'
      and new.assignment_status in ('accepted', 'declined', 'released'))
    or (old.assignment_status = 'accepted'
      and new.assignment_status in ('in_progress', 'released'))
    or (old.assignment_status = 'in_progress'
      and new.assignment_status in ('completed', 'released'))
  ) then
    raise exception 'Invalid assignment status transition';
  end if;

  if new.responded_at is distinct from old.responded_at
     and (old.responded_at is not null
       or new.assignment_status not in ('accepted', 'declined')
       or new.responded_at is null)
  then
    raise exception 'Driver response time may be set only once when accepting or declining';
  end if;

  if new.released_at is distinct from old.released_at
     and (old.released_at is not null
       or new.assignment_status <> 'released'
       or new.released_at is null)
  then
    raise exception 'Assignment release time may be set only once when releasing';
  end if;

  if new.assignment_status = 'released' then
    v_actor_authorized := private.has_active_role(
      v_actor_id, array['operator', 'admin', 'super_admin']
    );
  elsif old.assignment_status = 'offered'
        and new.assignment_status in ('accepted', 'declined')
        and pg_catalog.current_setting('app.guest_driver_assignment_id', true)
              is not distinct from old.id::text
  then
    v_actor_authorized := private.has_active_role(old.driver_user_id, array['driver']);
  else
    v_actor_authorized := v_actor_id is not null
      and v_actor_id = old.driver_user_id
      and private.has_active_role(v_actor_id, array['driver']);
  end if;

  if v_actor_authorized is distinct from true then
    raise exception 'Actor is not authorized to change this assignment status';
  end if;

  return new;
end;
$function$;

create or replace function private.guard_driver_hire_offer()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_assignment public.booking_assignments%rowtype;
  v_is_admin boolean;
  v_is_driver boolean;
begin
  select ba.* into v_assignment
    from public.booking_assignments as ba
   where ba.id = new.assignment_id;
  if not found
     or new.booking_id is distinct from v_assignment.booking_id
     or new.driver_user_id is distinct from v_assignment.driver_user_id
  then
    raise exception 'Driver hire offer must match its assignment';
  end if;

  v_is_admin := private.has_active_role(v_actor, array['admin', 'super_admin']);

  if tg_op = 'INSERT' then
    if not v_is_admin
       or new.created_by is distinct from v_actor
       or new.offer_status <> 'offered'
       or not new.is_current
       or new.responded_by is not null
       or new.responded_at is not null
    then
      raise exception 'Only an active Admin may create a current driver hire offer';
    end if;
  else
    if old.id is distinct from new.id
       or old.assignment_id is distinct from new.assignment_id
       or old.booking_id is distinct from new.booking_id
       or old.driver_user_id is distinct from new.driver_user_id
       or old.revision is distinct from new.revision
       or old.amount is distinct from new.amount
       or old.currency is distinct from new.currency
       or old.supersedes_offer_id is distinct from new.supersedes_offer_id
       or old.request_id is distinct from new.request_id
       or old.created_by is distinct from new.created_by
       or old.created_at is distinct from new.created_at
    then
      raise exception 'Driver hire offer terms are immutable';
    end if;

    if old.is_current and not new.is_current
       and old.superseded_at is null
       and new.superseded_at is not null
       and new.offer_status is not distinct from old.offer_status
       and new.responded_by is not distinct from old.responded_by
       and new.responded_at is not distinct from old.responded_at
       and v_is_admin
    then
      return new;
    end if;

    if old.is_current
       and new.is_current
       and old.offer_status = 'offered'
       and new.offer_status in ('accepted', 'declined')
       and new.responded_at is not null
    then
      if new.responded_by is not distinct from v_actor then
        v_is_driver := v_actor = old.driver_user_id
          and private.has_active_role(v_actor, array['driver']);
      elsif new.responded_by is not distinct from old.driver_user_id
            and pg_catalog.current_setting('app.guest_driver_offer_id', true)
                  is not distinct from old.id::text
      then
        v_is_driver := private.has_active_role(old.driver_user_id, array['driver']);
      end if;
      if v_is_driver is true then
        return new;
      end if;
    end if;

    raise exception 'Driver hire offer can only be superseded by Admin or answered by its driver';
  end if;
  return new;
end;
$function$;

revoke all on function private.guard_booking_assignment_update()
  from public, anon, authenticated, service_role;
revoke all on function private.guard_driver_hire_offer()
  from public, anon, authenticated, service_role;

-- Resolves a presented token to a currently valid invitation and locks it.
-- Failure is deliberately indistinguishable (no token, expiry, or state leak).
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
  then
    raise exception 'Driver invitation is unavailable';
  end if;
  return v_invitation;
end;
$function$;

revoke all on function private.lock_valid_driver_invitation(text)
  from public, anon, authenticated, service_role;

create or replace function public.admin_create_driver_invitation(
  p_assignment_id uuid,
  p_expires_in_hours integer default 72
)
returns table (invitation_id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_assignment public.booking_assignments%rowtype;
  v_booking_status text;
  v_token text;
  v_id uuid;
  v_rotated integer;
begin
  if not private.has_active_role(v_actor, array['admin', 'super_admin']) then
    raise exception 'An active Admin is required';
  end if;
  if p_assignment_id is null or p_expires_in_hours is null
     or p_expires_in_hours < 1 or p_expires_in_hours > 168 then
    raise exception 'Invitation details are invalid';
  end if;

  -- Lock order matches the guest functions (invitation, then assignment, then
  -- booking) so concurrent admin rotation and guest responses cannot deadlock.
  perform 1
    from private.driver_assignment_invitations as i
   where i.assignment_id = p_assignment_id
     and i.revoked_at is null
     and i.consumed_at is null
   for update;

  select ba.* into v_assignment
    from public.booking_assignments as ba
   where ba.id = p_assignment_id
   for update;
  if not found or v_assignment.assignment_status not in ('offered', 'accepted') then
    raise exception 'An open driver assignment is required';
  end if;

  select b.booking_status into v_booking_status
    from public.bookings as b
   where b.id = v_assignment.booking_id
   for update;
  if v_booking_status in ('cancelled', 'rejected', 'completed') then
    raise exception 'An open driver assignment is required';
  end if;
  if not private.has_active_role(v_assignment.driver_user_id, array['driver']) then
    raise exception 'The assigned driver account is not active';
  end if;

  update private.driver_assignment_invitations
     set revoked_at = v_now, revoked_by = v_actor
   where assignment_id = p_assignment_id
     and revoked_at is null
     and consumed_at is null;
  get diagnostics v_rotated = row_count;

  v_token := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
  insert into private.driver_assignment_invitations (
    assignment_id, booking_id, driver_user_id, token_hash, created_by, created_at, expires_at
  )
  values (
    p_assignment_id, v_assignment.booking_id, v_assignment.driver_user_id,
    private.hash_access_token(v_token), v_actor, v_now,
    v_now + pg_catalog.make_interval(hours => p_expires_in_hours)
  )
  returning id into v_id;

  insert into public.booking_events (booking_id, event_type, actor_user_id, details, created_at)
  values (
    v_assignment.booking_id, 'driver_invitation_issued', v_actor,
    pg_catalog.jsonb_build_object(
      'invitation_id', v_id,
      'assignment_id', p_assignment_id,
      'rotated_previous_invitation', v_rotated > 0
    ),
    v_now
  );

  return query select v_id, v_token, v_now + pg_catalog.make_interval(hours => p_expires_in_hours);
end;
$function$;

create or replace function public.admin_revoke_driver_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_invitation private.driver_assignment_invitations%rowtype;
begin
  if not private.has_active_role(v_actor, array['admin', 'super_admin']) then
    raise exception 'An active Admin is required';
  end if;

  select i.* into v_invitation
    from private.driver_assignment_invitations as i
   where i.id = p_invitation_id
   for update;
  if not found or v_invitation.revoked_at is not null or v_invitation.consumed_at is not null then
    raise exception 'This invitation is not active';
  end if;

  update private.driver_assignment_invitations
     set revoked_at = pg_catalog.clock_timestamp(), revoked_by = v_actor
   where id = p_invitation_id;

  insert into public.booking_events (booking_id, event_type, actor_user_id, details)
  values (
    v_invitation.booking_id, 'driver_invitation_revoked', v_actor,
    pg_catalog.jsonb_build_object(
      'invitation_id', v_invitation.id,
      'assignment_id', v_invitation.assignment_id
    )
  );
end;
$function$;

create or replace function public.admin_list_driver_invitations(p_booking_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if not private.has_active_role((select auth.uid()), array['admin', 'super_admin']) then
    raise exception 'An active Admin is required';
  end if;

  return coalesce((
    select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', i.id,
        'assignment_id', i.assignment_id,
        'driver_name', dp.full_name,
        'assignment_status', ba.assignment_status,
        'created_at', i.created_at,
        'expires_at', i.expires_at,
        'first_viewed_at', i.first_viewed_at,
        'revoked_at', i.revoked_at,
        'linked_at', i.consumed_at,
        'status', case
          when i.consumed_at is not null then 'linked'
          when i.revoked_at is not null then 'revoked'
          when i.expires_at <= pg_catalog.clock_timestamp() then 'expired'
          else 'active'
        end
      ) order by i.created_at desc
    )
      from private.driver_assignment_invitations as i
      join public.booking_assignments as ba on ba.id = i.assignment_id
      join public.profiles as dp on dp.id = i.driver_user_id
     where i.booking_id = p_booking_id
  ), '[]'::jsonb);
end;
$function$;

-- Token-authenticated trip view. The invitation is scoped to one assignment;
-- customer contact details appear only after the driver has accepted.
create or replace function public.get_guest_driver_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_invitation private.driver_assignment_invitations%rowtype;
  v_assignment public.booking_assignments%rowtype;
  v_accepted boolean;
  v_result jsonb;
begin
  v_invitation := private.lock_valid_driver_invitation(p_token);

  select ba.* into v_assignment
    from public.booking_assignments as ba
   where ba.id = v_invitation.assignment_id;
  if not found or v_assignment.assignment_status in ('released') then
    raise exception 'Driver invitation is unavailable';
  end if;
  v_accepted := v_assignment.assignment_status in ('accepted', 'in_progress', 'completed');

  update private.driver_assignment_invitations
     set first_viewed_at = coalesce(first_viewed_at, pg_catalog.clock_timestamp())
   where id = v_invitation.id;

  select pg_catalog.jsonb_build_object(
    'assignment', pg_catalog.jsonb_build_object(
      'id', v_assignment.id,
      'status', v_assignment.assignment_status,
      'assigned_at', v_assignment.assigned_at,
      'responded_at', v_assignment.responded_at
    ),
    'invitation', pg_catalog.jsonb_build_object(
      'expires_at', v_invitation.expires_at
    ),
    'booking', pg_catalog.jsonb_build_object(
      'booking_ref', b.booking_ref,
      'service_type', b.service_type,
      'journey_type', b.journey_type,
      'passenger_count', b.passenger_count,
      'luggage_count', b.luggage_count,
      'booking_status', b.booking_status,
      'customer_name', case when v_accepted then b.customer_name end,
      'customer_phone', case when v_accepted then b.customer_phone end
    ),
    'legs', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'sequence_no', bl.sequence_no,
          'pickup_location', bl.pickup_location,
          'dropoff_location', bl.dropoff_location,
          'pickup_at', bl.pickup_at,
          'planned_end_at', bl.planned_end_at,
          'flight_number', bl.flight_number,
          'trip_status', bl.trip_status
        ) order by bl.sequence_no
      )
        from public.booking_legs as bl
       where bl.booking_id = b.id
    ), '[]'::jsonb),
    'vehicle', pg_catalog.jsonb_build_object(
      'name', v.display_name,
      'registration_number', v.registration_number
    ),
    'hire_offer', (
      select pg_catalog.jsonb_build_object(
        'id', o.id,
        'amount', o.amount,
        'currency', o.currency,
        'status', o.offer_status,
        'created_at', o.created_at,
        'responded_at', o.responded_at
      )
        from public.driver_hire_offers as o
       where o.assignment_id = v_assignment.id
         and o.is_current
    )
  )
    into v_result
    from public.bookings as b
    join public.vehicles as v on v.id = v_assignment.vehicle_id
   where b.id = v_assignment.booking_id
     and b.id = v_invitation.booking_id;

  return v_result;
end;
$function$;

create or replace function public.guest_driver_respond_assignment(
  p_token text,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_invitation private.driver_assignment_invitations%rowtype;
  v_assignment public.booking_assignments%rowtype;
  v_booking_status text;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_action is null or p_action not in ('accept', 'decline') then
    raise exception 'Driver invitation is unavailable';
  end if;
  v_invitation := private.lock_valid_driver_invitation(p_token);

  select ba.* into v_assignment
    from public.booking_assignments as ba
   where ba.id = v_invitation.assignment_id
   for update;
  select b.booking_status into v_booking_status
    from public.bookings as b
   where b.id = v_invitation.booking_id
   for update;
  if not found
     or v_assignment.assignment_status <> 'offered'
     or v_booking_status in ('cancelled', 'rejected', 'completed')
  then
    raise exception 'Driver invitation is unavailable';
  end if;

  perform pg_catalog.set_config(
    'app.guest_driver_assignment_id', v_assignment.id::text, true
  );
  update public.booking_assignments
     set assignment_status = case p_action when 'accept' then 'accepted' else 'declined' end,
         responded_at = v_now
   where id = v_assignment.id;
  perform pg_catalog.set_config('app.guest_driver_assignment_id', '', true);

  if p_action = 'decline' then
    update public.bookings set booking_status = 'confirmed'
     where id = v_assignment.booking_id and booking_status = 'assigned';
  end if;

  insert into public.booking_events (booking_id, event_type, actor_user_id, details, created_at)
  values (
    v_assignment.booking_id, 'guest_driver_assignment_response', null,
    pg_catalog.jsonb_build_object(
      'invitation_id', v_invitation.id,
      'assignment_id', v_assignment.id,
      'action', p_action
    ),
    v_now
  );
end;
$function$;

create or replace function public.guest_driver_respond_hire_offer(
  p_token text,
  p_offer_id uuid,
  p_accept boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_invitation private.driver_assignment_invitations%rowtype;
  v_offer public.driver_hire_offers%rowtype;
  v_updated integer;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_offer_id is null or p_accept is null then
    raise exception 'Driver invitation is unavailable';
  end if;
  v_invitation := private.lock_valid_driver_invitation(p_token);

  select o.* into v_offer
    from public.driver_hire_offers as o
    join public.booking_assignments as ba on ba.id = o.assignment_id
    join public.bookings as b on b.id = ba.booking_id and b.booking_status <> 'cancelled'
   where o.id = p_offer_id
     and o.assignment_id = v_invitation.assignment_id
     and o.driver_user_id = v_invitation.driver_user_id
     and o.is_current
     and ba.assignment_status not in ('declined', 'released')
   for update of o;
  if not found or v_offer.offer_status <> 'offered' then
    raise exception 'This driver hire offer is no longer available';
  end if;

  perform pg_catalog.set_config('app.guest_driver_offer_id', v_offer.id::text, true);
  update public.driver_hire_offers
     set offer_status = case when p_accept then 'accepted' else 'declined' end,
         responded_by = v_offer.driver_user_id,
         responded_at = v_now
   where id = v_offer.id and is_current and offer_status = 'offered';
  get diagnostics v_updated = row_count;
  perform pg_catalog.set_config('app.guest_driver_offer_id', '', true);
  if v_updated <> 1 then
    raise exception 'This driver hire offer has already been answered';
  end if;
end;
$function$;

-- Authenticated linking: the signed-in account must itself be the driver the
-- invitation was issued to. A different account can never claim the assignment.
create or replace function public.claim_driver_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_invitation private.driver_assignment_invitations%rowtype;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if not private.has_active_role(v_actor, array['driver']) then
    raise exception 'An active driver account is required';
  end if;
  v_invitation := private.lock_valid_driver_invitation(p_token);
  if v_invitation.driver_user_id is distinct from v_actor then
    raise exception 'Driver invitation is unavailable';
  end if;

  update private.driver_assignment_invitations
     set consumed_at = v_now, consumed_by = v_actor
   where id = v_invitation.id;

  insert into public.booking_events (booking_id, event_type, actor_user_id, details, created_at)
  values (
    v_invitation.booking_id, 'driver_invitation_linked', v_actor,
    pg_catalog.jsonb_build_object(
      'invitation_id', v_invitation.id,
      'assignment_id', v_invitation.assignment_id
    ),
    v_now
  );
  return v_invitation.assignment_id;
end;
$function$;

revoke all on function public.admin_create_driver_invitation(uuid, integer),
  public.admin_revoke_driver_invitation(uuid),
  public.admin_list_driver_invitations(uuid),
  public.get_guest_driver_invitation(text),
  public.guest_driver_respond_assignment(text, text),
  public.guest_driver_respond_hire_offer(text, uuid, boolean),
  public.claim_driver_invitation(text)
  from public, anon, authenticated, service_role;

grant execute on function public.admin_create_driver_invitation(uuid, integer),
  public.admin_revoke_driver_invitation(uuid),
  public.admin_list_driver_invitations(uuid),
  public.claim_driver_invitation(text)
  to authenticated;
-- Guest operations are executed by server routes (service role) so that every
-- call can be rate limited by hashed token and client IP before it reaches SQL.
grant execute on function public.get_guest_driver_invitation(text),
  public.guest_driver_respond_assignment(text, text),
  public.guest_driver_respond_hire_offer(text, uuid, boolean)
  to service_role;

comment on table private.driver_assignment_invitations is
  'Hashed, expiring, revocable, one-time-linkable guest invitations scoped to one driver assignment.';
