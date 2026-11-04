create table public.booking_quotes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete restrict,
  revision integer not null,
  currency char(3) not null,
  total numeric(12, 2) not null,
  quote_status text not null default 'draft',
  issued_at timestamptz,
  expires_at timestamptz,
  issued_by uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  acceptance_token_hash bytea,
  token_expires_at timestamptz,
  token_consumed_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint booking_quotes_booking_revision_unique unique (booking_id, revision),
  constraint booking_quotes_identity_currency_unique unique (id, booking_id, currency),
  constraint booking_quotes_currency_check check (currency in ('LKR', 'USD')),
  constraint booking_quotes_total_nonnegative check (total >= 0),
  constraint booking_quotes_revision_positive check (revision > 0),
  constraint booking_quotes_status_check
    check (quote_status in ('draft', 'sent', 'accepted', 'expired', 'superseded')),
  constraint booking_quotes_expiry_check
    check (expires_at is null or issued_at is null or expires_at > issued_at),
  constraint booking_quotes_issued_expiry_required
    check (
      quote_status = 'draft'
      or (issued_at is not null and expires_at is not null)
    ),
  constraint booking_quotes_acceptance_check
    check (
      (quote_status = 'accepted' and accepted_at is not null)
      or (quote_status <> 'accepted' and accepted_at is null)
    ),
  constraint booking_quotes_token_expiry_check
    check (token_expires_at is null or expires_at is null or token_expires_at <= expires_at),
  constraint booking_quotes_token_consumption_check
    check (
      token_consumed_at is null
      or (acceptance_token_hash is not null and quote_status = 'accepted')
    ),
  constraint booking_quotes_guest_acceptance_consumed_check
    check (
      quote_status <> 'accepted'
      or acceptance_token_hash is null
      or token_consumed_at is not null
    )
);

create unique index booking_quotes_one_accepted_per_booking
  on public.booking_quotes (booking_id)
  where quote_status = 'accepted';
create unique index booking_quotes_token_hash_unique
  on public.booking_quotes (acceptance_token_hash)
  where acceptance_token_hash is not null;
create index booking_quotes_booking_revision_idx
  on public.booking_quotes (booking_id, revision desc);
create index booking_quotes_status_expiry_idx
  on public.booking_quotes (quote_status, expires_at);

create trigger booking_quotes_set_updated_at
before update on public.booking_quotes
for each row execute function private.set_updated_at();

create table public.booking_quote_lines (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.booking_quotes (id) on delete restrict,
  pricing_rule_id uuid references public.pricing_rules (id) on delete set null,
  description text not null,
  quantity numeric(10, 2) not null,
  unit_amount numeric(12, 2) not null,
  line_total numeric(12, 2) not null,
  created_at timestamptz not null default pg_catalog.now(),
  constraint booking_quote_lines_quantity_positive check (quantity > 0),
  constraint booking_quote_lines_unit_amount_nonnegative check (unit_amount >= 0),
  constraint booking_quote_lines_total_nonnegative check (line_total >= 0),
  constraint booking_quote_lines_arithmetic_check
    check (line_total = pg_catalog.round(quantity * unit_amount, 2))
);

create index booking_quote_lines_quote_idx on public.booking_quote_lines (quote_id);
create index booking_quote_lines_pricing_rule_idx
  on public.booking_quote_lines (pricing_rule_id)
  where pricing_rule_id is not null;

create or replace function private.validate_quote_line_pricing_rule()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_quote_currency char(3);
  v_rule_currency char(3);
  v_package_active boolean;
  v_rule_active boolean;
  v_valid_from timestamptz;
  v_valid_until timestamptz;
begin
  if new.pricing_rule_id is null then
    return new;
  end if;

  select q.currency
    into v_quote_currency
    from public.booking_quotes as q
   where q.id = new.quote_id;

  select pp.currency, pp.is_active, pr.is_active, pp.valid_from, pp.valid_until
    into v_rule_currency, v_package_active, v_rule_active, v_valid_from, v_valid_until
    from public.pricing_rules as pr
    join public.pricing_packages as pp on pp.id = pr.package_id
   where pr.id = new.pricing_rule_id;

  if not found
     or v_quote_currency is distinct from v_rule_currency
     or v_package_active is distinct from true
     or v_rule_active is distinct from true
     or (v_valid_from is not null and v_valid_from > pg_catalog.now())
     or (v_valid_until is not null and v_valid_until <= pg_catalog.now())
  then
    raise exception 'Quote line pricing rule must be active and match the quote currency';
  end if;

  return new;
end;
$function$;

create or replace function private.assert_quote_lines_total()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_quote_id uuid;
  v_status text;
  v_quote_total numeric(12, 2);
  v_lines_total numeric(12, 2);
begin
  if tg_table_name = 'booking_quotes' then
    v_quote_id := coalesce(new.id, old.id);
  else
    v_quote_id := coalesce(new.quote_id, old.quote_id);
  end if;

  select q.quote_status, q.total
    into v_status, v_quote_total
    from public.booking_quotes as q
   where q.id = v_quote_id;

  if not found or v_status = 'draft' then
    return null;
  end if;

  select coalesce(sum(ql.line_total), 0)::numeric(12, 2)
    into v_lines_total
    from public.booking_quote_lines as ql
   where ql.quote_id = v_quote_id;

  if v_quote_total <> v_lines_total then
    raise exception 'Issued quote total must equal the sum of its quote lines';
  end if;

  return null;
end;
$function$;

create or replace function private.assert_booking_quote_state()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_booking_id uuid;
  v_booking_status text;
  v_customer_user_id uuid;
  v_has_sent_quote boolean;
  v_has_accepted_quote boolean;
begin
  if tg_table_name = 'bookings' then
    v_booking_id := coalesce(new.id, old.id);
  else
    v_booking_id := coalesce(new.booking_id, old.booking_id);
  end if;

  select b.booking_status, b.customer_user_id
    into v_booking_status, v_customer_user_id
    from public.bookings as b
   where b.id = v_booking_id;

  if not found then
    return null;
  end if;

  select
    coalesce(pg_catalog.bool_or(q.quote_status = 'sent'), false),
    coalesce(pg_catalog.bool_or(q.quote_status = 'accepted'), false)
    into v_has_sent_quote, v_has_accepted_quote
    from public.booking_quotes as q
   where q.booking_id = v_booking_id;

  if v_booking_status = 'quoted' and not v_has_sent_quote then
    raise exception 'A quoted booking must have a sent quote';
  end if;

  if v_booking_status in ('confirmed', 'assigned', 'in_progress', 'completed')
     and not v_has_accepted_quote then
    raise exception 'A confirmed or active booking must have an accepted quote';
  end if;

  if exists (
    select 1
      from public.booking_quotes as q
     where q.booking_id = v_booking_id
       and q.quote_status = 'sent'
       and v_booking_status <> 'quoted'
  ) then
    raise exception 'A sent quote requires a booking in quoted status';
  end if;

  if exists (
    select 1
      from public.booking_quotes as q
     where q.booking_id = v_booking_id
       and (
         (v_customer_user_id is null
           and q.quote_status in ('sent', 'accepted')
           and (q.acceptance_token_hash is null or q.token_expires_at is null))
         or (v_customer_user_id is not null
           and q.acceptance_token_hash is not null)
         or (q.quote_status = 'accepted'
           and q.acceptance_token_hash is not null
           and q.token_consumed_at is null)
       )
  ) then
    raise exception 'Quote acceptance token state does not match booking ownership';
  end if;

  if v_has_accepted_quote
     and v_booking_status not in (
       'confirmed', 'assigned', 'in_progress', 'completed', 'cancelled'
     ) then
    raise exception 'An accepted quote requires a confirmed or subsequently cancelled booking';
  end if;

  return null;
end;
$function$;

create or replace function private.reject_issued_quote_mutation()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_quote_id uuid;
  v_quote_status text;
begin
  if tg_op = 'DELETE' then
    v_quote_id := old.quote_id;
  else
    v_quote_id := new.quote_id;
  end if;

  select q.quote_status into v_quote_status
    from public.booking_quotes as q
   where q.id = v_quote_id;

  if v_quote_status <> 'draft' then
    raise exception 'Quote lines for issued quotes are immutable';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$function$;

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
     or new.quote_status not in ('accepted', 'expired', 'superseded')
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

create or replace function private.record_quote_status_event()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.quote_status is distinct from old.quote_status then
    insert into public.booking_events (
      booking_id, event_type, actor_user_id, details
    )
    values (
      new.booking_id,
      'quote_status_changed',
      (select auth.uid()),
      pg_catalog.jsonb_build_object(
        'quote_id', new.id,
        'from_status', old.quote_status,
        'to_status', new.quote_status
      )
    );
  end if;
  return null;
end;
$function$;

revoke all on function private.record_quote_status_event()
  from public, anon, authenticated, service_role;

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
  v_now timestamptz := pg_catalog.now();
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

create or replace function public.accept_guest_quote(
  p_quote_id uuid,
  p_token text
)
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
  v_now timestamptz := pg_catalog.now();
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

create or replace function public.expire_booking_quotes()
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_booking record;
  v_quote record;
  v_now timestamptz := pg_catalog.now();
  v_expired_count integer := 0;
  v_has_sent_quote boolean;
begin
  for v_booking in
    select b.id
      from public.bookings as b
     where b.booking_status = 'quoted'
       and exists (
         select 1
           from public.booking_quotes as q
          where q.booking_id = b.id
            and q.quote_status = 'sent'
            and q.expires_at <= v_now
       )
     order by b.id
     for update of b skip locked
  loop
    for v_quote in
      select q.id
        from public.booking_quotes as q
       where q.booking_id = v_booking.id
         and q.quote_status = 'sent'
         and q.expires_at <= v_now
       order by q.id
       for update
    loop
      update public.booking_quotes
         set quote_status = 'expired'
       where id = v_quote.id;

      v_expired_count := v_expired_count + 1;
    end loop;

    select exists (
      select 1
        from public.booking_quotes as q
       where q.booking_id = v_booking.id
         and q.quote_status = 'sent'
    )
    into v_has_sent_quote;

    if not v_has_sent_quote then
      update public.bookings
         set booking_status = 'reviewing'
       where id = v_booking.id
         and booking_status = 'quoted';

    end if;
  end loop;

  return v_expired_count;
end;
$function$;

revoke all on function private.assert_quote_lines_total()
  from public, anon, authenticated, service_role;
revoke all on function private.validate_quote_line_pricing_rule()
  from public, anon, authenticated, service_role;
revoke all on function private.assert_booking_quote_state()
  from public, anon, authenticated, service_role;
revoke all on function private.reject_issued_quote_mutation()
  from public, anon, authenticated, service_role;
revoke all on function private.guard_booking_quote_update()
  from public, anon, authenticated, service_role;
revoke all on function public.accept_customer_quote(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.accept_guest_quote(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.expire_booking_quotes()
  from public, anon, authenticated, service_role;
grant execute on function public.accept_customer_quote(uuid) to authenticated;
grant execute on function public.accept_guest_quote(uuid, text) to anon;
grant execute on function public.expire_booking_quotes() to service_role;

create constraint trigger booking_quotes_total_consistency
after insert or update on public.booking_quotes
deferrable initially deferred
for each row execute function private.assert_quote_lines_total();
create constraint trigger booking_quote_lines_total_consistency
after insert or update or delete on public.booking_quote_lines
deferrable initially deferred
for each row execute function private.assert_quote_lines_total();

create constraint trigger bookings_quote_state_consistency
after insert or update on public.bookings
deferrable initially deferred
for each row execute function private.assert_booking_quote_state();
create constraint trigger quotes_booking_state_consistency
after insert or update on public.booking_quotes
deferrable initially deferred
for each row execute function private.assert_booking_quote_state();

create trigger booking_quote_lines_immutable_after_issue
before insert or update or delete on public.booking_quote_lines
for each row execute function private.reject_issued_quote_mutation();
create trigger booking_quote_lines_validate_pricing_rule
before insert or update on public.booking_quote_lines
for each row execute function private.validate_quote_line_pricing_rule();
create trigger booking_quotes_guard_update
before update on public.booking_quotes
for each row execute function private.guard_booking_quote_update();
create trigger booking_quotes_record_status_event
after update of quote_status on public.booking_quotes
for each row execute function private.record_quote_status_event();
create trigger booking_quotes_no_delete
before delete on public.booking_quotes
for each row execute function private.reject_append_only_mutation();

alter table public.booking_quotes enable row level security;
alter table public.booking_quote_lines enable row level security;

create policy booking_quotes_customer_read_own
  on public.booking_quotes for select to authenticated
  using (private.is_booking_owner(booking_id));
create policy booking_quote_lines_customer_read_own
  on public.booking_quote_lines for select to authenticated
  using (
    exists (
      select 1
        from public.booking_quotes as q
       where q.id = booking_quote_lines.quote_id
         and private.is_booking_owner(q.booking_id)
    )
  );

revoke all on public.booking_quotes, public.booking_quote_lines
  from public, anon, authenticated, service_role;
grant select (
  id, booking_id, revision, currency, total, quote_status, issued_at, expires_at,
  issued_by, accepted_at, created_at, updated_at
) on public.booking_quotes to authenticated;
grant select (
  id, quote_id, description, quantity, unit_amount, line_total, created_at
) on public.booking_quote_lines to authenticated;

comment on table public.booking_quotes is
  'Immutable quote revisions; valid customer acceptance confirms the booking atomically.';
comment on column public.booking_quotes.acceptance_token_hash is
  'Hash of a one-time guest acceptance token; never grant this column to browser roles.';
comment on table public.booking_quote_lines is
  'Server-calculated quote snapshots; issued quote lines are immutable.';
comment on function private.assert_booking_quote_state() is
  'Deferred integrity check: quoted bookings have a sent quote and confirmed/active bookings have an accepted quote.';
comment on function private.record_quote_status_event() is
  'Appends booking history for each quote status transition.';
comment on function public.expire_booking_quotes() is
  'Expires elapsed sent quotes and returns eligible bookings to reviewing with append-only booking events.';
comment on function public.accept_customer_quote(uuid) is
  'Atomically accepts an owned, unexpired quote, confirms the booking, supersedes competing revisions, and appends events.';
comment on function public.accept_guest_quote(uuid, text) is
  'Atomically consumes a one-time guest token, accepts its unexpired quote, confirms the booking, and returns no booking details.';
