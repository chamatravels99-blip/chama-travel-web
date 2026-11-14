-- Ensures customer payment recording automatically issues the linked receipt document
-- and provides the record_booking_payment RPC alias for centralized Admin operations.

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
  if not private.has_active_role(v_actor, array['admin', 'super_admin']) then
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
    perform public.admin_issue_payment_receipt_document(v_existing.id);
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

  perform public.admin_issue_payment_receipt_document(v_payment_id);

  return query select v_payment_id, v_receipt_number, true;
end;
$function$;

create or replace function public.record_booking_payment(
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
begin
  return query
  select r.payment_id, r.receipt_number, r.created
    from public.admin_record_customer_payment(
      p_booking_id,
      p_quote_id,
      p_amount,
      p_method,
      p_payment_date,
      p_reference,
      p_request_id
    ) as r;
end;
$function$;

revoke all on function public.admin_record_customer_payment(
  uuid, uuid, numeric, text, date, text, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.admin_record_customer_payment(
  uuid, uuid, numeric, text, date, text, uuid
) to authenticated;

revoke all on function public.record_booking_payment(
  uuid, uuid, numeric, text, date, text, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.record_booking_payment(
  uuid, uuid, numeric, text, date, text, uuid
) to authenticated;
