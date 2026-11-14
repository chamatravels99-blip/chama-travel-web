-- Apply only after the protected route and both booking flows have been
-- verified on a disposable database and the updated application is deployed.
-- These checks cannot verify application deployment or end-to-end testing.
do $cutover$
declare
  v_legacy oid := pg_catalog.to_regprocedure(
    'public.create_booking(text,text,text,text,text,text,smallint,smallint,text,character,text,jsonb)'
  );
  v_wrapper oid := pg_catalog.to_regprocedure(
    'public.service_create_booking(text,text,text,text,text,text,smallint,smallint,text,text,text,jsonb,text)'
  );
  v_issuer oid := pg_catalog.to_regprocedure('public.issue_booking_submission_token(uuid,jsonb)');
  v_tokens oid := pg_catalog.to_regclass('private.booking_submission_tokens');
begin
  if v_legacy is null or v_wrapper is null or v_issuer is null or v_tokens is null then
    raise exception 'Booking cutover prerequisites are missing';
  end if;
  if not pg_catalog.has_function_privilege('anon', v_wrapper, 'execute')
     or not pg_catalog.has_function_privilege('authenticated', v_wrapper, 'execute')
     or pg_catalog.has_function_privilege('service_role', v_wrapper, 'execute')
     or pg_catalog.has_function_privilege('anon', v_issuer, 'execute')
     or pg_catalog.has_function_privilege('authenticated', v_issuer, 'execute')
     or not pg_catalog.has_function_privilege('service_role', v_issuer, 'execute')
     or pg_catalog.has_table_privilege('anon', v_tokens, 'select,insert,update,delete')
     or pg_catalog.has_table_privilege('authenticated', v_tokens, 'select,insert,update,delete')
     or pg_catalog.has_table_privilege('service_role', v_tokens, 'select,insert,update,delete')
     or not exists (
       select 1 from pg_catalog.pg_proc as p
        where p.oid = v_wrapper and p.prosecdef
          and coalesce(p.proconfig, '{}') @> array['search_path=""']
          and exists (
            select 1 from pg_catalog.pg_proc as legacy
            join pg_catalog.pg_class as tokens on tokens.oid = v_tokens
             where legacy.oid = v_legacy and legacy.proowner = p.proowner
               and tokens.relowner = p.proowner and tokens.relrowsecurity
          )
     )
     or not exists (
       select 1 from pg_catalog.pg_proc as p
        where p.oid = v_issuer and p.prosecdef
          and coalesce(p.proconfig, '{}') @> array['search_path=""']
          and exists (
            select 1 from pg_catalog.pg_class as tokens
             where tokens.oid = v_tokens and tokens.relowner = p.proowner
          )
     )
  then
    raise exception 'Booking cutover privileges or function security are invalid';
  end if;
  if exists (
    select 1 from pg_catalog.pg_proc as p
    join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_booking'
      and p.oid <> v_legacy
      and (pg_catalog.has_function_privilege('anon', p.oid, 'execute')
        or pg_catalog.has_function_privilege('authenticated', p.oid, 'execute')
        or pg_catalog.has_function_privilege('service_role', p.oid, 'execute'))
  ) then
    raise exception 'Another public booking overload remains executable';
  end if;
  if exists (
    select 1 from pg_catalog.pg_proc as p
    join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'service_create_booking'
      and p.oid <> v_wrapper
      and (pg_catalog.has_function_privilege('anon', p.oid, 'execute')
        or pg_catalog.has_function_privilege('authenticated', p.oid, 'execute')
        or pg_catalog.has_function_privilege('service_role', p.oid, 'execute'))
  ) then
    raise exception 'Another booking wrapper overload remains executable';
  end if;
end;
$cutover$;

revoke all on function public.create_booking(
  text, text, text, text, text, text, smallint, smallint, text, char, text, jsonb
) from public, anon, authenticated, service_role;
