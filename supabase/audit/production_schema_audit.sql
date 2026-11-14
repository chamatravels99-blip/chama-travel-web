-- READ-ONLY schema audit for Supabase SQL Editor. Only SELECTs; no DDL/DML.
-- Returns ONE row with ONE jsonb column `audit`. Copy the value and save it as a
-- .json file. It contains schema metadata only (no table data, no credentials),
-- except policy expressions, which are code rather than customer data.
select pg_catalog.jsonb_pretty(pg_catalog.jsonb_build_object(
  'generated_at', now(),
  'server_version', current_setting('server_version'),

  'migration_history', pg_catalog.jsonb_build_object(
    'supabase_migrations_schema_exists',
      exists (select 1 from pg_namespace where nspname = 'supabase_migrations'),
    'schema_migrations_exists',
      to_regclass('supabase_migrations.schema_migrations') is not null
  ),

  'schemas_and_extensions', pg_catalog.jsonb_build_object(
    'schemas', (select coalesce(jsonb_agg(nspname order by nspname), '[]') from pg_namespace
                 where nspname in ('public','private','extensions','storage','auth')),
    'extensions', (select coalesce(jsonb_agg(extname || ' ' || extversion order by extname), '[]') from pg_extension)
  ),

  'tables', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'schema', n.nspname, 'table', c.relname,
      'kind', c.relkind,
      'rls_enabled', c.relrowsecurity, 'rls_forced', c.relforcerowsecurity,
      'columns', (
        select jsonb_agg(jsonb_build_object(
          'name', a.attname, 'type', format_type(a.atttypid, a.atttypmod),
          'not_null', a.attnotnull, 'default', pg_get_expr(d.adbin, d.adrelid)
        ) order by a.attnum)
          from pg_attribute a
          left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
         where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
      ),
      'constraints', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'name', con.conname,
          'type', case con.contype when 'p' then 'primary key' when 'f' then 'foreign key'
                    when 'u' then 'unique' when 'c' then 'check' when 'x' then 'exclude' end,
          'definition', pg_get_constraintdef(con.oid)
        ) order by con.contype, con.conname), '[]')
          from pg_constraint con where con.conrelid = c.oid
      ),
      'indexes', (
        select coalesce(jsonb_agg(pg_get_indexdef(i.indexrelid) order by i.indexrelid::regclass::text), '[]')
          from pg_index i where i.indrelid = c.oid
      ),
      'policies', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'name', p.polname,
          'command', case p.polcmd when 'r' then 'SELECT' when 'a' then 'INSERT'
                       when 'w' then 'UPDATE' when 'd' then 'DELETE' else 'ALL' end,
          'permissive', p.polpermissive,
          'roles', (select coalesce(jsonb_agg(r.rolname), '["public"]') from pg_roles r where r.oid = any (p.polroles)),
          'using', pg_get_expr(p.polqual, p.polrelid),
          'with_check', pg_get_expr(p.polwithcheck, p.polrelid)
        ) order by p.polname), '[]')
          from pg_policy p where p.polrelid = c.oid
      ),
      'triggers', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'name', t.tgname, 'definition', pg_get_triggerdef(t.oid),
          'function', t.tgfoid::regproc::text
        ) order by t.tgname), '[]')
          from pg_trigger t where t.tgrelid = c.oid and not t.tgisinternal
      ),
      'client_grants', (
        select coalesce(jsonb_agg(distinct g.grantee || ':' || g.privilege_type), '[]')
          from information_schema.role_table_grants g
         where g.table_schema = n.nspname and g.table_name = c.relname
           and g.grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC')
      )
    ) order by n.nspname, c.relname), '[]')
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname in ('public', 'private') and c.relkind in ('r', 'p', 'v', 'm')
  ),

  'sequences', (
    select coalesce(jsonb_agg(n.nspname || '.' || c.relname order by n.nspname, c.relname), '[]')
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname in ('public', 'private') and c.relkind = 'S'
  ),

  'functions', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'schema', n.nspname,
      'signature', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
      'returns', pg_get_function_result(p.oid),
      'language', l.lanname,
      'security_definer', p.prosecdef,
      'volatility', p.provolatile,
      'config', p.proconfig,
      'owner', pg_get_userbyid(p.proowner),
      'acl', p.proacl::text,
      'source_md5', md5(p.prosrc)
    ) order by n.nspname, p.proname, p.oid), '[]')
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      join pg_language l on l.oid = p.prolang
     where n.nspname in ('public', 'private') and p.prokind in ('f', 'p')
  ),

  'storage', pg_catalog.jsonb_build_object(
    'buckets_table_exists', to_regclass('storage.buckets') is not null,
    'object_policies', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', p.polname, 'permissive', p.polpermissive,
        'using', pg_get_expr(p.polqual, p.polrelid),
        'with_check', pg_get_expr(p.polwithcheck, p.polrelid)) order by p.polname), '[]')
        from pg_policy p where p.polrelid = to_regclass('storage.objects')
    )
  ),

  'pending_migration_objects_present', pg_catalog.jsonb_build_object(
    'private.driver_assignment_invitations', to_regclass('private.driver_assignment_invitations') is not null,
    'public.booking_documents', to_regclass('public.booking_documents') is not null,
    'public.invoices', to_regclass('public.invoices') is not null,
    'private.rate_limit_buckets', to_regclass('private.rate_limit_buckets') is not null,
    'private.guest_booking_access_tokens', to_regclass('private.guest_booking_access_tokens') is not null,
    'public.driver_hire_offers', to_regclass('public.driver_hire_offers') is not null,
    'public.driver_hire_payouts', to_regclass('public.driver_hire_payouts') is not null,
    'payments.receipt_number', exists (
      select 1 from pg_attribute where attrelid = to_regclass('public.payments')
         and attname = 'receipt_number' and not attisdropped)
  )
)) as audit;
