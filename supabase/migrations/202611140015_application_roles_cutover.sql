update public.user_roles as ur
   set revoked_at = pg_catalog.clock_timestamp()
  from public.roles as r
 where r.id = ur.role_id
   and r.code in ('operator', 'customer')
   and ur.revoked_at is null;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_requested_staff_role text;
  v_actor_user_id uuid;
  v_staff_role_id smallint;
begin
  v_requested_staff_role := nullif(new.raw_app_meta_data ->> 'chama_staff_role', '');
  v_actor_user_id := nullif(new.raw_app_meta_data ->> 'chama_staff_actor', '')::uuid;

  if v_requested_staff_role is not null or v_actor_user_id is not null then
    if v_requested_staff_role is distinct from 'admin' or v_actor_user_id is null then
      raise exception 'Staff provisioning metadata is invalid';
    end if;
    if not exists (
      select 1
        from public.profiles as actor
        join public.user_roles as ur on ur.user_id = actor.id and ur.revoked_at is null
        join public.roles as r on r.id = ur.role_id and r.code = 'super_admin'
       where actor.id = v_actor_user_id
         and actor.account_status = 'active'
    ) then
      raise exception 'An active Super Admin is required';
    end if;

    insert into public.profiles (id, full_name, phone)
    values (
      new.id,
      coalesce(
        nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'full_name'), ''),
        'New user'
      ),
      nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'phone'), '')
    )
    on conflict (id) do nothing;

    select r.id
      into v_staff_role_id
      from public.roles as r
     where r.code = 'admin';
    if v_staff_role_id is null then
      raise exception 'The Admin role is not configured';
    end if;

    insert into public.user_roles (user_id, role_id, assigned_by)
    values (new.id, v_staff_role_id, v_actor_user_id);

    insert into private.privileged_audit_events (
      event_type, actor_user_id, target_user_id, details
    )
    values (
      'staff_account_created',
      v_actor_user_id,
      new.id,
      pg_catalog.jsonb_build_object('role', 'admin', 'created_at', pg_catalog.now())
    );

    return new;
  end if;

  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(
      nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      'New user'
    ),
    nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'phone'), '')
  )
  on conflict (id) do nothing;

  return new;
end;
$function$;

revoke all on function public.handle_new_auth_user()
  from public, anon, authenticated, service_role;
grant execute on function public.handle_new_auth_user() to postgres;

comment on function public.handle_new_auth_user() is
  'Creates unprivileged profiles without application roles; only an active Super Admin can provision an Admin role through trusted Auth metadata.';

comment on table public.user_roles is
  'Historical role assignments are retained; only super_admin/admin are application access roles, while active driver assignments remain an internal dispatch eligibility marker.';
