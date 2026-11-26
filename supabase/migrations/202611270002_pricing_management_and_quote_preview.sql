-- Forward-only migration:
-- 1. Enforce super_admin write boundary on pricing mutations (save/delete packages & rules),
--    while allowing admin & super_admin to read pricing configuration and calculate quote previews.
-- 2. Support 'km' unit alongside 'booking', 'leg', 'passenger', 'day'.
-- 3. Fix package selection in suggest_booking_quote_total & issue_booking_quote so active packages
--    with matching rules for the booking's vehicle category are selected reliably.
-- 4. Add public.calculate_booking_quote_preview(...) for the live Rate Calculator simulator
--    and detailed quote breakdowns.
-- 5. Add public.delete_pricing_rule(...) and public.delete_pricing_package(...) for super_admin.
-- 6. Conditionally seed starter pricing rules ONLY if public.pricing_rules is completely empty.

create or replace function public.list_pricing_configuration()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
begin
  if not exists (
    select 1 from public.profiles as p
    join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
    join public.roles as r on r.id = ur.role_id
     where p.id = (select auth.uid()) and p.account_status = 'active'
       and r.code in ('admin', 'super_admin')
  ) then
    raise exception 'An active Admin is required';
  end if;

  select coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'id', pp.id,
      'code', pp.code,
      'name', pp.name,
      'service_type', pp.service_type,
      'currency', pg_catalog.btrim(pp.currency),
      'is_active', pp.is_active,
      'valid_from', pp.valid_from,
      'valid_until', pp.valid_until,
      'created_at', pp.created_at,
      'rules', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', pr.id,
          'package_id', pr.package_id,
          'category_id', pr.category_id,
          'category_name', vc.display_name,
          'rule_type', pr.rule_type,
          'unit', pr.unit,
          'amount', pr.amount,
          'min_quantity', pr.min_quantity,
          'max_quantity', pr.max_quantity,
          'is_active', pr.is_active,
          'created_at', pr.created_at
        ) order by pr.created_at desc, pr.id)
          from public.pricing_rules as pr
          left join public.vehicle_categories as vc on vc.id = pr.category_id
         where pr.package_id = pp.id
      ), '[]'::jsonb)
    ) order by pp.created_at desc
  ), '[]'::jsonb)
    into v_result
    from public.pricing_packages as pp;
  return v_result;
end;
$function$;

revoke all on function public.list_pricing_configuration()
  from public, anon, authenticated, service_role;
grant execute on function public.list_pricing_configuration()
  to authenticated;

create or replace function public.save_pricing_package(
  p_package_id uuid,
  p_code text,
  p_name text,
  p_service_type text,
  p_currency character,
  p_is_active boolean,
  p_valid_from timestamp with time zone,
  p_valid_until timestamp with time zone
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_package_id uuid;
begin
  if not exists (
    select 1 from public.profiles as p
    join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
    join public.roles as r on r.id = ur.role_id
     where p.id = v_actor and p.account_status = 'active'
       and r.code = 'super_admin'
  ) then
    raise exception 'An active Super Admin is required to modify pricing packages';
  end if;

  if p_code !~ '^[A-Za-z0-9_-]{2,60}$'
     or pg_catalog.char_length(pg_catalog.btrim(p_name)) not between 2 and 120
     or p_service_type not in ('airport_transfer', 'day_trip', 'round_tour', 'vehicle_hire', 'custom')
     or p_currency not in ('LKR', 'USD')
     or p_is_active is null
     or (p_valid_from is not null and p_valid_until is not null and p_valid_until <= p_valid_from)
  then
    raise exception 'Pricing package details are invalid';
  end if;

  if p_package_id is null then
    insert into public.pricing_packages (
      code, name, service_type, currency, is_active, valid_from, valid_until, created_by
    ) values (
      p_code, pg_catalog.btrim(p_name), p_service_type, p_currency,
      p_is_active, p_valid_from, p_valid_until, v_actor
    ) returning id into v_package_id;
  else
    update public.pricing_packages
       set code = p_code,
           name = pg_catalog.btrim(p_name),
           service_type = p_service_type,
           currency = p_currency,
           is_active = p_is_active,
           valid_from = p_valid_from,
           valid_until = p_valid_until
     where id = p_package_id
     returning id into v_package_id;
    if not found then
      raise exception 'Pricing package is unavailable';
    end if;
  end if;
  return v_package_id;
end;
$function$;

revoke all on function public.save_pricing_package(uuid, text, text, text, character, boolean, timestamp with time zone, timestamp with time zone)
  from public, anon, authenticated, service_role;
grant execute on function public.save_pricing_package(uuid, text, text, text, character, boolean, timestamp with time zone, timestamp with time zone)
  to authenticated;

create or replace function public.save_pricing_rule(
  p_rule_id uuid,
  p_package_id uuid,
  p_category_id uuid,
  p_rule_type text,
  p_unit text,
  p_amount numeric,
  p_min_quantity numeric,
  p_max_quantity numeric,
  p_is_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_rule_id uuid;
begin
  if not exists (
    select 1 from public.profiles as p
    join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
    join public.roles as r on r.id = ur.role_id
     where p.id = v_actor and p.account_status = 'active'
       and r.code = 'super_admin'
  ) then
    raise exception 'An active Super Admin is required to modify pricing rules';
  end if;

  if pg_catalog.char_length(pg_catalog.btrim(p_rule_type)) not between 2 and 80
     or p_unit not in ('booking', 'leg', 'passenger', 'day', 'km')
     or p_amount is null or p_amount < 0
     or (p_min_quantity is not null and p_min_quantity < 0)
     or (p_max_quantity is not null and p_max_quantity < 0)
     or (p_min_quantity is not null and p_max_quantity is not null and p_max_quantity < p_min_quantity)
     or p_is_active is null
     or not exists (select 1 from public.pricing_packages as pp where pp.id = p_package_id)
     or (p_category_id is not null and not exists (
       select 1 from public.vehicle_categories as vc where vc.id = p_category_id
     ))
  then
    raise exception 'Pricing rule details are invalid';
  end if;

  if p_rule_id is null then
    insert into public.pricing_rules (
      package_id, category_id, rule_type, unit, amount,
      min_quantity, max_quantity, is_active
    ) values (
      p_package_id, p_category_id, pg_catalog.btrim(p_rule_type), p_unit, p_amount,
      p_min_quantity, p_max_quantity, p_is_active
    ) returning id into v_rule_id;
  else
    update public.pricing_rules
       set package_id = p_package_id,
           category_id = p_category_id,
           rule_type = pg_catalog.btrim(p_rule_type),
           unit = p_unit,
           amount = p_amount,
           min_quantity = p_min_quantity,
           max_quantity = p_max_quantity,
           is_active = p_is_active
     where id = p_rule_id
     returning id into v_rule_id;
    if not found then
      raise exception 'Pricing rule is unavailable';
    end if;
  end if;
  return v_rule_id;
end;
$function$;

revoke all on function public.save_pricing_rule(uuid, uuid, uuid, text, text, numeric, numeric, numeric, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.save_pricing_rule(uuid, uuid, uuid, text, text, numeric, numeric, numeric, boolean)
  to authenticated;

create or replace function public.delete_pricing_rule(p_rule_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
begin
  if not exists (
    select 1 from public.profiles as p
    join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
    join public.roles as r on r.id = ur.role_id
     where p.id = v_actor and p.account_status = 'active'
       and r.code = 'super_admin'
  ) then
    raise exception 'An active Super Admin is required to delete pricing rules';
  end if;

  delete from public.pricing_rules where id = p_rule_id;
  if not found then
    raise exception 'Pricing rule is unavailable';
  end if;
end;
$function$;

revoke all on function public.delete_pricing_rule(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.delete_pricing_rule(uuid)
  to authenticated;

create or replace function public.delete_pricing_package(p_package_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
begin
  if not exists (
    select 1 from public.profiles as p
    join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
    join public.roles as r on r.id = ur.role_id
     where p.id = v_actor and p.account_status = 'active'
       and r.code = 'super_admin'
  ) then
    raise exception 'An active Super Admin is required to delete pricing packages';
  end if;

  if exists (select 1 from public.pricing_rules as pr where pr.package_id = p_package_id) then
    raise exception 'Remove or reassign all rules in this package before deleting it';
  end if;

  delete from public.pricing_packages where id = p_package_id;
  if not found then
    raise exception 'Pricing package is unavailable';
  end if;
end;
$function$;

revoke all on function public.delete_pricing_package(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.delete_pricing_package(uuid)
  to authenticated;

-- Fix suggest_booking_quote_total to pick an active package that actually has matching active rules
-- for the booking's requested_category_id, and skip 'km' rules gracefully when distance is unavailable.
create or replace function public.suggest_booking_quote_total(
  p_booking_id uuid,
  p_currency character
)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_booking public.bookings%rowtype;
  v_package_id uuid;
  v_total numeric(12, 2) := 0;
  v_quantity numeric(10, 2);
  v_days numeric(10, 2);
  v_legs integer;
  v_rule record;
  v_matched integer := 0;
begin
  if not exists (
    select 1
      from public.profiles as p
      join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
      join public.roles as r on r.id = ur.role_id
     where p.id = v_actor
       and p.account_status = 'active'
       and r.code in ('operator', 'admin', 'super_admin')
  ) then
    raise exception 'An active Operator or Admin is required';
  end if;
  if p_currency not in ('LKR', 'USD') then
    raise exception 'Quote currency is invalid';
  end if;

  select b.* into v_booking from public.bookings as b where b.id = p_booking_id;
  if not found or v_booking.booking_status not in ('pending', 'reviewing', 'quoted') then
    raise exception 'This booking cannot be quoted';
  end if;
  if not exists (
    select 1 from public.booking_legs as bl where bl.booking_id = p_booking_id
  ) or exists (
    select 1 from public.booking_legs as bl
     where bl.booking_id = p_booking_id and bl.planned_end_at is null
  ) then
    raise exception 'Enter the expected end time for every booking leg before issuing a quote';
  end if;
  if exists (
    select 1 from public.booking_legs as bl
     where bl.booking_id = p_booking_id
       and (not pg_catalog.isfinite(bl.pickup_at) or not pg_catalog.isfinite(bl.planned_end_at))
  ) then
    raise exception 'Every booking leg must have finite pickup and expected end times before issuing a quote';
  end if;

  select pp.id
    into v_package_id
    from public.pricing_packages as pp
   where pp.service_type = v_booking.service_type
     and pp.currency = p_currency
     and pp.is_active
     and (pp.valid_from is null or pp.valid_from <= pg_catalog.now())
     and (pp.valid_until is null or pp.valid_until > pg_catalog.now())
     and exists (
       select 1
         from public.pricing_rules as pr
        where pr.package_id = pp.id
          and pr.is_active
          and pr.unit in ('booking', 'leg', 'passenger', 'day')
          and (pr.category_id is null or pr.category_id = v_booking.requested_category_id)
     )
   order by pp.valid_from desc nulls last, pp.created_at desc, pp.id
   limit 1;
  if v_package_id is null then
    return null;
  end if;

  select pg_catalog.count(*)::integer,
         greatest(
           1::numeric,
           pg_catalog.ceil(
             pg_catalog.date_part('epoch', pg_catalog.max(bl.planned_end_at) - pg_catalog.min(bl.pickup_at))
             / 86400
           )
         )::numeric(10, 2)
    into v_legs, v_days
    from public.booking_legs as bl
   where bl.booking_id = p_booking_id;

  for v_rule in
    select pr.unit, pr.amount, pr.min_quantity, pr.max_quantity
      from public.pricing_rules as pr
     where pr.package_id = v_package_id
       and pr.is_active
       and (pr.category_id is null or pr.category_id = v_booking.requested_category_id)
  loop
    v_quantity := case v_rule.unit
      when 'booking' then 1
      when 'leg' then v_legs
      when 'passenger' then v_booking.passenger_count
      when 'day' then v_days
      when 'km' then null
      else null
    end;
    if v_quantity is null then
      continue;
    end if;
    if (v_rule.min_quantity is not null and v_quantity < v_rule.min_quantity)
       or (v_rule.max_quantity is not null and v_quantity > v_rule.max_quantity)
    then
      continue;
    end if;
    v_total := v_total + pg_catalog.round(v_quantity * v_rule.amount, 2);
    v_matched := v_matched + 1;
  end loop;

  if v_matched = 0 then
    return null;
  end if;
  return v_total;
end;
$function$;

revoke all on function public.suggest_booking_quote_total(uuid, character)
  from public, anon, authenticated, service_role;
grant execute on function public.suggest_booking_quote_total(uuid, character)
  to authenticated;

-- Fix issue_booking_quote package selection to match suggest_booking_quote_total
create or replace function public.issue_booking_quote(
  p_booking_id uuid,
  p_currency character,
  p_expires_at timestamp with time zone
)
returns table (quote_id uuid, guest_token text, total numeric)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_booking public.bookings%rowtype;
  v_package_id uuid;
  v_quote_id uuid;
  v_token text;
  v_total numeric(12, 2) := 0;
  v_quantity numeric(10, 2);
  v_days numeric(10, 2);
  v_legs integer;
  v_rule record;
  v_revision integer;
begin
  if not exists (
    select 1
      from public.profiles as p
      join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
      join public.roles as r on r.id = ur.role_id
     where p.id = v_actor
       and p.account_status = 'active'
       and r.code in ('operator', 'admin', 'super_admin')
  ) then
    raise exception 'An active Operator or Admin is required';
  end if;
  select b.* into v_booking
    from public.bookings as b
   where b.id = p_booking_id
   for update;
  if not found or v_booking.booking_status not in ('pending', 'reviewing', 'quoted') then
    raise exception 'This booking cannot be quoted';
  end if;
  if p_currency is null or p_currency not in ('LKR', 'USD')
     or p_expires_at is null
     or p_expires_at <= pg_catalog.clock_timestamp()
     or p_expires_at > pg_catalog.clock_timestamp() + interval '30 days'
  then
    raise exception 'Quote currency or expiry is invalid';
  end if;
  if v_booking.requested_currency <> p_currency then
    raise exception 'Quote currency must match the customer request';
  end if;
  if not exists (
    select 1 from public.booking_legs as bl where bl.booking_id = p_booking_id
  ) or exists (
    select 1 from public.booking_legs as bl
     where bl.booking_id = p_booking_id and bl.planned_end_at is null
  ) then
    raise exception 'Enter the expected end time for every booking leg before issuing a quote';
  end if;
  if exists (
    select 1 from public.booking_legs as bl
     where bl.booking_id = p_booking_id
       and (not pg_catalog.isfinite(bl.pickup_at) or not pg_catalog.isfinite(bl.planned_end_at))
  ) then
    raise exception 'Every booking leg must have finite pickup and expected end times before issuing a quote';
  end if;

  if v_booking.booking_status in ('pending', 'quoted') then
    update public.bookings
       set booking_status = 'reviewing'
     where id = p_booking_id;
  end if;
  update public.booking_quotes
     set quote_status = 'superseded'
   where booking_id = p_booking_id
     and quote_status = 'sent';

  select pp.id
    into v_package_id
    from public.pricing_packages as pp
   where pp.service_type = v_booking.service_type
     and pp.currency = p_currency
     and pp.is_active
     and (pp.valid_from is null or pp.valid_from <= pg_catalog.now())
     and (pp.valid_until is null or pp.valid_until > pg_catalog.now())
     and exists (
       select 1
         from public.pricing_rules as pr
        where pr.package_id = pp.id
          and pr.is_active
          and pr.unit in ('booking', 'leg', 'passenger', 'day')
          and (pr.category_id is null or pr.category_id = v_booking.requested_category_id)
     )
   order by pp.valid_from desc nulls last, pp.created_at desc, pp.id
   limit 1;
  if v_package_id is null then
    raise exception 'No active pricing package is configured for this service and currency';
  end if;

  select pg_catalog.count(*)::integer,
         greatest(
           1::numeric,
           pg_catalog.ceil(
             pg_catalog.date_part('epoch', pg_catalog.max(bl.planned_end_at) - pg_catalog.min(bl.pickup_at))
             / 86400
           )
         )::numeric(10, 2)
    into v_legs, v_days
    from public.booking_legs as bl
   where bl.booking_id = p_booking_id;

  select coalesce(pg_catalog.max(q.revision), 0) + 1
    into v_revision
    from public.booking_quotes as q
   where q.booking_id = p_booking_id;

  v_token := case when v_booking.customer_user_id is null
    then pg_catalog.encode(extensions.gen_random_bytes(32), 'hex')
    else null end;

  insert into public.booking_quotes (
    booking_id, revision, currency, total, quote_status, issued_by,
    acceptance_token_hash, token_expires_at, quote_source
  )
  values (
    p_booking_id, v_revision, p_currency, 0, 'draft', v_actor,
    case when v_token is null then null
         else extensions.digest(pg_catalog.convert_to(v_token, 'UTF8'), 'sha256') end,
    case when v_token is null then null else p_expires_at end,
    'pricing_rules'
  )
  returning id into v_quote_id;

  for v_rule in
    select pr.id, pr.rule_type, pr.unit, pr.amount, pr.min_quantity,
           pr.max_quantity
      from public.pricing_rules as pr
     where pr.package_id = v_package_id
       and pr.is_active
       and (pr.category_id is null or pr.category_id = v_booking.requested_category_id)
     order by pr.id
  loop
    v_quantity := case v_rule.unit
      when 'booking' then 1
      when 'leg' then v_legs
      when 'passenger' then v_booking.passenger_count
      when 'day' then v_days
      when 'km' then null
      else null
    end;
    if v_quantity is null then
      continue;
    end if;
    if (v_rule.min_quantity is not null and v_quantity < v_rule.min_quantity)
       or (v_rule.max_quantity is not null and v_quantity > v_rule.max_quantity)
    then
      continue;
    end if;
    insert into public.booking_quote_lines (
      quote_id, pricing_rule_id, description, quantity, unit_amount, line_total
    )
    values (
      v_quote_id, v_rule.id, v_rule.rule_type || ' (' || v_rule.unit || ')',
      v_quantity, v_rule.amount, pg_catalog.round(v_quantity * v_rule.amount, 2)
    );
    v_total := v_total + pg_catalog.round(v_quantity * v_rule.amount, 2);
  end loop;

  if not exists (
    select 1 from public.booking_quote_lines as ql where ql.quote_id = v_quote_id
  ) then
    raise exception 'No applicable pricing rules are configured for this booking';
  end if;

  update public.booking_quotes
     set total = v_total, quote_status = 'sent', issued_at = pg_catalog.clock_timestamp(),
         expires_at = p_expires_at
   where id = v_quote_id;
  update public.bookings
     set booking_status = 'quoted'
   where id = p_booking_id;

  return query select v_quote_id, v_token, v_total;
end;
$function$;

revoke all on function public.issue_booking_quote(uuid, character, timestamp with time zone)
  from public, anon, authenticated, service_role;
grant execute on function public.issue_booking_quote(uuid, character, timestamp with time zone)
  to authenticated;

-- Live quote preview RPC for /admin/pricing Rate Calculator & quote verification
create or replace function public.calculate_booking_quote_preview(
  p_service_type text,
  p_category_id uuid default null,
  p_currency text default 'LKR',
  p_days numeric default 1,
  p_passengers integer default 1,
  p_legs integer default 1,
  p_km numeric default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_currency text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_currency, 'LKR')));
  v_days numeric(10, 2) := greatest(1::numeric, coalesce(p_days, 1));
  v_passengers integer := greatest(1, coalesce(p_passengers, 1));
  v_legs integer := greatest(1, coalesce(p_legs, 1));
  v_km numeric(10, 2) := greatest(0::numeric, coalesce(p_km, 0));
  v_package record;
  v_rule record;
  v_quantity numeric(10, 2);
  v_line_total numeric(12, 2);
  v_total numeric(12, 2) := 0;
  v_lines jsonb := '[]'::jsonb;
  v_matched integer := 0;
begin
  if not exists (
    select 1
      from public.profiles as p
      join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
      join public.roles as r on r.id = ur.role_id
     where p.id = v_actor
       and p.account_status = 'active'
       and r.code in ('admin', 'super_admin')
  ) then
    raise exception 'An active Admin is required';
  end if;

  if p_service_type not in ('airport_transfer', 'day_trip', 'round_tour', 'vehicle_hire', 'custom')
     or v_currency not in ('LKR', 'USD')
  then
    raise exception 'Preview parameters are invalid';
  end if;

  select pp.id, pp.code, pp.name, pp.service_type, pg_catalog.btrim(pp.currency) as currency
    into v_package
    from public.pricing_packages as pp
   where pp.service_type = p_service_type
     and pg_catalog.btrim(pp.currency) = v_currency
     and pp.is_active
     and (pp.valid_from is null or pp.valid_from <= pg_catalog.now())
     and (pp.valid_until is null or pp.valid_until > pg_catalog.now())
     and exists (
       select 1
         from public.pricing_rules as pr
        where pr.package_id = pp.id
          and pr.is_active
          and (pr.category_id is null or p_category_id is null or pr.category_id = p_category_id)
     )
   order by pp.valid_from desc nulls last, pp.created_at desc, pp.id
   limit 1;

  if not found then
    return pg_catalog.jsonb_build_object(
      'matched', false,
      'currency', v_currency,
      'total', null,
      'package', null,
      'inputs', pg_catalog.jsonb_build_object(
        'service_type', p_service_type,
        'category_id', p_category_id,
        'days', v_days,
        'passengers', v_passengers,
        'legs', v_legs,
        'km', v_km
      ),
      'lines', '[]'::jsonb,
      'message', 'No active pricing package/rule matches this service, vehicle category, and currency. Manual quotation pricing can still be entered in Bookings.'
    );
  end if;

  for v_rule in
    select pr.id, pr.rule_type, pr.unit, pr.amount, pr.min_quantity, pr.max_quantity,
           pr.category_id, vc.display_name as category_name
      from public.pricing_rules as pr
      left join public.vehicle_categories as vc on vc.id = pr.category_id
     where pr.package_id = v_package.id
       and pr.is_active
       and (pr.category_id is null or (p_category_id is not null and pr.category_id = p_category_id))
     order by pr.created_at desc, pr.id
  loop
    v_quantity := case v_rule.unit
      when 'booking' then 1
      when 'leg' then v_legs
      when 'passenger' then v_passengers
      when 'day' then v_days
      when 'km' then case when v_km > 0 then v_km else null end
      else null
    end;

    if v_quantity is null then
      continue;
    end if;

    if (v_rule.min_quantity is not null and v_quantity < v_rule.min_quantity)
       or (v_rule.max_quantity is not null and v_quantity > v_rule.max_quantity)
    then
      continue;
    end if;

    v_line_total := pg_catalog.round(v_quantity * v_rule.amount, 2);
    v_total := v_total + v_line_total;
    v_matched := v_matched + 1;

    v_lines := v_lines || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'rule_id', v_rule.id,
        'rule_type', v_rule.rule_type,
        'unit', v_rule.unit,
        'category_id', v_rule.category_id,
        'category_name', coalesce(v_rule.category_name, 'All Categories'),
        'quantity', v_quantity,
        'unit_amount', v_rule.amount,
        'line_total', v_line_total
      )
    );
  end loop;

  if v_matched = 0 then
    return pg_catalog.jsonb_build_object(
      'matched', false,
      'currency', v_currency,
      'total', null,
      'package', pg_catalog.jsonb_build_object(
        'id', v_package.id,
        'code', v_package.code,
        'name', v_package.name,
        'service_type', v_package.service_type,
        'currency', v_package.currency
      ),
      'inputs', pg_catalog.jsonb_build_object(
        'service_type', p_service_type,
        'category_id', p_category_id,
        'days', v_days,
        'passengers', v_passengers,
        'legs', v_legs,
        'km', v_km
      ),
      'lines', '[]'::jsonb,
      'message', 'Package "' || v_package.name || '" is active, but none of its rules matched the selected vehicle category or quantity bounds.'
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'matched', true,
    'currency', v_currency,
    'total', v_total,
    'package', pg_catalog.jsonb_build_object(
      'id', v_package.id,
      'code', v_package.code,
      'name', v_package.name,
      'service_type', v_package.service_type,
      'currency', v_package.currency
    ),
    'inputs', pg_catalog.jsonb_build_object(
      'service_type', p_service_type,
      'category_id', p_category_id,
      'days', v_days,
      'passengers', v_passengers,
      'legs', v_legs,
      'km', v_km
    ),
    'lines', v_lines,
    'message', 'Calculated from ' || v_matched || ' active rule(s) in package "' || v_package.name || '".'
  );
end;
$function$;

revoke all on function public.calculate_booking_quote_preview(text, uuid, text, numeric, integer, integer, numeric)
  from public, anon, authenticated, service_role;
grant execute on function public.calculate_booking_quote_preview(text, uuid, text, numeric, integer, integer, numeric)
  to authenticated;

-- Seed sensible starter rules ONLY if public.pricing_rules is completely empty
do $$
declare
  v_pkg_airport_usd uuid;
  v_pkg_tour_usd uuid;
  v_sedan_id uuid;
begin
  if not exists (select 1 from public.pricing_rules) then
    select id into v_sedan_id from public.vehicle_categories where is_active order by max_passengers asc limit 1;

    insert into public.pricing_packages (code, name, service_type, currency, is_active)
    values ('AIRPORT-USD-STD', 'Standard Airport Transfer (USD)', 'airport_transfer', 'USD', true)
    on conflict (code) do update set is_active = excluded.is_active
    returning id into v_pkg_airport_usd;

    insert into public.pricing_rules (package_id, category_id, rule_type, unit, amount, is_active)
    values (v_pkg_airport_usd, v_sedan_id, 'Airport Transfer Base Fare', 'booking', 45.00, true);

    insert into public.pricing_packages (code, name, service_type, currency, is_active)
    values ('TOUR-USD-STD', 'Chauffeur Round Tour (USD)', 'round_tour', 'USD', true)
    on conflict (code) do update set is_active = excluded.is_active
    returning id into v_pkg_tour_usd;

    insert into public.pricing_rules (package_id, category_id, rule_type, unit, amount, min_quantity, is_active)
    values (v_pkg_tour_usd, v_sedan_id, 'Daily Chauffeur & Vehicle Rate', 'day', 85.00, 1, true);
  end if;
end $$;
