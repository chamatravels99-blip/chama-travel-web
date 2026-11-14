create sequence private.customer_receipt_number_seq;
revoke all on sequence private.customer_receipt_number_seq
  from public, anon, authenticated, service_role;

alter table public.payments
  add column receipt_number text,
  add column payment_date date,
  add column recording_request_id uuid,
  add constraint payments_receipt_number_check
    check (
      entry_type = 'receipt' or receipt_number is null
    ) not valid,
  add constraint payments_recording_request_receipt_check
    check (recording_request_id is null or entry_type = 'receipt') not valid;

create unique index payments_receipt_number_unique
  on public.payments (receipt_number)
  where receipt_number is not null;
create unique index payments_recording_request_unique
  on public.payments (recording_request_id)
  where recording_request_id is not null;

create or replace function private.prepare_payment_receipt_metadata()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.entry_type = 'receipt' then
    if new.receipt_number is not null then
      raise exception 'Receipt numbers are allocated by the database';
    end if;
    new.receipt_number :=
      'CT-R-' ||
      pg_catalog.to_char(
        pg_catalog.clock_timestamp() at time zone 'Asia/Colombo',
        'YYYY'
      ) ||
      '-' ||
      pg_catalog.nextval('private.customer_receipt_number_seq'::pg_catalog.regclass)::text;
  elsif new.receipt_number is not null or new.recording_request_id is not null then
    raise exception 'Refunds cannot have receipt numbers or receipt request identifiers';
  end if;

  if new.payment_date is null then
    new.payment_date := (pg_catalog.clock_timestamp() at time zone 'Asia/Colombo')::date;
  end if;

  return new;
end;
$function$;

revoke all on function private.prepare_payment_receipt_metadata()
  from public, anon, authenticated, service_role;

create trigger payments_prepare_receipt_metadata
before insert on public.payments
for each row execute function private.prepare_payment_receipt_metadata();

alter table public.payments
  validate constraint payments_receipt_number_check,
  validate constraint payments_recording_request_receipt_check;

grant select (receipt_number, payment_date)
  on public.payments to authenticated;

create or replace function public.admin_list_customer_payment_candidates()
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
      join public.user_roles as ur
        on ur.user_id = p.id and ur.revoked_at is null
      join public.roles as r on r.id = ur.role_id
     where p.id = (select auth.uid())
       and p.account_status = 'active'
       and r.code in ('admin', 'super_admin')
  ) then
    raise exception 'An active Admin is required';
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'booking_id', candidate.booking_id,
        'booking_ref', candidate.booking_ref,
        'customer_name', candidate.customer_name,
        'customer_phone', candidate.customer_phone,
        'quote_id', candidate.quote_id,
        'currency', candidate.currency,
        'total', candidate.total,
        'amount_paid', candidate.amount_paid,
        'balance', candidate.total - candidate.amount_paid
      ) order by candidate.created_at desc
    ),
    '[]'::jsonb
  )
    into v_result
    from (
      select
        b.id as booking_id,
        b.booking_ref,
        b.customer_name,
        b.customer_phone,
        b.created_at,
        q.id as quote_id,
        q.currency,
        q.total,
        coalesce(
          pg_catalog.sum(
            case when p.entry_type = 'receipt' then p.amount else -p.amount end
          ),
          0
        )::numeric(12, 2) as amount_paid
      from public.bookings as b
      join public.booking_quotes as q
        on q.booking_id = b.id and q.quote_status = 'accepted'
      left join public.payments as p
        on p.booking_id = b.id and p.quote_id = q.id
      where b.booking_status in ('confirmed', 'assigned', 'in_progress', 'completed')
      group by b.id, b.booking_ref, b.customer_name, b.customer_phone,
               b.created_at, q.id, q.currency, q.total
      having coalesce(
        pg_catalog.sum(
          case when p.entry_type = 'receipt' then p.amount else -p.amount end
        ),
        0
      ) < q.total
      order by b.created_at desc
      limit 200
    ) as candidate;

  return v_result;
end;
$function$;

create or replace function public.admin_record_customer_payment(
  p_booking_id uuid,
  p_quote_id uuid,
  p_amount numeric(12, 2),
  p_method text,
  p_payment_date date,
  p_reference text,
  p_request_id uuid
)
returns table (payment_id uuid, receipt_number text, created boolean)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_booking_status text;
  v_existing public.payments%rowtype;
  v_currency char(3);
  v_payment_id uuid;
  v_receipt_number text;
  v_reference text := nullif(pg_catalog.btrim(coalesce(p_reference, '')), '');
begin
  if not exists (
    select 1
      from public.profiles as p
      join public.user_roles as ur
        on ur.user_id = p.id and ur.revoked_at is null
      join public.roles as r on r.id = ur.role_id
     where p.id = v_actor
       and p.account_status = 'active'
       and r.code in ('admin', 'super_admin')
  ) then
    raise exception 'An active Admin is required';
  end if;

  if p_booking_id is null
     or p_quote_id is null
     or p_amount is null
     or p_amount <= 0
     or p_method is null
     or p_method not in ('cash', 'bank_transfer')
     or p_payment_date is null
     or p_payment_date > (pg_catalog.clock_timestamp() at time zone 'Asia/Colombo')::date
     or p_request_id is null
     or pg_catalog.char_length(coalesce(p_reference, '')) > 160
  then
    raise exception 'Customer payment details are invalid';
  end if;

  select p.*
    into v_existing
    from public.payments as p
   where p.recording_request_id = p_request_id
   for update;
  if found then
    if v_existing.booking_id is distinct from p_booking_id
       or v_existing.quote_id is distinct from p_quote_id
       or v_existing.amount is distinct from p_amount
       or v_existing.method is distinct from p_method
       or v_existing.payment_date is distinct from p_payment_date
       or v_existing.provider_reference is distinct from v_reference
       or v_existing.verified_by is distinct from v_actor
    then
      raise exception 'Payment request identifier was already used with different details';
    end if;
    return query select v_existing.id, v_existing.receipt_number, false;
    return;
  end if;

  select b.booking_status
    into v_booking_status
    from public.bookings as b
   where b.id = p_booking_id
   for update;
  if not found or v_booking_status not in ('confirmed', 'assigned', 'in_progress', 'completed') then
    raise exception 'An active confirmed booking is required';
  end if;

  select q.currency
    into v_currency
    from public.booking_quotes as q
   where q.id = p_quote_id
     and q.booking_id = p_booking_id
     and q.quote_status = 'accepted'
   for update;
  if not found then
    raise exception 'An accepted booking quote is required';
  end if;

  insert into public.payments (
    booking_id,
    quote_id,
    entry_type,
    amount,
    currency,
    method,
    provider_reference,
    verified_by,
    payment_date,
    recording_request_id
  )
  values (
    p_booking_id,
    p_quote_id,
    'receipt',
    p_amount,
    v_currency,
    p_method,
    v_reference,
    v_actor,
    p_payment_date,
    p_request_id
  )
  returning id, receipt_number
    into v_payment_id, v_receipt_number;

  return query select v_payment_id, v_receipt_number, true;
end;
$function$;

create or replace function public.list_financial_records()
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
      join public.user_roles as ur
        on ur.user_id = p.id and ur.revoked_at is null
      join public.roles as r on r.id = ur.role_id
     where p.id = (select auth.uid())
       and p.account_status = 'active'
       and r.code in ('admin', 'super_admin')
  ) then
    raise exception 'An active Admin is required';
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', p.id,
        'booking_id', p.booking_id,
        'booking_ref', b.booking_ref,
        'quote_id', p.quote_id,
        'entry_type', p.entry_type,
        'original_payment_id', p.original_payment_id,
        'amount', p.amount,
        'currency', p.currency,
        'method', p.method,
        'provider_reference', p.provider_reference,
        'refund_reason', p.refund_reason,
        'receipt_number', p.receipt_number,
        'payment_date', p.payment_date,
        'verified_at', p.verified_at
      ) order by p.created_at desc
    ),
    '[]'::jsonb
  )
    into v_result
    from (
      select * from public.payments
       order by created_at desc
       limit 200
    ) as p
    join public.bookings as b on b.id = p.booking_id;
  return v_result;
end;
$function$;

revoke all on function public.admin_list_customer_payment_candidates()
  from public, anon, authenticated, service_role;
revoke all on function public.admin_record_customer_payment(
  uuid, uuid, numeric, text, date, text, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.admin_list_customer_payment_candidates()
  to authenticated;
grant execute on function public.admin_record_customer_payment(
  uuid, uuid, numeric, text, date, text, uuid
) to authenticated;

comment on column public.payments.receipt_number is
  'Unique immutable receipt number allocated to each newly recorded receipt; legacy rows may be null.';
comment on column public.payments.payment_date is
  'Business payment date in Asia/Colombo; verified_at separately records when it entered the ledger.';
comment on function public.admin_record_customer_payment(uuid, uuid, numeric, text, date, text, uuid) is
  'Admin-only idempotent customer payment recording against an accepted quote, with currency and balance validation.';
