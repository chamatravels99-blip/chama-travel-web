create index if not exists profiles_account_status_created_at_idx
  on public.profiles (account_status, created_at desc);

create or replace function public.admin_list_users(
  p_actor_user_id uuid,
  p_search text,
  p_role_code text,
  p_account_status text,
  p_limit integer,
  p_offset integer
)
returns table (
  user_id uuid,
  email text,
  full_name text,
  phone text,
  account_status text,
  created_at timestamptz,
  roles text[],
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'Trusted server execution is required';
  end if;
  if not exists (
    select 1
      from public.profiles as actor
      join public.user_roles as ur on ur.user_id = actor.id and ur.revoked_at is null
      join public.roles as r on r.id = ur.role_id
     where actor.id = p_actor_user_id
       and actor.account_status = 'active'
       and r.code in ('admin', 'super_admin')
  ) then
    raise exception 'An active Admin is required';
  end if;
  if p_role_code is not null
     and p_role_code not in ('super_admin', 'admin', 'operator', 'driver', 'customer')
  then
    raise exception 'User role filter is invalid';
  end if;
  if p_account_status is not null
     and p_account_status not in ('active', 'inactive')
  then
    raise exception 'Account status filter is invalid';
  end if;
  if p_limit is null or p_limit not between 1 and 100
     or p_offset is null or p_offset < 0
  then
    raise exception 'User list pagination is invalid';
  end if;

  return query
  with candidates as (
    select
      p.id,
      u.email::text as auth_email,
      p.full_name,
      p.phone,
      p.account_status,
      p.created_at,
      coalesce(
        pg_catalog.array_agg(distinct r.code order by r.code)
          filter (where r.code is not null),
        array[]::text[]
      ) as active_roles
    from public.profiles as p
    join auth.users as u on u.id = p.id
    left join public.user_roles as ur
      on ur.user_id = p.id and ur.revoked_at is null
    left join public.roles as r on r.id = ur.role_id
    where (
        p_search is null
        or p_search = ''
        or pg_catalog.strpos(pg_catalog.lower(p.full_name), pg_catalog.lower(p_search)) > 0
        or pg_catalog.strpos(pg_catalog.lower(coalesce(p.phone, '')), pg_catalog.lower(p_search)) > 0
        or pg_catalog.strpos(pg_catalog.lower(coalesce(u.email, '')), pg_catalog.lower(p_search)) > 0
      )
      and (
        p_role_code is null
        or exists (
          select 1
            from public.user_roles as filter_ur
            join public.roles as filter_r on filter_r.id = filter_ur.role_id
           where filter_ur.user_id = p.id
             and filter_ur.revoked_at is null
             and filter_r.code = p_role_code
        )
      )
      and (p_account_status is null or p.account_status = p_account_status)
    group by p.id, u.email, p.full_name, p.phone, p.account_status, p.created_at
  ),
  page as (
    select candidates.*
      from candidates
     order by candidates.created_at desc, candidates.id
     limit p_limit
    offset p_offset
  )
  select
    page.id,
    page.auth_email,
    page.full_name,
    page.phone,
    page.account_status,
    page.created_at,
    page.active_roles,
    (select pg_catalog.count(*) from candidates)
  from page
  order by page.created_at desc, page.id;
end;
$function$;

create or replace function public.admin_change_user_role(
  p_user_id uuid,
  p_role_code text,
  p_actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_is_super_admin boolean;
  v_user_status text;
  v_previous_roles text[];
  v_role_id smallint;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'Trusted server execution is required';
  end if;
  if p_role_code is null
     or p_role_code not in ('admin', 'operator', 'driver', 'customer')
  then
    raise exception 'The requested role cannot be assigned';
  end if;
  select exists (
    select 1
      from public.profiles as actor
      join public.user_roles as ur on ur.user_id = actor.id and ur.revoked_at is null
      join public.roles as r on r.id = ur.role_id and r.code = 'super_admin'
     where actor.id = p_actor_user_id
       and actor.account_status = 'active'
  ) into v_actor_is_super_admin;
  if not v_actor_is_super_admin and not exists (
    select 1
      from public.profiles as actor
      join public.user_roles as ur on ur.user_id = actor.id and ur.revoked_at is null
      join public.roles as r on r.id = ur.role_id and r.code = 'admin'
     where actor.id = p_actor_user_id
       and actor.account_status = 'active'
  ) then
    raise exception 'An active Admin is required';
  end if;

  select p.account_status
    into v_user_status
    from public.profiles as p
   where p.id = p_user_id
   for update;
  if not found or v_user_status <> 'active' then
    raise exception 'An active target account is required';
  end if;

  select coalesce(
    pg_catalog.array_agg(r.code order by r.code),
    array[]::text[]
  )
    into v_previous_roles
    from public.user_roles as ur
    join public.roles as r on r.id = ur.role_id
   where ur.user_id = p_user_id
     and ur.revoked_at is null;

  if 'super_admin' = any(v_previous_roles) then
    raise exception 'Super Admin accounts cannot be modified';
  end if;
  if not v_actor_is_super_admin
     and (
       p_role_code in ('admin', 'operator')
       or 'admin' = any(v_previous_roles)
       or 'operator' = any(v_previous_roles)
     )
  then
    raise exception 'Only a Super Admin may change privileged staff roles';
  end if;
  if pg_catalog.cardinality(v_previous_roles) = 1
     and v_previous_roles[1] = p_role_code
  then
    return;
  end if;

  select r.id into v_role_id
    from public.roles as r
   where r.code = p_role_code;
  if v_role_id is null then
    raise exception 'The requested role is not configured';
  end if;

  update public.user_roles
     set revoked_at = pg_catalog.now()
   where user_id = p_user_id
     and revoked_at is null;
  insert into public.user_roles (user_id, role_id, assigned_by)
  values (p_user_id, v_role_id, p_actor_user_id);

  insert into private.privileged_audit_events (
    event_type, actor_user_id, target_user_id, details
  )
  values (
    'user_role_changed',
    p_actor_user_id,
    p_user_id,
    pg_catalog.jsonb_build_object(
      'previous_roles', v_previous_roles,
      'new_role', p_role_code,
      'changed_at', pg_catalog.now()
    )
  );
end;
$function$;

create or replace function public.admin_set_user_status(
  p_user_id uuid,
  p_account_status text,
  p_actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_is_super_admin boolean;
  v_previous_status text;
  v_target_roles text[];
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'Trusted server execution is required';
  end if;
  if p_account_status is null or p_account_status not in ('active', 'inactive') then
    raise exception 'Account status is invalid';
  end if;
  select exists (
    select 1
      from public.profiles as actor
      join public.user_roles as ur on ur.user_id = actor.id and ur.revoked_at is null
      join public.roles as r on r.id = ur.role_id and r.code = 'super_admin'
     where actor.id = p_actor_user_id
       and actor.account_status = 'active'
  ) into v_actor_is_super_admin;
  if not v_actor_is_super_admin and not exists (
    select 1
      from public.profiles as actor
      join public.user_roles as ur on ur.user_id = actor.id and ur.revoked_at is null
      join public.roles as r on r.id = ur.role_id and r.code = 'admin'
     where actor.id = p_actor_user_id
       and actor.account_status = 'active'
  ) then
    raise exception 'An active Admin is required';
  end if;
  if p_user_id = p_actor_user_id then
    raise exception 'You cannot change your own account status';
  end if;

  select p.account_status
    into v_previous_status
    from public.profiles as p
   where p.id = p_user_id
   for update;
  if not found then
    raise exception 'The target account is unavailable';
  end if;

  select coalesce(
    pg_catalog.array_agg(r.code order by r.code),
    array[]::text[]
  )
    into v_target_roles
    from public.user_roles as ur
    join public.roles as r on r.id = ur.role_id
   where ur.user_id = p_user_id
     and ur.revoked_at is null;

  if 'super_admin' = any(v_target_roles) then
    raise exception 'Super Admin accounts cannot be modified';
  end if;
  if not v_actor_is_super_admin
     and ('admin' = any(v_target_roles) or 'operator' = any(v_target_roles))
  then
    raise exception 'Only a Super Admin may change privileged staff accounts';
  end if;
  if v_previous_status = p_account_status then
    return;
  end if;

  update public.profiles
     set account_status = p_account_status
   where id = p_user_id;

  insert into private.privileged_audit_events (
    event_type, actor_user_id, target_user_id, details
  )
  values (
    'user_account_status_changed',
    p_actor_user_id,
    p_user_id,
    pg_catalog.jsonb_build_object(
      'previous_status', v_previous_status,
      'new_status', p_account_status,
      'changed_at', pg_catalog.now()
    )
  );
end;
$function$;

revoke all on function public.admin_list_users(uuid, text, text, text, integer, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_change_user_role(uuid, text, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_set_user_status(uuid, text, uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.admin_list_users(uuid, text, text, text, integer, integer)
  to service_role;
grant execute on function public.admin_change_user_role(uuid, text, uuid)
  to service_role;
grant execute on function public.admin_set_user_status(uuid, text, uuid)
  to service_role;

comment on function public.admin_list_users(uuid, text, text, text, integer, integer) is
  'Service-role-only, paginated user directory; validates the active Admin actor before returning Auth email and profile/role data.';
comment on function public.admin_change_user_role(uuid, text, uuid) is
  'Atomically replaces a non-super-admin user role and audits the change; only a Super Admin can assign or revoke Admin/Operator roles.';
comment on function public.admin_set_user_status(uuid, text, uuid) is
  'Atomically activates or deactivates an account and audits the change without deleting historical records; Super Admin accounts are protected.';
