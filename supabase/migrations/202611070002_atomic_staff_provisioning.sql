create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_customer_role_id smallint;
  v_requested_staff_role text;
  v_actor_user_id uuid;
  v_staff_role_id smallint;
begin
  v_requested_staff_role := nullif(new.raw_app_meta_data ->> 'chama_staff_role', '');
  v_actor_user_id := nullif(new.raw_app_meta_data ->> 'chama_staff_actor', '')::uuid;

  if v_requested_staff_role is not null or v_actor_user_id is not null then
    if v_requested_staff_role is null
       or v_requested_staff_role not in ('admin', 'operator')
       or v_actor_user_id is null
    then
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
        'New customer'
      ),
      nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'phone'), '')
    )
    on conflict (id) do nothing;

    select r.id
      into v_staff_role_id
      from public.roles as r
     where r.code = v_requested_staff_role;
    if v_staff_role_id is null then
      raise exception 'The requested staff role is not configured';
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
      pg_catalog.jsonb_build_object(
        'role', v_requested_staff_role,
        'created_at', pg_catalog.now()
      )
    );

    return new;
  end if;

  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(
      nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      'New customer'
    ),
    nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'phone'), '')
  )
  on conflict (id) do nothing;

  select r.id
    into v_customer_role_id
    from public.roles as r
   where r.code = 'customer';

  if v_customer_role_id is null then
    raise exception 'Customer role is not configured';
  end if;

  insert into public.user_roles (user_id, role_id)
  select new.id, v_customer_role_id
   where not exists (
     select 1
       from public.user_roles as ur
      where ur.user_id = new.id
        and ur.role_id = v_customer_role_id
        and ur.revoked_at is null
   )
  on conflict do nothing;

  return new;
end;
$function$;

revoke all on function public.handle_new_auth_user()
  from public, anon, authenticated, service_role;

comment on function public.handle_new_auth_user() is
  'Creates customer identities normally; server-created staff identities receive an active-Super-Admin-validated role and audit record in the same Auth user transaction.';
