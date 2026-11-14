-- Catalog-level security assertions for migrations 202611140001-005.
-- NOT EXECUTED in the authoring environment (no PostgreSQL available).
-- Run only against a disposable database after applying all migrations:
--   psql "$DISPOSABLE_DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/sql/catalog_security.sql
do $test$
declare
  r record;
  v_fn text;
  v_summary_oid oid := 'public.admin_get_booking_payment_summary(uuid)'::regprocedure;
  v_summary_src text;
begin
  for r in
    select c.oid::regclass::text as name, c.relrowsecurity
      from pg_class c
     where c.oid in (
       'public.booking_documents'::regclass, 'public.invoices'::regclass,
       'private.driver_assignment_invitations'::regclass, 'private.rate_limit_buckets'::regclass,
       'private.booking_submission_tokens'::regclass
     )
  loop
    if not r.relrowsecurity then raise exception 'RLS disabled on %', r.name; end if;
  end loop;

  for r in
    select t, p from unnest(array[
      'public.booking_documents', 'public.invoices',
      'private.driver_assignment_invitations', 'private.rate_limit_buckets', 'private.booking_submission_tokens'
    ]) as t, unnest(array['anon', 'authenticated']) as p
  loop
    if has_table_privilege(r.p, r.t, 'select,insert,update,delete') then
      raise exception '% has table privileges on %', r.p, r.t;
    end if;
  end loop;

  foreach v_fn in array array[
    'public.get_guest_driver_invitation(text)',
    'public.guest_driver_respond_assignment(text,text)',
    'public.guest_driver_respond_hire_offer(text,uuid,boolean)',
    'public.guest_customer_list_documents(text)',
    'public.guest_customer_authorize_document(text,uuid)',
    'public.guest_driver_list_documents(text)',
    'public.guest_driver_authorize_document(text,uuid)',
    'public.check_rate_limit(bytea,integer,integer)',
    'public.accept_guest_quote(uuid,text)',
    'public.get_guest_booking_tracker(text)',
    'public.issue_guest_booking_tracker_token(uuid,text)',
    'public.service_claim_guest_booking_access(text,uuid)',
    'public.service_claim_driver_invitation(text,uuid)',
    'public.issue_booking_submission_token(uuid,jsonb)'
  ] loop
    if has_function_privilege('anon', v_fn, 'execute') or has_function_privilege('authenticated', v_fn, 'execute') then
      raise exception '% is executable by a client role', v_fn;
    end if;
    if not has_function_privilege('service_role', v_fn, 'execute') then
      raise exception '% is not executable by service_role', v_fn;
    end if;
  end loop;

  foreach v_fn in array array[
    'public.claim_guest_booking_access(text)',
    'public.claim_driver_invitation(text)',
    'public.create_booking(text,text,text,text,text,text,smallint,smallint,text,character,text,jsonb)'
  ] loop
    if has_function_privilege('anon', v_fn, 'execute')
       or has_function_privilege('authenticated', v_fn, 'execute')
       or has_function_privilege('service_role', v_fn, 'execute') then
      raise exception 'Legacy direct claim RPC % remains executable', v_fn;
    end if;
  end loop;

  v_fn := 'public.service_create_booking(text,text,text,text,text,text,smallint,smallint,text,text,text,jsonb,text)';
  if not has_function_privilege('anon', v_fn, 'execute')
     or not has_function_privilege('authenticated', v_fn, 'execute')
     or has_function_privilege('service_role', v_fn, 'execute') then
    raise exception 'Protected booking execution grants are incorrect';
  end if;
  if pg_catalog.to_regprocedure(
    'public.service_create_booking(text,text,text,text,text,text,smallint,smallint,text,character,text,jsonb,uuid)'
  ) is not null then
    raise exception 'Unsafe service booking overload still exists';
  end if;
  if exists (
    select 1 from pg_catalog.pg_proc as p
    join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'service_create_booking'
      and p.oid <> v_fn::regprocedure
  ) then
    raise exception 'Unexpected service booking overload exists';
  end if;
  for r in
    select p.oid::regprocedure::text as sig, p.proname as name, p.prosecdef, p.proconfig, p.proowner
      from pg_catalog.pg_proc as p
     where p.oid in (
       'public.issue_booking_submission_token(uuid,jsonb)'::regprocedure,
       'public.service_create_booking(text,text,text,text,text,text,smallint,smallint,text,text,text,jsonb,text)'::regprocedure
     )
  loop
    if not r.prosecdef or not coalesce(r.proconfig, '{}') @> array['search_path=""'] then
      raise exception 'Booking function is not a pinned SECURITY DEFINER: %', r.sig;
    end if;
    if r.name = 'service_create_booking'
       and not pg_catalog.has_function_privilege(
         r.proowner,
         'public.create_booking(text,text,text,text,text,text,smallint,smallint,text,character,text,jsonb)'::regprocedure,
         'execute'
       ) then
      raise exception 'Booking wrapper owner cannot call legacy booking function';
    end if;
  end loop;

  select p.prosrc into v_summary_src
    from pg_proc as p
   where p.oid = v_summary_oid;

  if not (select p.prosecdef from pg_proc as p where p.oid = v_summary_oid) then
    raise exception 'Booking payment summary must be SECURITY DEFINER';
  end if;
  if not exists (
    select 1
      from pg_proc as p
     where p.oid = v_summary_oid
       and coalesce(p.proconfig, '{}') @> array['search_path=""']
  ) then
    raise exception 'Booking payment summary must pin an empty search_path';
  end if;
  if not has_function_privilege(
    'authenticated', v_summary_oid, 'execute'
  ) or has_function_privilege('anon', v_summary_oid, 'execute')
    or has_function_privilege('service_role', v_summary_oid, 'execute') then
    raise exception 'Booking payment summary execution grants are incorrect';
  end if;
  if pg_catalog.position('private.has_active_role' in v_summary_src) = 0
     or pg_catalog.position('p.booking_id = b.id' in v_summary_src) = 0
     or pg_catalog.position('limit 200' in pg_catalog.lower(v_summary_src)) > 0 then
    raise exception 'Booking payment summary is not authorized and booking-scoped';
  end if;
  if has_any_column_privilege('anon', 'public.payments', 'select') then
    raise exception 'Anonymous users have payment column access';
  end if;

  for r in
    select p.oid::regprocedure::text as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private') and p.prosecdef
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) as c where c in ('search_path=""', 'search_path='))
       and p.proname ~ '(invitation|document|invoice|receipt|rate_limit)'
  loop
    raise exception 'search_path not pinned on %', r.sig;
  end loop;

  if to_regclass('storage.buckets') is not null and exists (
    select 1 from storage.buckets where id = 'booking-documents' and public
  ) then
    raise exception 'booking-documents bucket is public';
  end if;
end;
$test$;

select 'catalog_security: all assertions passed' as result;
