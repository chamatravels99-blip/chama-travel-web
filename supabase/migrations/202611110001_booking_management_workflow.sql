-- Booking management workflow, phase 1 (additive; no data is modified).
--   A. Manual expected end time (admin-entered, never defaulted)
--   B. Manual quotations alongside pricing-rule quotations
--   C. Customer quote rejection
--   D. Assigned-driver details for the owning customer after the driver accepts
--   E. Driver "on the way" step (recorded in booking_events; no new status values)
--   F. Admin "mark under review" action
-- Requires 202611100001 (deferred constraint triggers run as SECURITY DEFINER).

-- Deferred quote-total check also runs at commit as the API caller; it is read-only.
alter function private.assert_quote_lines_total() security definer;

-- ---------------------------------------------------------------------------
-- B/C. Quote source and the 'rejected' quote status
-- ---------------------------------------------------------------------------
alter table public.booking_quotes
  add column if not exists quote_source text not null default 'pricing_rules';

alter table public.booking_quotes
  drop constraint if exists booking_quotes_source_check,
  add constraint booking_quotes_source_check
  check (quote_source in ('pricing_rules', 'manual'));

alter table public.booking_quotes
  drop constraint if exists booking_quotes_status_check,
  add constraint booking_quotes_status_check
    check (quote_status in ('draft', 'sent', 'accepted', 'expired', 'superseded', 'rejected'));

create or replace function private.guard_booking_quote_update()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if old.quote_status = 'draft' then
    if new.quote_status not in ('draft', 'sent', 'expired', 'superseded') then
      raise exception 'Invalid draft quote transition';
    end if;
    return new;
  end if;

  if old.quote_status <> 'sent'
     or new.quote_status not in ('accepted', 'expired', 'superseded', 'rejected')
     or new.booking_id is distinct from old.booking_id
     or new.revision is distinct from old.revision
     or new.currency is distinct from old.currency
     or new.total is distinct from old.total
     or new.issued_at is distinct from old.issued_at
     or new.expires_at is distinct from old.expires_at
     or new.issued_by is distinct from old.issued_by
     or new.acceptance_token_hash is distinct from old.acceptance_token_hash
     or new.token_expires_at is distinct from old.token_expires_at
     or new.created_at is distinct from old.created_at
     or new.quote_source is distinct from old.quote_source
  then
    raise exception 'Issued quote terms are immutable';
  end if;

  if new.quote_status = 'accepted' then
    if new.accepted_at is null then
      raise exception 'Accepted quote requires accepted_at';
    end if;
    if old.acceptance_token_hash is not null
       and new.token_consumed_at is null then
      raise exception 'Guest quote acceptance must consume its token';
    end if;
  elsif new.accepted_at is not null or new.token_consumed_at is not null then
    raise exception 'Only an accepted quote may have acceptance metadata';
  end if;

  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- F. Admin/Operator: mark a pending booking as under review
-- ---------------------------------------------------------------------------
create or replace function public.set_booking_under_review(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
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

  perform 1 from public.bookings as b
   where b.id = p_booking_id and b.booking_status = 'pending'
   for update;
  if not found then
    raise exception 'Only pending bookings can be marked under review';
  end if;

  update public.bookings
     set booking_status = 'reviewing'
   where id = p_booking_id;
end;
$function$;

-- ---------------------------------------------------------------------------
-- A. Admin/Operator: set the expected end time of a booking leg manually
-- ---------------------------------------------------------------------------
create or replace function public.set_booking_leg_end_time(
  p_booking_id uuid,
  p_sequence_no smallint,
  p_planned_end_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_leg_id uuid;
  v_status text;
  v_pickup_at timestamptz;
  v_old_end timestamptz;
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
  if p_planned_end_at is null then
    raise exception 'An expected end time is required';
  end if;
  if not pg_catalog.isfinite(p_planned_end_at) then
    raise exception 'Expected end time must be finite';
  end if;

  select b.booking_status into v_status
    from public.bookings as b
   where b.id = p_booking_id
   for update;
  if not found then
    raise exception 'Booking leg is unavailable';
  end if;

  select bl.id, bl.pickup_at, bl.planned_end_at
    into v_leg_id, v_pickup_at, v_old_end
    from public.booking_legs as bl
   where bl.booking_id = p_booking_id
     and bl.sequence_no = p_sequence_no
   for update;
  if not found then
    raise exception 'Booking leg is unavailable';
  end if;

  if v_status not in ('pending', 'reviewing') then
    raise exception 'The expected end time can only be changed before a quote is sent';
  end if;
  if p_planned_end_at <= v_pickup_at then
    raise exception 'Expected end time must be later than the pickup time';
  end if;

  update public.booking_legs
     set planned_end_at = p_planned_end_at
   where id = v_leg_id;

  insert into public.booking_events (booking_id, event_type, actor_user_id, details)
  values (
    p_booking_id,
    'leg_end_time_set',
    v_actor,
    pg_catalog.jsonb_build_object(
      'sequence_no', p_sequence_no,
      'from_planned_end_at', v_old_end,
      'to_planned_end_at', p_planned_end_at
    )
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- B. Pricing-rule quote: every leg requires an expected end time.
--    Signature, security settings and grants are unchanged.
-- ---------------------------------------------------------------------------
create or replace function public.issue_booking_quote(
  p_booking_id uuid,
  p_currency char(3),
  p_expires_at timestamptz
)
returns table (quote_id uuid, guest_token text, total numeric(12, 2))
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
      else null
    end;
    if v_quantity is null then
      raise exception 'Pricing rule unit "%" is not supported', v_rule.unit;
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

-- ---------------------------------------------------------------------------
-- B. Read-only suggestion of the pricing-rule total (nothing is written)
-- ---------------------------------------------------------------------------
create or replace function public.suggest_booking_quote_total(
  p_booking_id uuid,
  p_currency char(3)
)
returns numeric(12, 2)
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

  select pp.id
    into v_package_id
    from public.pricing_packages as pp
   where pp.service_type = v_booking.service_type
     and pp.currency = p_currency
     and pp.is_active
     and (pp.valid_from is null or pp.valid_from <= pg_catalog.now())
     and (pp.valid_until is null or pp.valid_until > pg_catalog.now())
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
      else null
    end;
    if v_quantity is null then
      raise exception 'Pricing rule unit "%" is not supported', v_rule.unit;
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

-- ---------------------------------------------------------------------------
-- B. Admin/Operator: issue a manually priced quotation
-- ---------------------------------------------------------------------------
create or replace function public.issue_manual_booking_quote(
  p_booking_id uuid,
  p_currency char(3),
  p_expires_at timestamptz,
  p_amount numeric
)
returns table (quote_id uuid, guest_token text, total numeric(12, 2))
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_booking public.bookings%rowtype;
  v_quote_id uuid;
  v_token text;
  v_revision integer;
  v_amount numeric(12, 2);
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
  if p_amount is null
     or p_amount <= 0
     or p_amount > 9999999999.99
     or p_amount <> pg_catalog.round(p_amount, 2)
  then
    raise exception 'Quote amount must be a positive amount with at most two decimals';
  end if;
  v_amount := p_amount::numeric(12, 2);

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
    'manual'
  )
  returning id into v_quote_id;

  insert into public.booking_quote_lines (
    quote_id, pricing_rule_id, description, quantity, unit_amount, line_total
  )
  values (v_quote_id, null, 'Manual quotation', 1, v_amount, v_amount);

  update public.booking_quotes
     set total = v_amount, quote_status = 'sent', issued_at = pg_catalog.clock_timestamp(),
         expires_at = p_expires_at
   where id = v_quote_id;
  update public.bookings
     set booking_status = 'quoted'
   where id = p_booking_id;

  return query select v_quote_id, v_token, v_amount;
end;
$function$;

-- ---------------------------------------------------------------------------
-- C. Check quote acceptance expiry after acquiring booking and quote locks.
-- ---------------------------------------------------------------------------
create or replace function public.accept_customer_quote(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_booking_id uuid;
  v_customer_user_id uuid;
  v_account_status text;
  v_quote_status text;
  v_expires_at timestamptz;
  v_now timestamptz;
begin
  if v_user_id is null then
    raise exception 'Quote acceptance is unavailable';
  end if;

  select q.booking_id
    into v_booking_id
    from public.booking_quotes as q
   where q.id = p_quote_id;

  if not found then
    raise exception 'Quote acceptance is unavailable';
  end if;

  select b.customer_user_id, p.account_status
    into v_customer_user_id, v_account_status
    from public.bookings as b
    join public.profiles as p on p.id = b.customer_user_id
   where b.id = v_booking_id
   for update of b, p;

  if not found
     or v_customer_user_id is null
     or v_customer_user_id <> v_user_id
     or v_account_status is distinct from 'active'
     or (select b.booking_status from public.bookings as b where b.id = v_booking_id)
          is distinct from 'quoted'
  then
    raise exception 'Quote acceptance is unavailable';
  end if;

  select q.quote_status, q.expires_at
    into v_quote_status, v_expires_at
    from public.booking_quotes as q
   where q.id = p_quote_id
     and q.booking_id = v_booking_id
   for update;

  v_now := pg_catalog.clock_timestamp();
  if not found
     or v_quote_status <> 'sent'
     or v_expires_at is null
     or v_expires_at <= v_now
  then
    raise exception 'Quote acceptance is unavailable';
  end if;

  update public.booking_quotes
     set quote_status = 'accepted',
         accepted_at = v_now
   where id = p_quote_id;

  update public.booking_quotes
     set quote_status = 'superseded'
   where booking_id = v_booking_id
     and id <> p_quote_id
     and quote_status = 'sent';

  update public.bookings
     set booking_status = 'confirmed'
   where id = v_booking_id;
end;
$function$;

create or replace function public.accept_guest_quote(p_quote_id uuid, p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_booking_id uuid;
  v_customer_user_id uuid;
  v_booking_status text;
  v_quote_status text;
  v_expires_at timestamptz;
  v_token_hash bytea;
  v_stored_hash bytea;
  v_token_expires_at timestamptz;
  v_token_consumed_at timestamptz;
  v_now timestamptz;
begin
  if p_token is null or pg_catalog.char_length(p_token) < 32
     or pg_catalog.char_length(p_token) > 256
  then
    raise exception 'Quote acceptance is unavailable';
  end if;

  select q.booking_id
    into v_booking_id
    from public.booking_quotes as q
   where q.id = p_quote_id;

  if not found then
    raise exception 'Quote acceptance is unavailable';
  end if;

  select b.customer_user_id, b.booking_status
    into v_customer_user_id, v_booking_status
    from public.bookings as b
   where b.id = v_booking_id
   for update;

  select
    q.quote_status,
    q.expires_at,
    q.acceptance_token_hash,
    q.token_expires_at,
    q.token_consumed_at
    into
    v_quote_status,
    v_expires_at,
    v_stored_hash,
    v_token_expires_at,
    v_token_consumed_at
    from public.booking_quotes as q
   where q.id = p_quote_id
     and q.booking_id = v_booking_id
   for update;

  v_token_hash := extensions.digest(
    pg_catalog.convert_to(p_token, 'UTF8'),
    'sha256'
  );
  v_now := pg_catalog.clock_timestamp();

  if v_customer_user_id is not null
     or v_booking_status is distinct from 'quoted'
     or v_quote_status is distinct from 'sent'
     or v_expires_at is null
     or v_expires_at <= v_now
     or v_token_expires_at is null
     or v_token_expires_at <= v_now
     or v_token_consumed_at is not null
     or v_stored_hash is null
     or v_stored_hash <> v_token_hash
  then
    raise exception 'Quote acceptance is unavailable';
  end if;

  update public.booking_quotes
     set quote_status = 'accepted',
         accepted_at = v_now,
         token_consumed_at = v_now
   where id = p_quote_id;

  update public.booking_quotes
     set quote_status = 'superseded'
   where booking_id = v_booking_id
     and id <> p_quote_id
     and quote_status = 'sent';

  update public.bookings
     set booking_status = 'confirmed'
   where id = v_booking_id;
end;
$function$;

-- ---------------------------------------------------------------------------
-- C. Customer: reject a sent quote
-- ---------------------------------------------------------------------------
create or replace function public.reject_customer_quote(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_booking_id uuid;
  v_customer_user_id uuid;
  v_account_status text;
  v_quote_status text;
  v_expires_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Quote rejection is unavailable';
  end if;

  select q.booking_id
    into v_booking_id
    from public.booking_quotes as q
   where q.id = p_quote_id;
  if not found then
    raise exception 'Quote rejection is unavailable';
  end if;

  select b.customer_user_id, p.account_status
    into v_customer_user_id, v_account_status
    from public.bookings as b
    join public.profiles as p on p.id = b.customer_user_id
   where b.id = v_booking_id
   for update of b, p;

  if not found
     or v_customer_user_id is null
     or v_customer_user_id <> v_user_id
     or v_account_status is distinct from 'active'
     or (select b.booking_status from public.bookings as b where b.id = v_booking_id)
          is distinct from 'quoted'
  then
    raise exception 'Quote rejection is unavailable';
  end if;

  select q.quote_status, q.expires_at
    into v_quote_status, v_expires_at
    from public.booking_quotes as q
   where q.id = p_quote_id
     and q.booking_id = v_booking_id
   for update;

  if not found
     or v_quote_status <> 'sent'
     or v_expires_at is null
     or v_expires_at <= pg_catalog.clock_timestamp()
  then
    raise exception 'Quote rejection is unavailable';
  end if;

  update public.booking_quotes
     set quote_status = 'rejected'
   where id = p_quote_id;

  update public.bookings
     set booking_status = 'rejected'
   where id = v_booking_id;
end;
$function$;

-- ---------------------------------------------------------------------------
-- D. Customer: assigned driver details, only after the driver has accepted
--    Returns zero rows when the caller does not own the booking or no
--    accepted assignment exists, so nothing is revealed.
-- ---------------------------------------------------------------------------
create or replace function public.get_customer_assigned_driver(p_booking_id uuid)
returns table (
  driver_name text,
  driver_phone text,
  vehicle_name text,
  vehicle_type text,
  registration_number text
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    return;
  end if;

  return query
  select dp.full_name::text,
         dp.phone::text,
         v.display_name::text,
         vc.display_name::text,
         v.registration_number::text
    from public.bookings as b
    join public.profiles as cp on cp.id = b.customer_user_id
    join public.booking_assignments as ba on ba.booking_id = b.id
    join public.profiles as dp on dp.id = ba.driver_user_id
    join public.vehicles as v on v.id = ba.vehicle_id
    join public.vehicle_categories as vc on vc.id = v.category_id
   where b.id = p_booking_id
     and b.customer_user_id = v_user_id
     and cp.account_status = 'active'
     and ba.assignment_status in ('accepted', 'in_progress', 'completed')
   order by ba.assigned_at desc
   limit 1;
end;
$function$;

-- ---------------------------------------------------------------------------
-- A. Assignment requires an expected end time on EVERY leg
-- ---------------------------------------------------------------------------
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
begin
  if not exists (
    select 1
      from public.profiles as p
      join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
      join public.roles as r on r.id = ur.role_id
     where p.id = v_actor and p.account_status = 'active'
       and r.code in ('operator', 'admin', 'super_admin')
  ) then
    raise exception 'An active Operator or Admin is required';
  end if;

  perform 1 from public.bookings as b
   where b.id = p_booking_id and b.booking_status = 'confirmed'
   for update;
  if not found then
    raise exception 'Only confirmed bookings can be assigned';
  end if;

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

-- ---------------------------------------------------------------------------
-- E. Driver actions: existing accept/decline/start/complete plus on_the_way
--    on_the_way is recorded once per assignment as a booking_events row; the
--    assignment and booking statuses (and their guard triggers) are unchanged.
-- ---------------------------------------------------------------------------
create or replace function public.update_driver_assignment(
  p_assignment_id uuid,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_assignment public.booking_assignments%rowtype;
  v_booking_status text;
  v_now timestamptz := pg_catalog.now();
begin
  select ba.* into v_assignment
    from public.booking_assignments as ba
   where ba.id = p_assignment_id
   for update;
  if not found or v_assignment.driver_user_id is distinct from (select auth.uid()) then
    raise exception 'Assignment is unavailable';
  end if;

  select b.booking_status into v_booking_status
    from public.bookings as b
   where b.id = v_assignment.booking_id
   for update;

  if p_action in ('accept', 'decline') and v_assignment.assignment_status = 'offered' then
    update public.booking_assignments
       set assignment_status = case p_action when 'accept' then 'accepted' else 'declined' end,
           responded_at = v_now
     where id = p_assignment_id;
    if p_action = 'decline' then
      update public.bookings set booking_status = 'confirmed'
       where id = v_assignment.booking_id and booking_status = 'assigned';
    end if;
  elsif p_action = 'on_the_way'
        and v_assignment.assignment_status = 'accepted'
        and v_booking_status = 'assigned'
        and exists (
          select 1
            from public.profiles as p
            join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
            join public.roles as r on r.id = ur.role_id and r.code = 'driver'
           where p.id = v_assignment.driver_user_id
             and p.account_status = 'active'
        )
        and not exists (
          select 1
            from public.booking_events as be
           where be.booking_id = v_assignment.booking_id
             and be.event_type = 'driver_on_the_way'
             and be.details ->> 'assignment_id' = p_assignment_id::text
        ) then
    insert into public.booking_events (booking_id, event_type, actor_user_id, details)
    values (
      v_assignment.booking_id,
      'driver_on_the_way',
      v_assignment.driver_user_id,
      pg_catalog.jsonb_build_object('assignment_id', p_assignment_id)
    );
  elsif p_action = 'start'
        and v_assignment.assignment_status = 'accepted'
        and v_booking_status = 'assigned' then
    update public.booking_assignments set assignment_status = 'in_progress'
     where id = p_assignment_id;
    update public.bookings set booking_status = 'in_progress'
     where id = v_assignment.booking_id;
    update public.booking_legs set trip_status = 'in_progress'
     where booking_id = v_assignment.booking_id and trip_status = 'not_started';
  elsif p_action = 'complete'
        and v_assignment.assignment_status = 'in_progress'
        and v_booking_status = 'in_progress' then
    update public.booking_assignments set assignment_status = 'completed'
     where id = p_assignment_id;
    update public.bookings set booking_status = 'completed'
     where id = v_assignment.booking_id;
    update public.booking_legs set trip_status = 'completed'
     where booking_id = v_assignment.booking_id and trip_status = 'in_progress';
  else
    raise exception 'This assignment action is not permitted in its current state';
  end if;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Grants: authenticated only; each function enforces its own role/ownership check.
-- ---------------------------------------------------------------------------
revoke all on function public.set_booking_under_review(uuid)
  from public, anon, authenticated;
revoke all on function public.set_booking_leg_end_time(uuid, smallint, timestamptz)
  from public, anon, authenticated;
revoke all on function public.suggest_booking_quote_total(uuid, char)
  from public, anon, authenticated;
revoke all on function public.issue_manual_booking_quote(uuid, char, timestamptz, numeric)
  from public, anon, authenticated;
revoke all on function public.reject_customer_quote(uuid)
  from public, anon, authenticated;
revoke all on function public.get_customer_assigned_driver(uuid)
  from public, anon, authenticated;

grant execute on function public.set_booking_under_review(uuid) to authenticated;
grant execute on function public.set_booking_leg_end_time(uuid, smallint, timestamptz) to authenticated;
grant execute on function public.suggest_booking_quote_total(uuid, char) to authenticated;
grant execute on function public.issue_manual_booking_quote(uuid, char, timestamptz, numeric) to authenticated;
grant execute on function public.reject_customer_quote(uuid) to authenticated;
grant execute on function public.get_customer_assigned_driver(uuid) to authenticated;

comment on column public.booking_quotes.quote_source is
  'How the quote total was produced: pricing_rules (computed) or manual (admin-entered single line).';
comment on function public.issue_manual_booking_quote(uuid, char, timestamptz, numeric) is
  'Issues a quote with an Admin/Operator-entered amount as a single manual quote line.';
comment on function public.get_customer_assigned_driver(uuid) is
  'Returns driver and vehicle contact details to the booking owner only after the driver accepted the assignment.';
comment on function public.update_driver_assignment(uuid, text) is
  'Atomically synchronizes driver assignment, booking lifecycle, and leg trip status; on_the_way is recorded as an event.';
