create table public.booking_assignments (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete restrict,
  driver_user_id uuid not null references public.profiles (id) on delete restrict,
  vehicle_id uuid not null references public.vehicles (id) on delete restrict,
  assigned_by uuid not null references public.profiles (id) on delete restrict,
  assignment_status text not null default 'offered',
  assigned_at timestamptz not null default pg_catalog.now(),
  responded_at timestamptz,
  released_at timestamptz,
  release_reason text,
  reserved_period tstzrange not null,
  constraint booking_assignments_status_check
    check (
      assignment_status in (
        'offered', 'accepted', 'declined', 'in_progress',
        'completed', 'released'
      )
    ),
  constraint booking_assignments_reservation_nonempty
    check (not pg_catalog.isempty(reserved_period)),
  constraint booking_assignments_reservation_finite
    check (
      not pg_catalog.lower_inf(reserved_period)
      and not pg_catalog.upper_inf(reserved_period)
    ),
  constraint booking_assignments_reservation_positive
    check (pg_catalog.upper(reserved_period) > pg_catalog.lower(reserved_period)),
  constraint booking_assignments_reservation_half_open
    check (pg_catalog.lower_inc(reserved_period) and not pg_catalog.upper_inc(reserved_period)),
  constraint booking_assignments_release_consistency
    check (
      (assignment_status = 'released') = (released_at is not null)
  ),
  constraint booking_assignments_release_reason_check
    check (assignment_status = 'released' or release_reason is null),
  constraint booking_assignments_response_consistency
    check (
      assignment_status not in ('accepted', 'declined', 'in_progress', 'completed')
      or responded_at is not null
    )
);

create unique index booking_assignments_one_active_per_booking
  on public.booking_assignments (booking_id)
  where assignment_status in ('offered', 'accepted', 'in_progress');

alter table public.booking_assignments
  add constraint booking_assignments_driver_no_overlap
  exclude using gist (
    driver_user_id extensions.gist_uuid_ops with =,
    reserved_period with &&
  )
  where (assignment_status in ('offered', 'accepted', 'in_progress'));

alter table public.booking_assignments
  add constraint booking_assignments_vehicle_no_overlap
  exclude using gist (
    vehicle_id extensions.gist_uuid_ops with =,
    reserved_period with &&
  )
  where (assignment_status in ('offered', 'accepted', 'in_progress'));

create index booking_assignments_driver_status_idx
  on public.booking_assignments (driver_user_id, assignment_status, assigned_at desc);
create index booking_assignments_booking_idx
  on public.booking_assignments (booking_id);

create or replace function private.validate_booking_assignment()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_booking_status text;
  v_passengers smallint;
  v_luggage smallint;
  v_requested_category_id uuid;
  v_driver_active boolean;
  v_driver_role boolean;
  v_vehicle_active boolean;
  v_vehicle_category_id uuid;
  v_category_active boolean;
  v_max_passengers smallint;
  v_max_luggage smallint;
  v_actor_authorized boolean;
  v_leg_count bigint;
  v_missing_end_count bigint;
  v_expected_start timestamptz;
  v_expected_end timestamptz;
begin
  select
    b.booking_status,
    b.passenger_count,
    b.luggage_count,
    b.requested_category_id
    into
    v_booking_status,
    v_passengers,
    v_luggage,
    v_requested_category_id
    from public.bookings as b
   where b.id = new.booking_id;

  if v_booking_status not in ('confirmed', 'assigned') then
    raise exception 'Only confirmed bookings may be assigned';
  end if;

  select
    p.account_status = 'active',
    exists (
      select 1
        from public.user_roles as ur
        join public.roles as r on r.id = ur.role_id
       where ur.user_id = p.id
         and ur.revoked_at is null
         and r.code = 'driver'
    )
    into v_driver_active, v_driver_role
    from public.profiles as p
   where p.id = new.driver_user_id;

  if v_driver_active is distinct from true or v_driver_role is distinct from true then
    raise exception 'Assignment requires an active driver account';
  end if;

  select
    (p.account_status = 'active')
      and exists (
        select 1
          from public.user_roles as ur
          join public.roles as r on r.id = ur.role_id
         where ur.user_id = p.id
           and ur.revoked_at is null
           and r.code in ('operator', 'admin', 'super_admin')
      )
    into v_actor_authorized
    from public.profiles as p
   where p.id = new.assigned_by;

  if v_actor_authorized is distinct from true then
    raise exception 'Assignment requires an active Operator or Admin';
  end if;
  if new.assigned_by is distinct from (select auth.uid()) then
    raise exception 'Assignment actor must match the authenticated operator';
  end if;

  select
    v.operational_status = 'active',
    v.category_id,
    vc.is_active,
    vc.max_passengers,
    vc.max_luggage
    into
    v_vehicle_active,
    v_vehicle_category_id,
    v_category_active,
    v_max_passengers,
    v_max_luggage
    from public.vehicles as v
    join public.vehicle_categories as vc on vc.id = v.category_id
   where v.id = new.vehicle_id;

  if v_vehicle_active is distinct from true or v_category_active is distinct from true then
    raise exception 'Assignment requires an active vehicle and category';
  end if;

  if v_requested_category_id is not null
     and v_requested_category_id <> v_vehicle_category_id
  then
    raise exception 'Assigned vehicle does not match the requested category';
  end if;

  if v_passengers > v_max_passengers or v_luggage > v_max_luggage then
    raise exception 'Assigned vehicle capacity is insufficient';
  end if;

  select
    pg_catalog.count(*),
    pg_catalog.count(*) filter (where bl.planned_end_at is null),
    pg_catalog.min(bl.pickup_at),
    pg_catalog.max(bl.planned_end_at)
    into v_leg_count, v_missing_end_count, v_expected_start, v_expected_end
    from public.booking_legs as bl
   where bl.booking_id = new.booking_id;

  if v_leg_count = 0 or v_missing_end_count > 0 then
    raise exception 'All booking legs need planned end times before assignment';
  end if;

  if new.reserved_period <> pg_catalog.tstzrange(v_expected_start, v_expected_end, '[)') then
    raise exception 'Reservation period must match the booking leg schedule';
  end if;

  return new;
end;
$function$;

revoke all on function private.validate_booking_assignment()
  from public, anon, authenticated, service_role;

create trigger booking_assignments_validate
before insert on public.booking_assignments
for each row execute function private.validate_booking_assignment();

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
    select exists (
      select 1
        from public.profiles as p
        join public.user_roles as ur
          on ur.user_id = p.id
         and ur.revoked_at is null
        join public.roles as r on r.id = ur.role_id
       where p.id = v_actor_id
         and p.account_status = 'active'
         and r.code in ('operator', 'admin', 'super_admin')
    )
    into v_actor_authorized;
  else
    select exists (
      select 1
        from public.profiles as p
        join public.user_roles as ur
          on ur.user_id = p.id
         and ur.revoked_at is null
        join public.roles as r on r.id = ur.role_id
       where p.id = v_actor_id
         and p.id = old.driver_user_id
         and p.account_status = 'active'
         and r.code = 'driver'
    )
    into v_actor_authorized;
  end if;

  if v_actor_authorized is distinct from true then
    raise exception 'Actor is not authorized to change this assignment status';
  end if;

  return new;
end;
$function$;

revoke all on function private.guard_booking_assignment_update()
  from public, anon, authenticated, service_role;

create trigger booking_assignments_guard_update
before update on public.booking_assignments
for each row execute function private.guard_booking_assignment_update();

create or replace function private.record_assignment_event()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if tg_op = 'INSERT' then
    insert into public.booking_events (
      booking_id, event_type, actor_user_id, details
    )
    values (
      new.booking_id,
      'driver_assignment_created',
      (select auth.uid()),
      pg_catalog.jsonb_build_object(
        'assignment_id', new.id,
        'assignment_status', new.assignment_status
      )
    );
  elsif new.assignment_status is distinct from old.assignment_status then
    insert into public.booking_events (
      booking_id, event_type, actor_user_id, details
    )
    values (
      new.booking_id,
      'driver_assignment_status_changed',
      (select auth.uid()),
      pg_catalog.jsonb_build_object(
        'assignment_id', new.id,
        'from_status', old.assignment_status,
        'to_status', new.assignment_status
      )
    );
  end if;
  return null;
end;
$function$;

create or replace function private.assert_booking_assignment_state()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_booking_id uuid;
  v_booking_status text;
  v_active_count bigint;
  v_expected_assignment_count bigint;
begin
  if tg_table_name = 'bookings' then
    v_booking_id := coalesce(new.id, old.id);
  elsif tg_op = 'DELETE' then
    v_booking_id := old.booking_id;
  else
    v_booking_id := new.booking_id;
  end if;

  select b.booking_status
    into v_booking_status
    from public.bookings as b
   where b.id = v_booking_id;

  if not found then
    return null;
  end if;

  select
    count(*) filter (
      where ba.assignment_status in ('offered', 'accepted', 'in_progress')
    ),
    count(*) filter (
      where (v_booking_status = 'assigned'
             and ba.assignment_status in ('offered', 'accepted'))
         or (v_booking_status = 'in_progress'
             and ba.assignment_status = 'in_progress')
         or (v_booking_status = 'completed'
             and ba.assignment_status = 'completed')
    )
    into v_active_count, v_expected_assignment_count
    from public.booking_assignments as ba
   where ba.booking_id = v_booking_id;

  if v_booking_status in ('assigned', 'in_progress') then
    if v_active_count <> 1 or v_expected_assignment_count <> 1 then
      raise exception 'Assigned and in-progress bookings require one matching active assignment';
    end if;
  elsif v_booking_status = 'completed' then
    if v_active_count <> 0 or v_expected_assignment_count <> 1 then
      raise exception 'Completed bookings require one completed assignment and no active assignment';
    end if;
  elsif v_active_count <> 0 then
    raise exception 'Bookings outside assigned/in-progress status cannot have an active assignment';
  end if;

  return null;
end;
$function$;

revoke all on function private.record_assignment_event()
  from public, anon, authenticated, service_role;
revoke all on function private.assert_booking_assignment_state()
  from public, anon, authenticated, service_role;
create trigger booking_assignments_record_event
after insert or update on public.booking_assignments
for each row execute function private.record_assignment_event();
create constraint trigger bookings_assignment_state_consistency
after insert or update on public.bookings
deferrable initially deferred
for each row execute function private.assert_booking_assignment_state();
create constraint trigger booking_assignments_state_consistency
after insert or update on public.booking_assignments
deferrable initially deferred
for each row execute function private.assert_booking_assignment_state();

create or replace function private.is_assigned_driver(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
      from public.booking_assignments as ba
     where ba.booking_id = p_booking_id
       and ba.driver_user_id = (select auth.uid())
       and ba.assignment_status in ('offered', 'accepted', 'in_progress', 'completed')
       and private.is_active_user()
  );
$function$;

revoke all on function private.is_assigned_driver(uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.is_assigned_driver(uuid) to authenticated;

alter table public.booking_assignments enable row level security;

create policy booking_assignments_driver_read_own
  on public.booking_assignments for select to authenticated
  using (
    driver_user_id = (select auth.uid())
    and assignment_status in ('offered', 'accepted', 'in_progress', 'completed')
    and private.is_active_user()
  );

create policy bookings_driver_read_assigned
  on public.bookings for select to authenticated
  using (private.is_assigned_driver(id));

create policy booking_legs_driver_read_assigned
  on public.booking_legs for select to authenticated
  using (private.is_assigned_driver(booking_id));

create policy booking_events_driver_read_assigned
  on public.booking_events for select to authenticated
  using (private.is_assigned_driver(booking_id));

revoke all on public.booking_assignments from public, anon, authenticated, service_role;
grant select (
  id, booking_id, driver_user_id, vehicle_id, assignment_status, assigned_at,
  responded_at, released_at
) on public.booking_assignments to authenticated;

comment on table public.booking_assignments is
  'Historical booking dispatch assignments; exclusion constraints protect active driver and vehicle schedules.';
comment on column public.booking_assignments.reserved_period is
  'Server-derived reservation interval from earliest pickup through latest planned end; clients must not set it.';
comment on function private.is_assigned_driver(uuid) is
  'RLS helper returning only whether the current active driver has an assigned or completed trip.';
comment on function private.validate_booking_assignment() is
  'Checks assignment actor/driver/vehicle authorization, capacity, and server-derived booking reservation period.';
comment on function private.guard_booking_assignment_update() is
  'Prevents assignment identity mutation and invalid assignment status transitions.';
comment on function private.record_assignment_event() is
  'Appends a booking event for assignment creation and assignment status changes.';
comment on function private.assert_booking_assignment_state() is
  'Deferred consistency check tying booking lifecycle status to its single assignment state.';
