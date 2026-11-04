create table public.payment_claims (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null,
  quote_id uuid not null,
  amount numeric(12, 2) not null,
  currency char(3) not null,
  method text not null,
  customer_reference text,
  claim_status text not null default 'submitted',
  submitted_by uuid references public.profiles (id) on delete set null,
  submitted_at timestamptz not null default pg_catalog.now(),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  constraint payment_claims_quote_booking_currency_fk
    foreign key (quote_id, booking_id, currency)
    references public.booking_quotes (id, booking_id, currency)
    on delete restrict,
  constraint payment_claims_identity_unique
    unique (id, booking_id, quote_id, currency),
  constraint payment_claims_amount_positive check (amount > 0),
  constraint payment_claims_currency_check check (currency in ('LKR', 'USD')),
  constraint payment_claims_method_check check (method in ('cash', 'bank_transfer')),
  constraint payment_claims_status_check
    check (claim_status in ('submitted', 'verified', 'rejected')),
  constraint payment_claims_review_consistency check (
    (claim_status = 'submitted' and reviewed_at is null)
    or (claim_status in ('verified', 'rejected') and reviewed_at is not null)
  )
);

create index payment_claims_booking_submitted_idx
  on public.payment_claims (booking_id, submitted_at desc);
create index payment_claims_quote_idx
  on public.payment_claims (quote_id, booking_id, currency);
create index payment_claims_status_submitted_idx
  on public.payment_claims (claim_status, submitted_at);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null,
  quote_id uuid not null,
  claim_id uuid,
  entry_type text not null,
  original_payment_id uuid,
  amount numeric(12, 2) not null,
  currency char(3) not null,
  method text not null,
  provider_reference text,
  verified_by uuid not null references public.profiles (id) on delete restrict,
  verified_at timestamptz not null default pg_catalog.now(),
  created_at timestamptz not null default pg_catalog.now(),
  constraint payments_quote_booking_currency_fk
    foreign key (quote_id, booking_id, currency)
    references public.booking_quotes (id, booking_id, currency)
    on delete restrict,
  constraint payments_claim_consistency_fk
    foreign key (claim_id, booking_id, quote_id, currency)
    references public.payment_claims (id, booking_id, quote_id, currency)
    on delete restrict,
  constraint payments_original_booking_quote_currency_fk
    foreign key (original_payment_id, booking_id, quote_id, currency)
    references public.payments (id, booking_id, quote_id, currency)
    on delete restrict,
  constraint payments_identity_booking_quote_currency_unique
    unique (id, booking_id, quote_id, currency),
  constraint payments_amount_positive check (amount > 0),
  constraint payments_currency_check check (currency in ('LKR', 'USD')),
  constraint payments_method_check check (method in ('cash', 'bank_transfer')),
  constraint payments_entry_type_check check (entry_type in ('receipt', 'refund')),
  constraint payments_receipt_refund_reference_check
    check (
      (entry_type = 'receipt' and original_payment_id is null)
      or (entry_type = 'refund' and original_payment_id is not null and claim_id is null)
    )
);

create unique index payments_claim_one_verified_entry
  on public.payments (claim_id)
  where claim_id is not null;
create index payments_booking_created_idx
  on public.payments (booking_id, created_at desc);
create index payments_quote_idx
  on public.payments (quote_id, booking_id, currency);
create index payments_original_payment_idx
  on public.payments (original_payment_id)
  where original_payment_id is not null;

create or replace function private.validate_payment_claim()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_quote_status text;
  v_quote_total numeric(12, 2);
  v_booking_customer_user_id uuid;
begin
  if tg_op = 'UPDATE' then
    if old.claim_status <> 'submitted'
       or new.booking_id is distinct from old.booking_id
       or new.quote_id is distinct from old.quote_id
       or new.amount is distinct from old.amount
       or new.currency is distinct from old.currency
       or new.method is distinct from old.method
       or new.customer_reference is distinct from old.customer_reference
       or new.submitted_by is distinct from old.submitted_by
       or new.submitted_at is distinct from old.submitted_at
       or new.claim_status not in ('verified', 'rejected')
       or new.reviewed_at is null
       or new.reviewed_by is distinct from (select auth.uid())
    then
      raise exception 'Payment claim terms are immutable and may be reviewed only once';
    end if;

    if not exists (
      select 1
        from public.profiles as p
        join public.user_roles as ur
          on ur.user_id = p.id
         and ur.revoked_at is null
        join public.roles as r on r.id = ur.role_id
       where p.id = new.reviewed_by
         and p.account_status = 'active'
         and r.code in ('admin', 'super_admin')
    ) then
      raise exception 'Only an active Admin or Super Admin may review a payment claim';
    end if;
  else
    if new.claim_status <> 'submitted'
       or new.reviewed_by is not null
       or new.reviewed_at is not null
       or new.review_note is not null
    then
      raise exception 'New payment claims must begin in submitted status';
    end if;

    select q.quote_status, q.total, b.customer_user_id
      into v_quote_status, v_quote_total, v_booking_customer_user_id
      from public.booking_quotes as q
      join public.bookings as b on b.id = q.booking_id
     where q.id = new.quote_id
       and q.booking_id = new.booking_id
       and q.currency = new.currency;

    if v_quote_status is distinct from 'accepted'
       or new.amount > v_quote_total
       or new.submitted_by is distinct from v_booking_customer_user_id
       or ((select auth.uid()) is not null
           and new.submitted_by is distinct from (select auth.uid()))
    then
      raise exception 'Payment claim must match its owner and accepted quote and not exceed the total';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function private.validate_payment_relationships()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_quote_status text;
  v_quote_total numeric(12, 2);
  v_original_type text;
  v_prior_refunds numeric(12, 2);
  v_prior_net_payments numeric(12, 2);
  v_original_amount numeric(12, 2);
  v_claim_status text;
  v_claim_amount numeric(12, 2);
  v_claim_method text;
begin
  select q.quote_status, q.total
    into v_quote_status, v_quote_total
    from public.booking_quotes as q
   where q.id = new.quote_id
     and q.booking_id = new.booking_id
     and q.currency = new.currency
   for update;

  if v_quote_status is distinct from 'accepted' then
    raise exception 'Payments must reference the accepted quote for the booking';
  end if;

  if not exists (
    select 1
      from public.profiles as p
      join public.user_roles as ur
        on ur.user_id = p.id
       and ur.revoked_at is null
      join public.roles as r on r.id = ur.role_id
     where p.id = new.verified_by
       and p.account_status = 'active'
       and r.code in ('admin', 'super_admin')
  ) then
    raise exception 'Only an active Admin or Super Admin may record a verified payment';
  end if;
  if new.verified_by is distinct from (select auth.uid()) then
    raise exception 'Payment verifier must match the authenticated administrator';
  end if;
  if new.entry_type = 'receipt' and new.claim_id is not null then
    select pc.claim_status, pc.amount, pc.method
      into v_claim_status, v_claim_amount, v_claim_method
      from public.payment_claims as pc
     where pc.id = new.claim_id
       and pc.booking_id = new.booking_id
       and pc.quote_id = new.quote_id
       and pc.currency = new.currency;

    if v_claim_status is distinct from 'verified'
       or new.amount is distinct from v_claim_amount
       or new.method is distinct from v_claim_method
    then
      raise exception 'Receipt must match its verified payment claim';
    end if;
  end if;

  if new.entry_type = 'refund' then
    select p.entry_type, p.amount
      into v_original_type, v_original_amount
      from public.payments as p
     where p.id = new.original_payment_id
       and p.booking_id = new.booking_id
       and p.quote_id = new.quote_id
       and p.currency = new.currency
     for update;

    if not found or v_original_type <> 'receipt' then
      raise exception 'A refund must reference a receipt on the same booking, quote, and currency';
    end if;

    select coalesce(sum(p.amount), 0)::numeric(12, 2)
      into v_prior_refunds
      from public.payments as p
     where p.original_payment_id = new.original_payment_id
       and p.entry_type = 'refund';

    if v_prior_refunds + new.amount > v_original_amount then
      raise exception 'Refund amount exceeds the remaining refundable balance';
    end if;
  else
    select coalesce(
      sum(case when p.entry_type = 'receipt' then p.amount else -p.amount end),
      0
    )::numeric(12, 2)
      into v_prior_net_payments
      from public.payments as p
     where p.booking_id = new.booking_id
       and p.quote_id = new.quote_id;

    if v_prior_net_payments + new.amount > v_quote_total then
      raise exception 'Net receipts cannot exceed the accepted quote total';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function private.assert_payment_claim_ledger_consistency()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_claim_id uuid;
  v_claim_status text;
  v_has_payment boolean;
begin
  if tg_table_name = 'payment_claims' then
    v_claim_id := coalesce(new.id, old.id);
  elsif tg_op = 'DELETE' then
    v_claim_id := old.claim_id;
  else
    v_claim_id := new.claim_id;
  end if;

  if v_claim_id is null then
    return null;
  end if;

  select pc.claim_status
    into v_claim_status
    from public.payment_claims as pc
   where pc.id = v_claim_id;

  select exists (
    select 1 from public.payments as p where p.claim_id = v_claim_id
  )
  into v_has_payment;

  if v_claim_status = 'verified' and not v_has_payment then
    raise exception 'A verified claim must have a matching immutable payment entry';
  end if;
  if v_has_payment and v_claim_status is distinct from 'verified' then
    raise exception 'A payment entry linked to a claim requires verified claim status';
  end if;

  return null;
end;
$function$;

create or replace function private.reject_payment_ledger_mutation()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  raise exception 'Verified payment ledger is append-only';
end;
$function$;

create or replace function private.record_payment_claim_event()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if tg_op = 'INSERT' then
    insert into public.booking_events (
      booking_id, event_type, actor_user_id, details
    )
    values (
      new.booking_id,
      'payment_claim_submitted',
      new.submitted_by,
      pg_catalog.jsonb_build_object('claim_id', new.id)
    );
  elsif new.claim_status is distinct from old.claim_status then
    insert into public.booking_events (
      booking_id, event_type, from_status, to_status, actor_user_id, details
    )
    values (
      new.booking_id,
      'payment_claim_status_changed',
      old.claim_status,
      new.claim_status,
      new.reviewed_by,
      pg_catalog.jsonb_build_object('claim_id', new.id)
    );
  end if;
  return null;
end;
$function$;

create or replace function private.record_payment_event()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  insert into public.booking_events (
    booking_id, event_type, actor_user_id, details
  )
  values (
    new.booking_id,
    case when new.entry_type = 'refund' then 'payment_refund_recorded'
         else 'payment_receipt_recorded'
    end,
    new.verified_by,
    pg_catalog.jsonb_build_object(
      'payment_id', new.id,
      'entry_type', new.entry_type,
      'amount', new.amount,
      'currency', new.currency
    )
  );
  return null;
end;
$function$;

revoke all on function private.validate_payment_relationships()
  from public, anon, authenticated, service_role;
revoke all on function private.validate_payment_claim()
  from public, anon, authenticated, service_role;
revoke all on function private.assert_payment_claim_ledger_consistency()
  from public, anon, authenticated, service_role;
revoke all on function private.reject_payment_ledger_mutation()
  from public, anon, authenticated, service_role;
revoke all on function private.record_payment_claim_event()
  from public, anon, authenticated, service_role;
revoke all on function private.record_payment_event()
  from public, anon, authenticated, service_role;

create trigger payment_claims_validate
before insert or update on public.payment_claims
for each row execute function private.validate_payment_claim();
create trigger payment_claims_record_event
after insert or update on public.payment_claims
for each row execute function private.record_payment_claim_event();
create trigger payment_claims_no_delete
before delete on public.payment_claims
for each row execute function private.reject_append_only_mutation();
create trigger payments_validate_relationships
before insert on public.payments
for each row execute function private.validate_payment_relationships();
create trigger payments_append_only
before update or delete on public.payments
for each row execute function private.reject_payment_ledger_mutation();
create trigger payments_record_event
after insert on public.payments
for each row execute function private.record_payment_event();
create constraint trigger payment_claims_ledger_consistency
after insert or update on public.payment_claims
deferrable initially deferred
for each row execute function private.assert_payment_claim_ledger_consistency();
create constraint trigger payments_claim_ledger_consistency
after insert on public.payments
deferrable initially deferred
for each row execute function private.assert_payment_claim_ledger_consistency();

alter table public.payment_claims enable row level security;
alter table public.payments enable row level security;

create policy payment_claims_customer_read_own
  on public.payment_claims for select to authenticated
  using (private.is_booking_owner(booking_id));
create policy payments_customer_read_own
  on public.payments for select to authenticated
  using (private.is_booking_owner(booking_id));

revoke all on public.payment_claims, public.payments
  from public, anon, authenticated, service_role;
grant select (
  id, booking_id, quote_id, amount, currency, method, claim_status,
  submitted_at, reviewed_at
) on public.payment_claims to authenticated;
grant select (
  id, booking_id, quote_id, entry_type, amount, currency, method,
  verified_at, created_at
) on public.payments to authenticated;

comment on table public.payment_claims is
  'Customer-submitted payment assertions; a claim is not a verified payment.';
comment on table public.payments is
  'Immutable verified receipt/refund ledger; corrections are compensating entries.';
comment on function private.validate_payment_relationships() is
  'Validates accepted quote relationships, payment totals, and refund balance under row locks.';
comment on function private.validate_payment_claim() is
  'Keeps claim terms immutable and limits claim review to an active Admin or Super Admin.';
comment on function private.assert_payment_claim_ledger_consistency() is
  'Deferred check requiring verified claims and linked immutable receipt entries to agree.';
comment on function private.reject_payment_ledger_mutation() is
  'Rejects updates and deletes to the verified receipt/refund ledger.';
comment on function private.record_payment_claim_event() is
  'Appends booking history for claim submission and one-time review.';
comment on function private.record_payment_event() is
  'Appends booking history for every verified receipt or refund ledger entry.';
