create table public.driver_hire_offers (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  assignment_id uuid not null references public.booking_assignments (id) on delete restrict,
  booking_id uuid not null references public.bookings (id) on delete restrict,
  driver_user_id uuid not null references public.profiles (id) on delete restrict,
  revision integer not null check (revision > 0),
  amount numeric(12, 2) not null check (amount > 0),
  currency char(3) not null check (currency in ('LKR', 'USD')),
  offer_status text not null default 'offered'
    check (offer_status in ('offered', 'accepted', 'declined')),
  is_current boolean not null default true,
  supersedes_offer_id uuid,
  superseded_at timestamptz,
  request_id uuid not null,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  responded_by uuid references public.profiles (id) on delete restrict,
  responded_at timestamptz,
  constraint driver_hire_offers_assignment_revision_unique unique (assignment_id, revision),
  constraint driver_hire_offers_id_assignment_unique unique (id, assignment_id),
  constraint driver_hire_offers_supersedes_assignment_fk
    foreign key (supersedes_offer_id, assignment_id)
    references public.driver_hire_offers (id, assignment_id) on delete restrict,
  constraint driver_hire_offers_request_unique unique (created_by, request_id),
  constraint driver_hire_offers_response_consistency check (
    (offer_status = 'offered' and responded_by is null and responded_at is null)
    or (offer_status in ('accepted', 'declined') and responded_by is not null and responded_at is not null)
  ),
  constraint driver_hire_offers_not_self_superseding check (supersedes_offer_id is distinct from id),
  constraint driver_hire_offers_supersession_consistency check (
    (is_current and superseded_at is null)
    or (not is_current and superseded_at is not null)
  )
);

create unique index driver_hire_offers_one_current_per_assignment
  on public.driver_hire_offers (assignment_id) where is_current;
create index driver_hire_offers_driver_idx
  on public.driver_hire_offers (driver_user_id, created_at desc);

create table public.driver_hire_payouts (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  assignment_id uuid not null references public.booking_assignments (id) on delete restrict,
  booking_id uuid not null references public.bookings (id) on delete restrict,
  driver_user_id uuid not null references public.profiles (id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  currency char(3) not null check (currency in ('LKR', 'USD')),
  payment_date date not null,
  payment_method text not null check (payment_method in ('cash', 'bank_transfer')),
  payment_reference text check (
    payment_reference is null or pg_catalog.char_length(payment_reference) <= 160
  ),
  request_id uuid not null,
  recorded_by uuid not null references public.profiles (id) on delete restrict,
  recorded_at timestamptz not null default pg_catalog.now(),
  constraint driver_hire_payouts_request_unique unique (recorded_by, request_id)
);

create index driver_hire_payouts_assignment_idx
  on public.driver_hire_payouts (assignment_id, payment_date desc, recorded_at desc);
create index driver_hire_payouts_driver_idx
  on public.driver_hire_payouts (driver_user_id, payment_date desc, recorded_at desc);

alter table public.driver_hire_offers enable row level security;
alter table public.driver_hire_payouts enable row level security;
revoke all on public.driver_hire_offers, public.driver_hire_payouts
  from public, anon, authenticated, service_role;

create or replace function private.guard_driver_hire_offer()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_assignment public.booking_assignments%rowtype;
  v_is_admin boolean;
  v_is_driver boolean;
begin
  select ba.* into v_assignment
    from public.booking_assignments as ba
   where ba.id = new.assignment_id;
  if not found
     or new.booking_id is distinct from v_assignment.booking_id
     or new.driver_user_id is distinct from v_assignment.driver_user_id
  then
    raise exception 'Driver hire offer must match its assignment';
  end if;

  select exists (
    select 1
      from public.profiles as p
      join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
      join public.roles as r on r.id = ur.role_id
     where p.id = v_actor
       and p.account_status = 'active'
       and r.code in ('admin', 'super_admin')
  ) into v_is_admin;

  if tg_op = 'INSERT' then
    if not v_is_admin
       or new.created_by is distinct from v_actor
       or new.offer_status <> 'offered'
       or not new.is_current
       or new.responded_by is not null
       or new.responded_at is not null
    then
      raise exception 'Only an active Admin may create a current driver hire offer';
    end if;
  else
    if old.id is distinct from new.id
       or old.assignment_id is distinct from new.assignment_id
       or old.booking_id is distinct from new.booking_id
       or old.driver_user_id is distinct from new.driver_user_id
       or old.revision is distinct from new.revision
       or old.amount is distinct from new.amount
       or old.currency is distinct from new.currency
       or old.supersedes_offer_id is distinct from new.supersedes_offer_id
       or old.request_id is distinct from new.request_id
       or old.created_by is distinct from new.created_by
       or old.created_at is distinct from new.created_at
    then
      raise exception 'Driver hire offer terms are immutable';
    end if;

    if old.is_current and not new.is_current
       and old.superseded_at is null
       and new.superseded_at is not null
       and new.offer_status is not distinct from old.offer_status
       and new.responded_by is not distinct from old.responded_by
       and new.responded_at is not distinct from old.responded_at
       and v_is_admin
    then
      return new;
    end if;

    if old.is_current
       and new.is_current
       and old.offer_status = 'offered'
       and new.offer_status in ('accepted', 'declined')
       and new.responded_by is not distinct from v_actor
       and new.responded_at is not null
    then
      select exists (
        select 1
          from public.profiles as p
          join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
          join public.roles as r on r.id = ur.role_id
         where p.id = v_actor
           and p.id = old.driver_user_id
           and p.account_status = 'active'
           and r.code = 'driver'
      ) into v_is_driver;
      if v_is_driver then
        return new;
      end if;
    end if;

    raise exception 'Driver hire offer can only be superseded by Admin or answered by its driver';
  end if;
  return new;
end;
$function$;

create or replace function private.guard_driver_hire_payout()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_assignment public.booking_assignments%rowtype;
begin
  if tg_op <> 'INSERT' then
    raise exception 'Driver payout history is immutable';
  end if;

  select ba.* into v_assignment
    from public.booking_assignments as ba
   where ba.id = new.assignment_id;
  if not found
     or new.booking_id is distinct from v_assignment.booking_id
     or new.driver_user_id is distinct from v_assignment.driver_user_id
     or new.recorded_by is distinct from v_actor
     or not exists (
       select 1
         from public.profiles as p
         join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
         join public.roles as r on r.id = ur.role_id
        where p.id = v_actor
          and p.account_status = 'active'
          and r.code in ('admin', 'super_admin')
     )
  then
    raise exception 'Only an active Admin may record a payout matching its assignment';
  end if;
  return new;
end;
$function$;

create or replace function private.reject_driver_hire_payout_change()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  raise exception 'Driver payout history is immutable';
end;
$function$;

create or replace function private.reject_driver_hire_offer_delete()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  raise exception 'Driver hire offer history is immutable';
end;
$function$;

create or replace function private.record_driver_hire_event()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if tg_table_name = 'driver_hire_offers' then
    if tg_op = 'INSERT' then
      insert into public.booking_events (booking_id, event_type, actor_user_id, details)
      values (
        new.booking_id,
        'driver_hire_offer_issued',
        new.created_by,
        pg_catalog.jsonb_build_object(
          'offer_id', new.id,
          'assignment_id', new.assignment_id,
          'revision', new.revision,
          'amount', new.amount,
          'currency', new.currency,
          'supersedes_offer_id', new.supersedes_offer_id
        )
      );
    elsif old.offer_status is distinct from new.offer_status then
      insert into public.booking_events (
        booking_id, event_type, from_status, to_status, actor_user_id, details
      )
      values (
        new.booking_id,
        case new.offer_status
          when 'accepted' then 'driver_hire_offer_accepted'
          else 'driver_hire_offer_declined'
        end,
        old.offer_status,
        new.offer_status,
        new.responded_by,
        pg_catalog.jsonb_build_object(
          'offer_id', new.id,
          'assignment_id', new.assignment_id,
          'revision', new.revision,
          'amount', new.amount,
          'currency', new.currency
        )
      );
    end if;
  else
    insert into public.booking_events (booking_id, event_type, actor_user_id, details)
    values (
      new.booking_id,
      'driver_hire_payout_recorded',
      new.recorded_by,
      pg_catalog.jsonb_build_object(
        'payout_id', new.id,
        'assignment_id', new.assignment_id,
        'driver_user_id', new.driver_user_id,
        'amount', new.amount,
        'currency', new.currency,
        'payment_date', new.payment_date,
        'payment_method', new.payment_method,
        'payment_reference', new.payment_reference
      )
    );
  end if;
  return null;
end;
$function$;

revoke all on function private.guard_driver_hire_offer()
  from public, anon, authenticated, service_role;
revoke all on function private.guard_driver_hire_payout()
  from public, anon, authenticated, service_role;
revoke all on function private.reject_driver_hire_payout_change()
  from public, anon, authenticated, service_role;
revoke all on function private.reject_driver_hire_offer_delete()
  from public, anon, authenticated, service_role;
revoke all on function private.record_driver_hire_event()
  from public, anon, authenticated, service_role;

create trigger driver_hire_offers_guard
before insert or update on public.driver_hire_offers
for each row execute function private.guard_driver_hire_offer();
create trigger driver_hire_offers_record_event
after insert or update on public.driver_hire_offers
for each row execute function private.record_driver_hire_event();
create trigger driver_hire_offers_no_delete
before delete on public.driver_hire_offers
for each row execute function private.reject_driver_hire_offer_delete();
create trigger driver_hire_payouts_guard
before insert on public.driver_hire_payouts
for each row execute function private.guard_driver_hire_payout();
create trigger driver_hire_payouts_record_event
after insert on public.driver_hire_payouts
for each row execute function private.record_driver_hire_event();
create trigger driver_hire_payouts_no_change
before update or delete on public.driver_hire_payouts
for each row execute function private.reject_driver_hire_payout_change();

create or replace function public.admin_create_driver_hire_offer(
  p_assignment_id uuid,
  p_amount numeric,
  p_currency text,
  p_request_id uuid
)
returns table (offer_id uuid, created boolean)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_booking_id uuid;
  v_driver_user_id uuid;
  v_assignment_status text;
  v_booking_status text;
  v_revision integer;
  v_previous public.driver_hire_offers%rowtype;
  v_offer_id uuid;
  v_duplicate public.driver_hire_offers%rowtype;
  v_paid_total numeric(12, 2);
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
    raise exception 'Only an active Admin may issue driver hire offers';
  end if;
  if p_amount is null or p_amount <= 0
     or p_amount > 9999999999.99
     or p_amount <> pg_catalog.trunc(p_amount, 2)
     or p_currency is null
     or p_currency not in ('LKR', 'USD')
     or p_request_id is null
  then
    raise exception 'Driver hire offer details are invalid';
  end if;

  select ba.booking_id, ba.driver_user_id, ba.assignment_status, b.booking_status
    into v_booking_id, v_driver_user_id, v_assignment_status, v_booking_status
    from public.booking_assignments as ba
    join public.bookings as b on b.id = ba.booking_id
   where ba.id = p_assignment_id
   for update of ba;
  if not found
     or v_assignment_status not in ('offered', 'accepted', 'in_progress', 'completed')
     or v_booking_status = 'cancelled'
     or exists (
       select 1
         from public.driver_settlements as ds
        where ds.assignment_id = p_assignment_id
     )
  then
    raise exception 'An active booking assignment is required';
  end if;

  select dho.* into v_duplicate
    from public.driver_hire_offers as dho
   where dho.created_by = v_actor and dho.request_id = p_request_id;
  if found then
    if v_duplicate.assignment_id = p_assignment_id
       and v_duplicate.amount = p_amount
       and v_duplicate.currency = p_currency
    then
      return query select v_duplicate.id, false;
      return;
    end if;
    raise exception 'Driver hire offer request identifier was already used';
  end if;

  select coalesce(pg_catalog.sum(dhp.amount), 0)::numeric(12, 2)
    into v_paid_total
    from public.driver_hire_payouts as dhp
   where dhp.assignment_id = p_assignment_id;
  if v_paid_total > 0 and exists (
    select 1
      from public.driver_hire_payouts as dhp
     where dhp.assignment_id = p_assignment_id
       and dhp.currency <> p_currency
  ) then
    raise exception 'Driver hire currency cannot change after a payout has been recorded';
  end if;
  if p_amount < v_paid_total then
    raise exception 'The revised hire offer cannot be less than payouts already recorded';
  end if;

  select dho.* into v_previous
    from public.driver_hire_offers as dho
   where dho.assignment_id = p_assignment_id
     and dho.is_current
   for update;
  if found then
    if v_previous.amount = p_amount and v_previous.currency = p_currency
       and v_previous.offer_status in ('offered', 'accepted')
    then
      return query select v_previous.id, false;
      return;
    end if;
    update public.driver_hire_offers
       set is_current = false,
           superseded_at = pg_catalog.clock_timestamp()
     where id = v_previous.id;
  end if;

  select coalesce(pg_catalog.max(dho.revision), 0) + 1
    into v_revision
    from public.driver_hire_offers as dho
   where dho.assignment_id = p_assignment_id;

  insert into public.driver_hire_offers (
    assignment_id, booking_id, driver_user_id, revision, amount, currency,
    supersedes_offer_id, request_id, created_by
  )
  values (
    p_assignment_id, v_booking_id, v_driver_user_id, v_revision, p_amount, p_currency,
    v_previous.id, p_request_id, v_actor
  )
  returning id into v_offer_id;
  return query select v_offer_id, true;
end;
$function$;

create or replace function public.driver_respond_hire_offer(
  p_offer_id uuid,
  p_accept boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_offer public.driver_hire_offers%rowtype;
begin
  if not exists (
    select 1
      from public.profiles as p
      join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
      join public.roles as r on r.id = ur.role_id
     where p.id = v_actor
       and p.account_status = 'active'
       and r.code = 'driver'
  ) then
    raise exception 'An active Driver account is required';
  end if;
  select dho.* into v_offer
    from public.driver_hire_offers as dho
    join public.booking_assignments as ba on ba.id = dho.assignment_id
    join public.bookings as b
      on b.id = ba.booking_id
     and b.booking_status <> 'cancelled'
   where dho.id = p_offer_id
     and dho.driver_user_id = v_actor
     and dho.is_current
     and ba.driver_user_id = v_actor
     and ba.assignment_status not in ('declined', 'released')
   for update of dho;
  if not found or v_offer.offer_status <> 'offered' or p_accept is null then
    raise exception 'This driver hire offer is no longer available';
  end if;

  update public.driver_hire_offers
     set offer_status = case when p_accept then 'accepted' else 'declined' end,
         responded_by = v_actor,
         responded_at = pg_catalog.now()
   where id = p_offer_id and is_current and offer_status = 'offered';
  if not found then
    raise exception 'This driver hire offer has already been answered';
  end if;
end;
$function$;

create or replace function public.admin_record_driver_hire_payout(
  p_assignment_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_payment_method text,
  p_payment_reference text,
  p_request_id uuid
)
returns table (payout_id uuid, created boolean)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_booking_id uuid;
  v_driver_user_id uuid;
  v_offer public.driver_hire_offers%rowtype;
  v_paid_total numeric(12, 2);
  v_payout_id uuid;
  v_duplicate public.driver_hire_payouts%rowtype;
  v_reference text := nullif(pg_catalog.btrim(coalesce(p_payment_reference, '')), '');
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
  if p_amount is null or p_amount <= 0
     or p_amount > 9999999999.99
     or p_amount <> pg_catalog.trunc(p_amount, 2)
     or p_payment_date is null
     or p_payment_method is null
     or p_payment_method not in ('cash', 'bank_transfer')
     or pg_catalog.char_length(coalesce(p_payment_reference, '')) > 160
     or p_request_id is null
  then
    raise exception 'Driver payout details are invalid';
  end if;

  select ba.booking_id, ba.driver_user_id into v_booking_id, v_driver_user_id
    from public.booking_assignments as ba
   where ba.id = p_assignment_id
   for update;
  if not found then
    raise exception 'Driver assignment is unavailable';
  end if;

  select dhp.* into v_duplicate
    from public.driver_hire_payouts as dhp
   where dhp.recorded_by = v_actor and dhp.request_id = p_request_id;
  if found then
    if v_duplicate.assignment_id = p_assignment_id
       and v_duplicate.amount = p_amount
       and v_duplicate.payment_date = p_payment_date
       and v_duplicate.payment_method = p_payment_method
       and v_duplicate.payment_reference is not distinct from v_reference
    then
      return query select v_duplicate.id, false;
      return;
    end if;
    raise exception 'Driver payout request identifier was already used';
  end if;

  select dho.* into v_offer
    from public.driver_hire_offers as dho
   where dho.assignment_id = p_assignment_id
     and dho.is_current
   for update;
  if not found or v_offer.offer_status <> 'accepted' then
    raise exception 'The current driver hire offer must be accepted before payout';
  end if;

  select coalesce(pg_catalog.sum(dhp.amount), 0)::numeric(12, 2)
    into v_paid_total
    from public.driver_hire_payouts as dhp
   where dhp.assignment_id = p_assignment_id;
  if p_amount > v_offer.amount - v_paid_total then
    raise exception 'Driver payout exceeds the outstanding hire balance';
  end if;

  insert into public.driver_hire_payouts (
    assignment_id, booking_id, driver_user_id, amount, currency, payment_date,
    payment_method, payment_reference, request_id, recorded_by
  )
  values (
    p_assignment_id, v_booking_id, v_driver_user_id, p_amount, v_offer.currency,
    p_payment_date, p_payment_method, v_reference, p_request_id, v_actor
  )
  returning id into v_payout_id;
  return query select v_payout_id, true;
end;
$function$;

create or replace function public.admin_list_driver_hire_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_candidates jsonb;
  v_offers jsonb;
  v_history jsonb;
  v_payouts jsonb;
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
    raise exception 'Only an active Admin may view driver hire information';
  end if;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'assignment_id', ba.id,
    'booking_ref', b.booking_ref,
    'driver_user_id', ba.driver_user_id,
    'driver_name', p.full_name,
    'assignment_status', ba.assignment_status,
    'current_offer_id', dho.id,
    'current_offer_status', dho.offer_status,
    'current_amount', dho.amount,
    'current_currency', dho.currency
  ) order by ba.assigned_at desc), '[]'::jsonb)
    into v_candidates
    from public.booking_assignments as ba
    join public.bookings as b on b.id = ba.booking_id
    join public.profiles as p on p.id = ba.driver_user_id
    left join public.driver_hire_offers as dho
      on dho.assignment_id = ba.id and dho.is_current
   where ba.assignment_status in ('offered', 'accepted', 'in_progress', 'completed')
     and b.booking_status <> 'cancelled'
     and not exists (
       select 1
         from public.driver_settlements as ds
        where ds.assignment_id = ba.id
     );

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', dho.id,
    'assignment_id', dho.assignment_id,
    'booking_ref', b.booking_ref,
    'driver_user_id', dho.driver_user_id,
    'driver_name', p.full_name,
    'revision', dho.revision,
    'amount', dho.amount,
    'currency', dho.currency,
    'offer_status', dho.offer_status,
    'is_current', dho.is_current,
    'created_at', dho.created_at,
    'responded_at', dho.responded_at,
    'paid_total', coalesce((
      select pg_catalog.sum(dhp.amount)
        from public.driver_hire_payouts as dhp
       where dhp.assignment_id = dho.assignment_id
    ), 0),
    'outstanding', case
      when dho.is_current and dho.offer_status = 'accepted' then
        dho.amount - coalesce((
          select pg_catalog.sum(dhp.amount)
            from public.driver_hire_payouts as dhp
           where dhp.assignment_id = dho.assignment_id
        ), 0)
      else null
    end
  ) order by dho.created_at desc), '[]'::jsonb)
    into v_history
    from public.driver_hire_offers as dho
    join public.bookings as b on b.id = dho.booking_id
    join public.profiles as p on p.id = dho.driver_user_id;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', dhp.id,
    'assignment_id', dhp.assignment_id,
    'booking_ref', b.booking_ref,
    'driver_user_id', dhp.driver_user_id,
    'driver_name', p.full_name,
    'amount', dhp.amount,
    'currency', dhp.currency,
    'payment_date', dhp.payment_date,
    'payment_method', dhp.payment_method,
    'payment_reference', dhp.payment_reference,
    'recorded_by', dhp.recorded_by,
    'recorded_at', dhp.recorded_at
  ) order by dhp.payment_date desc, dhp.recorded_at desc), '[]'::jsonb)
    into v_payouts
    from public.driver_hire_payouts as dhp
    join public.bookings as b on b.id = dhp.booking_id
    join public.profiles as p on p.id = dhp.driver_user_id;

  select coalesce(pg_catalog.jsonb_agg(offer_value), '[]'::jsonb)
    into v_offers
    from jsonb_array_elements(v_history) as offers(offer_value)
   where offer_value ->> 'is_current' = 'true';

  return pg_catalog.jsonb_build_object(
    'candidates', v_candidates,
    'offers', v_offers,
    'offer_history', v_history,
    'payouts', v_payouts
  );
end;
$function$;

create or replace function public.driver_list_own_hire_finance()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_offers jsonb;
  v_payouts jsonb;
begin
  if not exists (
    select 1
      from public.profiles as p
      join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
      join public.roles as r on r.id = ur.role_id
     where p.id = v_actor
       and p.account_status = 'active'
       and r.code = 'driver'
  ) then
    raise exception 'An active Driver account is required';
  end if;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', dho.id,
    'assignment_id', dho.assignment_id,
    'booking_ref', b.booking_ref,
    'revision', dho.revision,
    'amount', dho.amount,
    'currency', dho.currency,
    'offer_status', dho.offer_status,
    'is_current', dho.is_current,
    'created_at', dho.created_at,
    'responded_at', dho.responded_at,
    'paid_total', coalesce((
      select pg_catalog.sum(dhp.amount)
        from public.driver_hire_payouts as dhp
       where dhp.assignment_id = dho.assignment_id
    ), 0),
    'outstanding', case
      when dho.is_current and dho.offer_status = 'accepted' then
        dho.amount - coalesce((
          select pg_catalog.sum(dhp.amount)
            from public.driver_hire_payouts as dhp
           where dhp.assignment_id = dho.assignment_id
        ), 0)
      else null
    end
  ) order by dho.created_at desc), '[]'::jsonb)
    into v_offers
    from public.driver_hire_offers as dho
    join public.bookings as b on b.id = dho.booking_id
   where dho.driver_user_id = v_actor;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', dhp.id,
    'assignment_id', dhp.assignment_id,
    'booking_ref', b.booking_ref,
    'amount', dhp.amount,
    'currency', dhp.currency,
    'payment_date', dhp.payment_date,
    'payment_method', dhp.payment_method,
    'payment_reference', dhp.payment_reference,
    'recorded_at', dhp.recorded_at
  ) order by dhp.payment_date desc, dhp.recorded_at desc), '[]'::jsonb)
    into v_payouts
    from public.driver_hire_payouts as dhp
    join public.bookings as b on b.id = dhp.booking_id
   where dhp.driver_user_id = v_actor;

  return pg_catalog.jsonb_build_object('offers', v_offers, 'payouts', v_payouts);
end;
$function$;

revoke all on function public.admin_create_driver_hire_offer(uuid, numeric, text, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.driver_respond_hire_offer(uuid, boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_record_driver_hire_payout(uuid, numeric, date, text, text, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_list_driver_hire_data()
  from public, anon, authenticated, service_role;
revoke all on function public.driver_list_own_hire_finance()
  from public, anon, authenticated, service_role;
grant execute on function public.admin_create_driver_hire_offer(uuid, numeric, text, uuid)
  to authenticated;
grant execute on function public.driver_respond_hire_offer(uuid, boolean)
  to authenticated;
grant execute on function public.admin_record_driver_hire_payout(uuid, numeric, date, text, text, uuid)
  to authenticated;
grant execute on function public.admin_list_driver_hire_data()
  to authenticated;
grant execute on function public.driver_list_own_hire_finance()
  to authenticated;

comment on table public.driver_hire_offers is
  'Append-only revisions of driver compensation offers; only the current offer can be answered.';
comment on table public.driver_hire_payouts is
  'Immutable partial driver payouts recorded separately from customer payments and legacy settlements.';
comment on function public.admin_create_driver_hire_offer(uuid, numeric, text, uuid) is
  'Creates or revises an assignment hire offer with an Admin request key and preserves every prior revision.';
comment on function public.admin_record_driver_hire_payout(uuid, numeric, date, text, text, uuid) is
  'Records an idempotent partial payout against the accepted current hire offer and locks the assignment for balance safety.';
comment on function public.driver_respond_hire_offer(uuid, boolean) is
  'Allows only the assigned active driver to accept or decline their current hire offer.';
