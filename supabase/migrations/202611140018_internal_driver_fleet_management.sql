-- Internal driver & vehicle fleet management without requiring driver auth logins or passwords.

alter table public.profiles
  add column if not exists license_number text,
  add column if not exists driver_notes text,
  add column if not exists default_vehicle_id uuid references public.vehicles (id) on delete set null;

create or replace function public.save_driver(
  p_driver_id uuid,
  p_full_name text,
  p_phone text,
  p_license_number text,
  p_driver_notes text,
  p_account_status text,
  p_default_vehicle_id uuid default null,
  p_new_vehicle_category_id uuid default null,
  p_new_vehicle_name text default null,
  p_new_vehicle_registration text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_driver_id uuid := p_driver_id;
  v_vehicle_id uuid := p_default_vehicle_id;
  v_driver_role_id smallint;
  v_clean_name text := pg_catalog.btrim(coalesce(p_full_name, ''));
  v_clean_phone text := pg_catalog.btrim(coalesce(p_phone, ''));
  v_clean_license text := nullif(pg_catalog.btrim(coalesce(p_license_number, '')), '');
  v_clean_notes text := nullif(pg_catalog.btrim(coalesce(p_driver_notes, '')), '');
  v_status text := coalesce(nullif(pg_catalog.btrim(coalesce(p_account_status, '')), ''), 'active');
  v_new_veh_name text := nullif(pg_catalog.btrim(coalesce(p_new_vehicle_name, '')), '');
  v_new_veh_reg text := nullif(pg_catalog.btrim(coalesce(p_new_vehicle_registration, '')), '');
begin
  if not private.has_active_role(v_actor, array['admin', 'super_admin']) then
    raise exception 'An active Admin is required';
  end if;

  if pg_catalog.char_length(v_clean_name) not between 2 and 120 then
    raise exception 'Driver full name must be between 2 and 120 characters';
  end if;

  if pg_catalog.char_length(v_clean_phone) not between 7 and 30
     or v_clean_phone !~ '^\+?[0-9[:space:]()-]+$'
  then
    raise exception 'Enter a valid driver phone or WhatsApp number';
  end if;

  if v_status not in ('active', 'inactive') then
    raise exception 'Driver status must be active or inactive';
  end if;

  if v_clean_license is not null and pg_catalog.char_length(v_clean_license) > 80 then
    raise exception 'License number must be at most 80 characters';
  end if;

  if v_clean_notes is not null and pg_catalog.char_length(v_clean_notes) > 500 then
    raise exception 'Driver notes must be at most 500 characters';
  end if;

  if v_new_veh_name is not null then
    if pg_catalog.char_length(v_new_veh_name) not between 2 and 120 then
      raise exception 'Vehicle display name must be between 2 and 120 characters';
    end if;
    if p_new_vehicle_category_id is null
       or not exists (select 1 from public.vehicle_categories as vc where vc.id = p_new_vehicle_category_id)
    then
      raise exception 'Select a valid vehicle category for the new vehicle';
    end if;
    insert into public.vehicles as v (
      category_id, display_name, registration_number, operational_status
    )
    values (
      p_new_vehicle_category_id,
      v_new_veh_name,
      v_new_veh_reg,
      'active'
    )
    returning v.id into v_vehicle_id;
  elsif v_vehicle_id is not null then
    if not exists (select 1 from public.vehicles as v where v.id = v_vehicle_id) then
      raise exception 'Selected vehicle is unavailable';
    end if;
  end if;

  select r.id
    into v_driver_role_id
    from public.roles as r
   where r.code = 'driver';
  if v_driver_role_id is null then
    raise exception 'The driver role is not configured';
  end if;

  if v_driver_id is null then
    v_driver_id := pg_catalog.gen_random_uuid();

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      is_sso_user,
      is_anonymous
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      v_driver_id,
      'authenticated',
      'authenticated',
      'driver-' || pg_catalog.replace(v_driver_id::text, '-', '') || '@internal.chamatravels.local',
      '',
      pg_catalog.now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      pg_catalog.jsonb_build_object(
        'full_name', v_clean_name,
        'phone', v_clean_phone
      ),
      pg_catalog.now(),
      pg_catalog.now(),
      false,
      false
    );

    insert into public.profiles (
      id, full_name, phone, account_status, license_number, driver_notes, default_vehicle_id
    )
    values (
      v_driver_id,
      v_clean_name,
      v_clean_phone,
      v_status,
      v_clean_license,
      v_clean_notes,
      v_vehicle_id
    )
    on conflict (id) do update
      set full_name = excluded.full_name,
          phone = excluded.phone,
          account_status = excluded.account_status,
          license_number = excluded.license_number,
          driver_notes = excluded.driver_notes,
          default_vehicle_id = excluded.default_vehicle_id,
          updated_at = pg_catalog.now();
  else
    update public.profiles
       set full_name = v_clean_name,
           phone = v_clean_phone,
           account_status = v_status,
           license_number = v_clean_license,
           driver_notes = v_clean_notes,
           default_vehicle_id = v_vehicle_id,
           updated_at = pg_catalog.now()
     where id = v_driver_id;
    if not found then
      raise exception 'Driver record is unavailable';
    end if;
  end if;

  if not exists (
    select 1
      from public.user_roles as ur
     where ur.user_id = v_driver_id
       and ur.role_id = v_driver_role_id
       and ur.revoked_at is null
  ) then
    insert into public.user_roles (user_id, role_id, assigned_by)
    values (v_driver_id, v_driver_role_id, v_actor);
  end if;

  return pg_catalog.jsonb_build_object(
    'driver_id', v_driver_id,
    'vehicle_id', v_vehicle_id
  );
end;
$function$;

create or replace function public.list_fleet_resources()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
begin
  if not private.has_active_role((select auth.uid()), array['admin', 'super_admin']) then
    raise exception 'An active Admin is required';
  end if;

  select pg_catalog.jsonb_build_object(
    'categories', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', vc.id,
          'code', vc.code,
          'display_name', vc.display_name,
          'max_passengers', vc.max_passengers,
          'max_luggage', vc.max_luggage,
          'is_active', vc.is_active
        ) order by vc.display_name
      )
      from public.vehicle_categories as vc
    ), '[]'::jsonb),
    'vehicles', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', v.id,
          'category_id', v.category_id,
          'category_name', vc.display_name,
          'max_passengers', vc.max_passengers,
          'max_luggage', vc.max_luggage,
          'display_name', v.display_name,
          'registration_number', v.registration_number,
          'operational_status', v.operational_status,
          'is_currently_assigned', exists (
            select 1
              from public.booking_assignments as ba
              join public.bookings as b on b.id = ba.booking_id
             where ba.vehicle_id = v.id
               and ba.assignment_status in ('offered', 'accepted', 'in_progress')
               and b.booking_status in ('assigned', 'in_progress')
          ),
          'active_booking_ref', (
            select b.booking_ref
              from public.booking_assignments as ba
              join public.bookings as b on b.id = ba.booking_id
             where ba.vehicle_id = v.id
               and ba.assignment_status in ('offered', 'accepted', 'in_progress')
               and b.booking_status in ('assigned', 'in_progress')
             order by ba.assigned_at desc
             limit 1
          )
        ) order by v.display_name
      )
      from public.vehicles as v
      join public.vehicle_categories as vc on vc.id = v.category_id
    ), '[]'::jsonb),
    'drivers', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', p.id,
          'full_name', p.full_name,
          'phone', p.phone,
          'license_number', p.license_number,
          'driver_notes', p.driver_notes,
          'account_status', p.account_status,
          'default_vehicle_id', p.default_vehicle_id,
          'default_vehicle_name', dv.display_name,
          'default_vehicle_registration', dv.registration_number,
          'default_vehicle_category', dvc.display_name,
          'is_currently_assigned', exists (
            select 1
              from public.booking_assignments as ba
              join public.bookings as b on b.id = ba.booking_id
             where ba.driver_user_id = p.id
               and ba.assignment_status in ('offered', 'accepted', 'in_progress')
               and b.booking_status in ('assigned', 'in_progress')
          ),
          'active_booking_ref', (
            select b.booking_ref
              from public.booking_assignments as ba
              join public.bookings as b on b.id = ba.booking_id
             where ba.driver_user_id = p.id
               and ba.assignment_status in ('offered', 'accepted', 'in_progress')
               and b.booking_status in ('assigned', 'in_progress')
             order by ba.assigned_at desc
             limit 1
          )
        ) order by p.full_name
      )
      from public.profiles as p
      join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
      join public.roles as r on r.id = ur.role_id and r.code = 'driver'
      left join public.vehicles as dv on dv.id = p.default_vehicle_id
      left join public.vehicle_categories as dvc on dvc.id = dv.category_id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$function$;

create or replace function public.list_dispatch_resources()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
begin
  if not private.has_active_role((select auth.uid()), array['admin', 'super_admin']) then
    raise exception 'An active Admin is required';
  end if;

  select pg_catalog.jsonb_build_object(
    'drivers', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', p.id,
          'full_name', p.full_name,
          'phone', p.phone,
          'license_number', p.license_number,
          'driver_notes', p.driver_notes,
          'default_vehicle_id', p.default_vehicle_id,
          'default_vehicle_name', dv.display_name,
          'default_vehicle_registration', dv.registration_number
        ) order by p.full_name
      )
        from public.profiles as p
        join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
        join public.roles as r on r.id = ur.role_id and r.code = 'driver'
        left join public.vehicles as dv on dv.id = p.default_vehicle_id
       where p.account_status = 'active'
    ), '[]'::jsonb),
    'vehicles', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', v.id,
          'display_name', v.display_name,
          'registration_number', v.registration_number,
          'category_id', v.category_id,
          'category_name', vc.display_name,
          'max_passengers', vc.max_passengers,
          'max_luggage', vc.max_luggage,
          'operational_status', v.operational_status
        ) order by v.display_name
      )
        from public.vehicles as v
        join public.vehicle_categories as vc on vc.id = v.category_id
       where v.operational_status = 'active'
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$function$;

create or replace function private.validate_booking_assignment()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_booking_status text;
  v_passengers smallint;
  v_luggage smallint;
  v_driver_active boolean;
  v_driver_role boolean;
  v_vehicle_active boolean;
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
    b.luggage_count
    into
    v_booking_status,
    v_passengers,
    v_luggage
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
    vc.is_active,
    vc.max_passengers,
    vc.max_luggage
    into
    v_vehicle_active,
    v_category_active,
    v_max_passengers,
    v_max_luggage
    from public.vehicles as v
    join public.vehicle_categories as vc on vc.id = v.category_id
   where v.id = new.vehicle_id;

  if v_vehicle_active is distinct from true or v_category_active is distinct from true then
    raise exception 'Assignment requires an active vehicle and category';
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

create or replace function public.create_booking_assignment(
  p_booking_id uuid,
  p_driver_user_id uuid,
  p_vehicle_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_start timestamptz;
  v_end timestamptz;
  v_missing_end boolean;
  v_assignment_id uuid;
  v_existing record;
begin
  if not private.has_active_role(v_actor, array['operator', 'admin', 'super_admin']) then
    raise exception 'An active Operator or Admin is required';
  end if;

  perform 1 from public.bookings as b
   where b.id = p_booking_id and b.booking_status in ('confirmed', 'assigned')
   for update;
  if not found then
    raise exception 'Only confirmed bookings can be assigned';
  end if;

  update public.booking_legs
     set planned_end_at = pickup_at + interval '4 hours'
   where booking_id = p_booking_id
     and planned_end_at is null;

  for v_existing in
    select id
      from public.booking_assignments
     where booking_id = p_booking_id
       and assignment_status in ('offered', 'accepted')
     for update
  loop
    update public.booking_assignments
       set assignment_status = 'released',
           released_at = pg_catalog.now(),
           release_reason = 'Reassigned by Admin'
     where id = v_existing.id;
  end loop;

  select pg_catalog.min(bl.pickup_at), pg_catalog.max(bl.planned_end_at),
         pg_catalog.bool_or(bl.planned_end_at is null)
    into v_start, v_end, v_missing_end
    from public.booking_legs as bl
   where bl.booking_id = p_booking_id;
  if v_start is null or v_end is null or v_missing_end then
    raise exception 'Enter the expected end time for every booking leg before assignment';
  end if;
  if not pg_catalog.isfinite(v_start) or not pg_catalog.isfinite(v_end) then
    raise exception 'Every booking leg must have finite pickup and expected end times before assignment';
  end if;

  insert into public.booking_assignments (
    booking_id, driver_user_id, vehicle_id, assigned_by, reserved_period
  )
  values (
    p_booking_id, p_driver_user_id, p_vehicle_id, v_actor,
    pg_catalog.tstzrange(v_start, v_end, '[)')
  )
  returning id into v_assignment_id;

  update public.bookings
     set booking_status = 'assigned'
   where id = p_booking_id;
  return v_assignment_id;
end;
$function$;

revoke all on function private.validate_booking_assignment()
  from public, anon, authenticated, service_role;

revoke all on function public.save_driver(
  uuid, text, text, text, text, text, uuid, uuid, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.save_driver(
  uuid, text, text, text, text, text, uuid, uuid, text, text
) to authenticated;

revoke all on function public.list_fleet_resources()
  from public, anon, authenticated, service_role;
grant execute on function public.list_fleet_resources()
  to authenticated;

revoke all on function public.list_dispatch_resources()
  from public, anon, authenticated, service_role;
grant execute on function public.list_dispatch_resources()
  to authenticated;

revoke all on function public.create_booking_assignment(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.create_booking_assignment(uuid, uuid, uuid)
  to authenticated;
