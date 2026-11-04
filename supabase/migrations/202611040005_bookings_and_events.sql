create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_ref text not null unique,
  customer_user_id uuid references public.profiles (id) on delete set null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  service_type text not null,
  journey_type text not null,
  requested_category_id uuid references public.vehicle_categories (id) on delete restrict,
  passenger_count smallint not null,
  luggage_count smallint not null default 0,
  customer_notes text,
  booking_status text not null default 'pending',
  idempotency_key text,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint bookings_service_type_check
    check (service_type in ('airport_transfer', 'day_trip', 'round_tour', 'vehicle_hire', 'custom')),
  constraint bookings_journey_type_check
    check (journey_type in ('one_way', 'return', 'multi_leg')),
  constraint bookings_status_check
    check (
      booking_status in (
        'pending', 'reviewing', 'quoted', 'confirmed', 'assigned',
        'in_progress', 'completed', 'cancelled', 'rejected'
      )
    ),
  constraint bookings_passenger_count_positive check (passenger_count > 0),
  constraint bookings_luggage_count_nonnegative check (luggage_count >= 0)
);

create unique index bookings_idempotency_key_unique
  on public.bookings (idempotency_key)
  where idempotency_key is not null;
create index bookings_requested_category_idx
  on public.bookings (requested_category_id)
  where requested_category_id is not null;
create index bookings_customer_created_idx
  on public.bookings (customer_user_id, created_at desc);
create index bookings_status_created_idx
  on public.bookings (booking_status, created_at desc);

create trigger bookings_set_updated_at
before update on public.bookings
for each row execute function private.set_updated_at();

create or replace function private.guard_booking_status_transition()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.booking_status is not distinct from old.booking_status then
    return new;
  end if;

  if not (
    (old.booking_status = 'pending'
      and new.booking_status in ('reviewing', 'cancelled', 'rejected'))
    or (old.booking_status = 'reviewing'
      and new.booking_status in ('quoted', 'cancelled', 'rejected'))
    or (old.booking_status = 'quoted'
      and new.booking_status in ('reviewing', 'confirmed', 'cancelled', 'rejected'))
    or (old.booking_status = 'confirmed'
      and new.booking_status in ('assigned', 'cancelled'))
    or (old.booking_status = 'assigned'
      and new.booking_status in ('confirmed', 'in_progress', 'cancelled'))
    or (old.booking_status = 'in_progress'
      and new.booking_status in ('completed', 'cancelled'))
  ) then
    raise exception 'Invalid booking status transition';
  end if;

  return new;
end;
$function$;

revoke all on function private.guard_booking_status_transition()
  from public, anon, authenticated, service_role;

create trigger bookings_guard_status_transition
before update of booking_status on public.bookings
for each row execute function private.guard_booking_status_transition();

create or replace function private.validate_booking_category_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_category_active boolean;
  v_max_passengers smallint;
  v_max_luggage smallint;
begin
  if new.requested_category_id is null then
    return new;
  end if;

  select vc.is_active, vc.max_passengers, vc.max_luggage
    into v_category_active, v_max_passengers, v_max_luggage
    from public.vehicle_categories as vc
   where vc.id = new.requested_category_id;

  if v_category_active is distinct from true then
    raise exception 'Requested vehicle category is unavailable';
  end if;

  if new.passenger_count > v_max_passengers
     or new.luggage_count > v_max_luggage
  then
    raise exception 'Requested vehicle category capacity is insufficient';
  end if;

  return new;
end;
$function$;

revoke all on function private.validate_booking_category_capacity()
  from public, anon, authenticated, service_role;

create trigger bookings_validate_category_capacity
before insert or update of requested_category_id, passenger_count, luggage_count
on public.bookings
for each row execute function private.validate_booking_category_capacity();

create table public.booking_legs (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete restrict,
  sequence_no smallint not null,
  pickup_location text not null,
  dropoff_location text not null,
  pickup_at timestamptz not null,
  planned_end_at timestamptz,
  flight_number text,
  flight_arrival_at timestamptz,
  trip_notes text,
  trip_status text not null default 'not_started',
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint booking_legs_sequence_positive check (sequence_no > 0),
  constraint booking_legs_end_after_pickup_check
    check (planned_end_at is null or planned_end_at > pickup_at),
  constraint booking_legs_trip_status_check
    check (trip_status in ('not_started', 'in_progress', 'completed', 'no_show', 'cancelled')),
  constraint booking_legs_flight_time_requires_number
    check (flight_arrival_at is null or flight_number is not null),
  constraint booking_legs_booking_sequence_unique unique (booking_id, sequence_no)
);

create index booking_legs_pickup_idx on public.booking_legs (pickup_at);

create trigger booking_legs_set_updated_at
before update on public.booking_legs
for each row execute function private.set_updated_at();

create or replace function private.assert_booking_leg_shape()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_booking_id uuid;
  v_journey_type text;
  v_leg_count bigint;
  v_min_sequence smallint;
  v_max_sequence smallint;
  v_out_of_order boolean;
begin
  if tg_table_name = 'bookings' then
    v_booking_id := coalesce(new.id, old.id);
  elsif tg_op = 'DELETE' then
    v_booking_id := old.booking_id;
  else
    v_booking_id := new.booking_id;
  end if;

  select b.journey_type
    into v_journey_type
    from public.bookings as b
   where b.id = v_booking_id;

  if not found then
    return null;
  end if;

  select
    pg_catalog.count(*),
    coalesce(pg_catalog.min(bl.sequence_no), 0)::smallint,
    coalesce(pg_catalog.max(bl.sequence_no), 0)::smallint
    into v_leg_count, v_min_sequence, v_max_sequence
    from public.booking_legs as bl
   where bl.booking_id = v_booking_id;

  if v_journey_type = 'one_way' and v_leg_count <> 1 then
    raise exception 'One-way bookings must have exactly one leg';
  elsif v_journey_type = 'return' and v_leg_count <> 2 then
    raise exception 'Return bookings must have exactly two legs';
  elsif v_journey_type = 'multi_leg' and v_leg_count < 2 then
    raise exception 'Multi-leg bookings must have at least two legs';
  end if;

  if v_min_sequence <> 1 or v_max_sequence <> v_leg_count then
    raise exception 'Booking leg sequence numbers must be contiguous from one';
  end if;

  select exists (
    select 1
      from public.booking_legs as current_leg
      join public.booking_legs as previous_leg
        on previous_leg.booking_id = current_leg.booking_id
       and previous_leg.sequence_no = current_leg.sequence_no - 1
     where current_leg.booking_id = v_booking_id
       and previous_leg.planned_end_at is not null
       and current_leg.pickup_at < previous_leg.planned_end_at
  )
  into v_out_of_order;

  if v_out_of_order then
    raise exception 'Booking leg pickup times must follow the prior leg end time';
  end if;

  return null;
end;
$function$;

revoke all on function private.assert_booking_leg_shape()
  from public, anon, authenticated, service_role;

create constraint trigger bookings_leg_shape_consistency
after insert or update on public.bookings
deferrable initially deferred
for each row execute function private.assert_booking_leg_shape();
create constraint trigger booking_legs_shape_consistency
after insert or update or delete on public.booking_legs
deferrable initially deferred
for each row execute function private.assert_booking_leg_shape();

create table public.booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete restrict,
  event_type text not null,
  from_status text,
  to_status text,
  actor_user_id uuid references public.profiles (id) on delete set null,
  reason text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default pg_catalog.now()
);

create index booking_events_booking_created_idx
  on public.booking_events (booking_id, created_at);
create index booking_events_actor_created_idx
  on public.booking_events (actor_user_id, created_at);

create or replace function private.record_booking_status_event()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if tg_op = 'INSERT' then
    insert into public.booking_events (
      booking_id, event_type, from_status, to_status, actor_user_id
    )
    values (new.id, 'booking_created', null, new.booking_status, (select auth.uid()));
  elsif new.booking_status is distinct from old.booking_status then
    insert into public.booking_events (
      booking_id, event_type, from_status, to_status, actor_user_id
    )
    values (
      new.id,
      'booking_status_changed',
      old.booking_status,
      new.booking_status,
      (select auth.uid())
    );
  end if;
  return null;
end;
$function$;

revoke all on function private.record_booking_status_event()
  from public, anon, authenticated, service_role;

create trigger bookings_record_status_event
after insert or update of booking_status on public.bookings
for each row execute function private.record_booking_status_event();

create or replace function private.is_booking_owner(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
      from public.bookings as b
     where b.id = p_booking_id
       and b.customer_user_id = (select auth.uid())
        and private.is_active_user()
  );
$function$;

revoke all on function private.is_booking_owner(uuid)
  from public, anon, authenticated, service_role;
grant usage on schema private to authenticated;
grant execute on function private.is_booking_owner(uuid) to authenticated;

create or replace function private.reject_append_only_mutation()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  raise exception '% is append-only', tg_table_name;
end;
$function$;

revoke all on function private.reject_append_only_mutation()
  from public, anon, authenticated, service_role;

create trigger booking_events_append_only
before update or delete on public.booking_events
for each row execute function private.reject_append_only_mutation();

alter table public.bookings enable row level security;
alter table public.booking_legs enable row level security;
alter table public.booking_events enable row level security;

create policy bookings_customer_read_own
  on public.bookings for select to authenticated
  using (
    customer_user_id = (select auth.uid())
    and private.is_active_user()
  );
create policy booking_legs_customer_read_own
  on public.booking_legs for select to authenticated
  using (private.is_booking_owner(booking_id));
create policy booking_events_customer_read_own
  on public.booking_events for select to authenticated
  using (private.is_booking_owner(booking_id));
revoke all on public.bookings, public.booking_legs, public.booking_events
  from public, anon, authenticated, service_role;

grant select (
  id, booking_ref, customer_name, customer_phone, service_type, journey_type,
  requested_category_id, passenger_count, luggage_count, customer_notes,
  booking_status, created_at, updated_at
) on public.bookings to authenticated;
grant select (
  id, booking_id, sequence_no, pickup_location, dropoff_location, pickup_at,
  planned_end_at, flight_number, flight_arrival_at, trip_notes, trip_status,
  created_at, updated_at
) on public.booking_legs to authenticated;
grant select (
  id, booking_id, event_type, from_status, to_status, created_at
) on public.booking_events to authenticated;

comment on table public.bookings is
  'Guest and registered booking requests; guest ownership remains NULL permanently.';
comment on table public.booking_legs is
  'Ordered route legs; trip progress is separate from commercial booking status.';
comment on table public.booking_events is
  'Append-only booking lifecycle history; event rows cannot be updated or deleted.';
comment on column public.bookings.booking_ref is
  'Confirmation-only reference; it is not a credential and has no public lookup endpoint.';
comment on function private.is_booking_owner(uuid) is
  'RLS helper returning only whether the current active user owns a booking.';
comment on function private.assert_booking_leg_shape() is
  'Deferred check enforcing one leg for one-way, two for return, and at least two for multi-leg bookings.';
comment on function private.validate_booking_category_capacity() is
  'Rejects inactive categories and bookings that exceed requested passenger/luggage capacity.';
comment on function private.record_booking_status_event() is
  'Appends a booking event for creation and every booking status transition.';
comment on function private.guard_booking_status_transition() is
  'Rejects invalid lifecycle transitions; authorized operations are exposed only through guarded server functions.';
