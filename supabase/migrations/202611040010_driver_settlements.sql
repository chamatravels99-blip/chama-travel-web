create table public.driver_settlements (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  assignment_id uuid not null unique
    references public.booking_assignments (id) on delete restrict,
  booking_id uuid not null
    references public.bookings (id) on delete restrict,
  driver_user_id uuid not null
    references public.profiles (id) on delete restrict,
  quote_id uuid not null,
  currency char(3) not null,
  amount numeric(12, 2) not null,
  settlement_status text not null default 'pending',
  payout_method text,
  payout_reference text,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  paid_by uuid references public.profiles (id) on delete restrict,
  paid_at timestamptz,
  constraint driver_settlements_quote_booking_currency_fk
    foreign key (quote_id, booking_id, currency)
    references public.booking_quotes (id, booking_id, currency)
    on delete restrict,
  constraint driver_settlements_currency_check
    check (currency in ('LKR', 'USD')),
  constraint driver_settlements_amount_positive
    check (amount > 0),
  constraint driver_settlements_status_check
    check (settlement_status in ('pending', 'paid')),
  constraint driver_settlements_payout_method_check
    check (payout_method is null or payout_method in ('cash', 'bank_transfer')),
  constraint driver_settlements_reference_length_check
    check (payout_reference is null or pg_catalog.char_length(payout_reference) <= 160),
  constraint driver_settlements_payment_state_check
    check (
      (settlement_status = 'pending'
        and payout_method is null and payout_reference is null
        and paid_by is null and paid_at is null)
      or (settlement_status = 'paid'
        and payout_method is not null and paid_by is not null and paid_at is not null)
    )
);

create index driver_settlements_driver_created_idx
  on public.driver_settlements (driver_user_id, created_at desc);
create index driver_settlements_status_created_idx
  on public.driver_settlements (settlement_status, created_at desc);

create or replace function private.validate_driver_settlement()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_booking_id uuid;
  v_driver_user_id uuid;
  v_quote_id uuid;
  v_currency char(3);
  v_quote_total numeric(12, 2);
begin
  if tg_op = 'INSERT' then
    if new.settlement_status <> 'pending'
       or new.payout_method is not null
       or new.payout_reference is not null
       or new.paid_by is not null
       or new.paid_at is not null
       or new.created_by is distinct from v_actor
    then
      raise exception 'New driver settlements must begin as pending';
    end if;

    select ba.booking_id, ba.driver_user_id, q.id, q.currency, q.total
      into v_booking_id, v_driver_user_id, v_quote_id, v_currency, v_quote_total
      from public.booking_assignments as ba
      join public.booking_quotes as q
        on q.booking_id = ba.booking_id
       and q.quote_status = 'accepted'
      join public.bookings as b on b.id = ba.booking_id
     where ba.id = new.assignment_id
       and ba.assignment_status = 'completed'
       and b.booking_status = 'completed';

    if not found
       or new.booking_id is distinct from v_booking_id
       or new.driver_user_id is distinct from v_driver_user_id
       or new.quote_id is distinct from v_quote_id
       or new.currency is distinct from v_currency
       or new.amount > v_quote_total
    then
      raise exception 'Settlement must match a completed assignment and its accepted quote';
    end if;
  else
    if old.settlement_status <> 'pending'
       or new.settlement_status <> 'paid'
       or new.id is distinct from old.id
       or new.assignment_id is distinct from old.assignment_id
       or new.booking_id is distinct from old.booking_id
       or new.driver_user_id is distinct from old.driver_user_id
       or new.quote_id is distinct from old.quote_id
       or new.currency is distinct from old.currency
       or new.amount is distinct from old.amount
       or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at
       or new.paid_by is distinct from v_actor
       or new.paid_at is null
       or new.payout_method is null
       or new.payout_method not in ('cash', 'bank_transfer')
    then
      raise exception 'Driver settlement terms are immutable and may be paid only once';
    end if;
  end if;

  if not exists (
    select 1
      from public.profiles as p
      join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
      join public.roles as r on r.id = ur.role_id
     where p.id = v_actor
       and p.account_status = 'active'
       and r.code in ('admin', 'super_admin')
  ) then
    raise exception 'Only an active Admin may manage driver settlements';
  end if;

  return new;
end;
$function$;

create or replace function private.record_driver_settlement_event()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if tg_op = 'INSERT' then
    insert into public.booking_events (
      booking_id, event_type, to_status, actor_user_id, details
    )
    values (
      new.booking_id,
      'driver_settlement_created',
      new.settlement_status,
      new.created_by,
      pg_catalog.jsonb_build_object(
        'settlement_id', new.id,
        'assignment_id', new.assignment_id,
        'driver_user_id', new.driver_user_id,
        'amount', new.amount,
        'currency', new.currency
      )
    );
  else
    insert into public.booking_events (
      booking_id, event_type, from_status, to_status, actor_user_id, details
    )
    values (
      new.booking_id,
      'driver_settlement_paid',
      old.settlement_status,
      new.settlement_status,
      new.paid_by,
      pg_catalog.jsonb_build_object(
        'settlement_id', new.id,
        'assignment_id', new.assignment_id,
        'driver_user_id', new.driver_user_id,
        'amount', new.amount,
        'currency', new.currency,
        'payout_method', new.payout_method
      )
    );
  end if;
  return null;
end;
$function$;

create or replace function private.reject_driver_settlement_delete()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  raise exception 'Driver settlement history is immutable';
end;
$function$;

revoke all on function private.validate_driver_settlement()
  from public, anon, authenticated, service_role;
revoke all on function private.record_driver_settlement_event()
  from public, anon, authenticated, service_role;
revoke all on function private.reject_driver_settlement_delete()
  from public, anon, authenticated, service_role;

create trigger driver_settlements_validate
before insert or update on public.driver_settlements
for each row execute function private.validate_driver_settlement();
create trigger driver_settlements_record_event
after insert or update on public.driver_settlements
for each row execute function private.record_driver_settlement_event();
create trigger driver_settlements_no_delete
before delete on public.driver_settlements
for each row execute function private.reject_driver_settlement_delete();

alter table public.driver_settlements enable row level security;
revoke all on public.driver_settlements
  from public, anon, authenticated, service_role;

create or replace function public.admin_create_driver_settlement(
  p_assignment_id uuid,
  p_amount numeric(12, 2)
)
returns table (settlement_id uuid, created boolean)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_booking_id uuid;
  v_driver_user_id uuid;
  v_quote_id uuid;
  v_currency char(3);
  v_settlement_id uuid;
  v_existing_amount numeric(12, 2);
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
    raise exception 'Only an active Admin may create driver settlements';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Settlement amount must be positive';
  end if;

  select ba.booking_id, ba.driver_user_id
    into v_booking_id, v_driver_user_id
    from public.booking_assignments as ba
   where ba.id = p_assignment_id
     and ba.assignment_status = 'completed'
   for update;
  if not found then
    raise exception 'A completed assignment is required';
  end if;

  select ds.id, ds.amount
    into v_settlement_id, v_existing_amount
    from public.driver_settlements as ds
   where ds.assignment_id = p_assignment_id
   for update;
  if found then
    if v_existing_amount is distinct from p_amount then
      raise exception 'A settlement already exists with a different amount';
    end if;
    return query select v_settlement_id, false;
    return;
  end if;

  select q.id, q.currency
    into v_quote_id, v_currency
    from public.booking_quotes as q
   where q.booking_id = v_booking_id
     and q.quote_status = 'accepted'
   for update;
  if not found then
    raise exception 'An accepted booking quote is required';
  end if;

  insert into public.driver_settlements (
    assignment_id, booking_id, driver_user_id, quote_id, currency,
    amount, created_by
  )
  values (
    p_assignment_id, v_booking_id, v_driver_user_id, v_quote_id, v_currency,
    p_amount, v_actor
  )
  returning id into v_settlement_id;
  return query select v_settlement_id, true;
end;
$function$;

create or replace function public.admin_pay_driver_settlement(
  p_settlement_id uuid,
  p_method text,
  p_reference text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_settlement public.driver_settlements%rowtype;
  v_normalized_reference text := nullif(pg_catalog.btrim(coalesce(p_reference, '')), '');
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
    raise exception 'Only an active Admin may record driver payouts';
  end if;
  if p_method is null
     or p_method not in ('cash', 'bank_transfer')
     or pg_catalog.char_length(coalesce(p_reference, '')) > 160
  then
    raise exception 'Driver payout details are invalid';
  end if;

  select ds.*
    into v_settlement
    from public.driver_settlements as ds
   where ds.id = p_settlement_id
   for update;
  if not found then
    raise exception 'Driver settlement is unavailable';
  end if;

  if v_settlement.settlement_status = 'paid' then
    if v_settlement.paid_by = v_actor
       and v_settlement.payout_method = p_method
       and v_settlement.payout_reference is not distinct from v_normalized_reference
    then
      return;
    end if;
    raise exception 'Driver settlement has already been paid with different details';
  end if;

  update public.driver_settlements
     set settlement_status = 'paid',
         payout_method = p_method,
         payout_reference = v_normalized_reference,
         paid_by = v_actor,
         paid_at = pg_catalog.now()
   where id = p_settlement_id
     and settlement_status = 'pending';
  if not found then
    raise exception 'Pending driver settlement is unavailable';
  end if;
end;
$function$;

create or replace function public.admin_list_driver_settlements()
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
    select 1
      from public.profiles as p
      join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
      join public.roles as r on r.id = ur.role_id
     where p.id = (select auth.uid())
       and p.account_status = 'active'
       and r.code in ('admin', 'super_admin')
  ) then
    raise exception 'Only an active Admin may view driver settlements';
  end if;

  select coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'id', ds.id,
      'assignment_id', ds.assignment_id,
      'booking_id', ds.booking_id,
      'booking_ref', b.booking_ref,
      'driver_user_id', ds.driver_user_id,
      'driver_name', p.full_name,
      'quote_id', ds.quote_id,
      'currency', ds.currency,
      'amount', ds.amount,
      'settlement_status', ds.settlement_status,
      'payout_method', ds.payout_method,
      'payout_reference', ds.payout_reference,
      'created_at', ds.created_at,
      'paid_at', ds.paid_at
    ) order by ds.created_at desc
  ), '[]'::jsonb)
    into v_result
    from (
      select * from public.driver_settlements
       order by created_at desc
       limit 200
    ) as ds
    join public.bookings as b on b.id = ds.booking_id
    join public.profiles as p on p.id = ds.driver_user_id;
  return v_result;
end;
$function$;

create or replace function public.admin_list_settlement_candidates()
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
    select 1
      from public.profiles as p
      join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
      join public.roles as r on r.id = ur.role_id
     where p.id = (select auth.uid())
       and p.account_status = 'active'
       and r.code in ('admin', 'super_admin')
  ) then
    raise exception 'Only an active Admin may view settlement candidates';
  end if;

  select coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'assignment_id', candidate.assignment_id,
      'booking_ref', candidate.booking_ref,
      'driver_user_id', candidate.driver_user_id,
      'driver_name', candidate.driver_name,
      'currency', candidate.currency,
      'quote_total', candidate.quote_total
    ) order by candidate.assigned_at desc
  ), '[]'::jsonb)
    into v_result
    from (
      select
        ba.id as assignment_id,
        b.booking_ref,
        ba.driver_user_id,
        p.full_name as driver_name,
        q.currency,
        q.total as quote_total,
        ba.assigned_at
      from public.booking_assignments as ba
      join public.bookings as b on b.id = ba.booking_id
      join public.booking_quotes as q
        on q.booking_id = b.id
       and q.quote_status = 'accepted'
      join public.profiles as p on p.id = ba.driver_user_id
      left join public.driver_settlements as ds on ds.assignment_id = ba.id
      where ba.assignment_status = 'completed'
        and b.booking_status = 'completed'
        and ds.id is null
      order by ba.assigned_at desc
      limit 100
    ) as candidate;
  return v_result;
end;
$function$;

create or replace function public.driver_list_own_settlements()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_result jsonb;
begin
  if not exists (
    select 1
      from public.profiles as p
      join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
      join public.roles as r on r.id = ur.role_id
     where p.id = v_user_id
       and p.account_status = 'active'
       and r.code = 'driver'
  ) then
    raise exception 'An active Driver account is required';
  end if;

  select coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'id', ds.id,
      'booking_ref', b.booking_ref,
      'currency', ds.currency,
      'amount', ds.amount,
      'settlement_status', ds.settlement_status,
      'payout_method', ds.payout_method,
      'payout_reference', ds.payout_reference,
      'created_at', ds.created_at,
      'paid_at', ds.paid_at
    ) order by ds.created_at desc
  ), '[]'::jsonb)
    into v_result
    from (
      select * from public.driver_settlements
       where driver_user_id = v_user_id
       order by created_at desc
       limit 100
    ) as ds
    join public.bookings as b on b.id = ds.booking_id;
  return v_result;
end;
$function$;

revoke all on function public.admin_create_driver_settlement(uuid, numeric)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_pay_driver_settlement(uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_list_driver_settlements()
  from public, anon, authenticated, service_role;
revoke all on function public.admin_list_settlement_candidates()
  from public, anon, authenticated, service_role;
revoke all on function public.driver_list_own_settlements()
  from public, anon, authenticated, service_role;
grant execute on function public.admin_create_driver_settlement(uuid, numeric)
  to authenticated;
grant execute on function public.admin_pay_driver_settlement(uuid, text, text)
  to authenticated;
grant execute on function public.admin_list_driver_settlements()
  to authenticated;
grant execute on function public.admin_list_settlement_candidates()
  to authenticated;
grant execute on function public.driver_list_own_settlements()
  to authenticated;

comment on table public.driver_settlements is
  'One immutable driver earnings settlement per completed assignment; payout is recorded once as an audited status transition.';
comment on function public.admin_create_driver_settlement(uuid, numeric) is
  'Creates an Admin-only pending settlement for a completed assignment, bounded by its accepted quote total.';
comment on function public.admin_pay_driver_settlement(uuid, text, text) is
  'Records one Admin-only payout transition and appends the linked booking event.';
comment on function public.driver_list_own_settlements() is
  'Returns only the authenticated active driver account’s settlement history.';
comment on function public.admin_list_settlement_candidates() is
  'Lists recent completed assignments that do not yet have a driver settlement.';
