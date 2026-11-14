-- Behavioural checks that need no booking fixtures. Run only against a
-- disposable database (see scripts/db-integration.mjs). UNVERIFIED: not yet
-- executed against a real PostgreSQL instance.
\set ON_ERROR_STOP on
begin;

-- Rate limiter: counts are exact and the limit flips exactly at p_limit.
do $$
declare
  v_key bytea := extensions.digest('integration-test-bucket', 'sha256');
  r record;
  i integer;
begin
  for i in 1..5 loop
    select * into r from public.check_rate_limit(v_key, 5, 3600);
    if not r.allowed then raise exception 'hit % should be allowed', i; end if;
  end loop;
  select * into r from public.check_rate_limit(v_key, 5, 3600);
  if r.allowed or r.remaining <> 0 or r.retry_after_seconds < 1 then
    raise exception 'hit 6 must be refused';
  end if;
  begin
    perform public.check_rate_limit('\x00'::bytea, 5, 60);
    raise exception 'short bucket hash must be rejected';
  exception when others then
    if sqlerrm = 'short bucket hash must be rejected' then raise; end if;
  end;
end $$;

-- Malformed / unknown tokens fail with the same generic message.
do $$
declare
  v_msgs text[] := '{}';
  v_tok text;
begin
  foreach v_tok in array array[null, 'short', repeat('g', 64), repeat('0', 64)] loop
    begin
      perform public.get_guest_driver_invitation(v_tok);
      v_msgs := v_msgs || 'ACCEPTED';
    exception when others then
      v_msgs := v_msgs || sqlerrm;
    end;
  end loop;
  if 'ACCEPTED' = any (v_msgs) then
    raise exception 'an invalid token was accepted';
  end if;
  if (select count(distinct m) from unnest(v_msgs) as m) <> 1 then
    raise exception 'token failures must be indistinguishable: %', v_msgs;
  end if;
end $$;

-- Hashing is case-insensitive and deterministic; raw token is never stored.
do $$
begin
  if private.hash_access_token(repeat('A', 64)) <> private.hash_access_token(repeat('a', 64)) then
    raise exception 'hash must normalise case';
  end if;
end $$;

-- Client roles cannot call the guest/service RPCs or touch private tables.
do $$
declare
  v_role text;
begin
  foreach v_role in array array['anon', 'authenticated'] loop
    if has_function_privilege(v_role, 'public.check_rate_limit(bytea,integer,integer)', 'execute')
       or has_function_privilege(v_role, 'public.get_guest_driver_invitation(text)', 'execute')
       or has_function_privilege(v_role, 'public.guest_customer_authorize_document(text,uuid)', 'execute')
       or has_function_privilege(v_role, 'public.accept_guest_quote(uuid,text)', 'execute')
       or has_table_privilege(v_role, 'private.rate_limit_buckets', 'select')
       or has_table_privilege(v_role, 'private.driver_assignment_invitations', 'select')
       or has_table_privilege(v_role, 'public.invoices', 'insert')
       or has_table_privilege(v_role, 'public.booking_documents', 'insert')
    then
      raise exception 'role % holds a privilege it must not have', v_role;
    end if;
  end loop;
end $$;

-- Booking documents bucket is private.
do $$
begin
  if to_regclass('storage.buckets') is not null
     and not exists (select 1 from storage.buckets where id = 'booking-documents' and public = false) then
    raise exception 'booking-documents bucket must exist and be private';
  end if;
end $$;

rollback;
\echo behavior_no_fixture: PASSED
