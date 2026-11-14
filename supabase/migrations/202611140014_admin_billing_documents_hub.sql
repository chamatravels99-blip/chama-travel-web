create or replace function public.admin_list_billing_documents(
  p_search text default null,
  p_document_type text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  document_type text,
  record_id uuid,
  record_number text,
  booking_id uuid,
  booking_ref text,
  customer_name text,
  customer_email text,
  currency char(3),
  amount numeric(12, 2),
  status text,
  recorded_at timestamptz,
  document_id uuid,
  file_status text,
  payment_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_search text := nullif(pg_catalog.btrim(coalesce(p_search, '')), '');
begin
  if not private.has_active_role(
    (select auth.uid()),
    array['admin', 'super_admin']
  ) then
    raise exception 'An active Admin is required';
  end if;
  if p_document_type is not null and p_document_type not in ('invoice', 'receipt') then
    raise exception 'Billing document type is invalid';
  end if;
  if p_limit is null or p_limit not between 1 and 101
     or p_offset is null or p_offset not between 0 and 10000
     or pg_catalog.char_length(coalesce(p_search, '')) > 100 then
    raise exception 'Billing document search is invalid';
  end if;

  return query
  with billing_records as (
    select
      'invoice'::text as document_type,
      i.id as record_id,
      i.invoice_number as record_number,
      b.id as booking_id,
      b.booking_ref,
      b.customer_name,
      b.customer_email,
      i.currency,
      i.total as amount,
      i.invoice_status as status,
      i.issued_at as recorded_at,
      d.id as document_id,
      d.file_status,
      null::uuid as payment_id
    from public.invoices as i
    join public.bookings as b on b.id = i.booking_id
    left join public.booking_documents as d
      on d.source_invoice_id = i.id and d.document_type = 'invoice'

    union all

    select
      'receipt'::text as document_type,
      p.id as record_id,
      p.receipt_number as record_number,
      b.id as booking_id,
      b.booking_ref,
      b.customer_name,
      b.customer_email,
      p.currency,
      p.amount,
      'verified'::text as status,
      p.verified_at as recorded_at,
      d.id as document_id,
      d.file_status,
      p.id as payment_id
    from public.payments as p
    join public.bookings as b on b.id = p.booking_id
    left join public.booking_documents as d
      on d.source_payment_id = p.id and d.document_type = 'receipt'
    where p.entry_type = 'receipt'
      and p.receipt_number is not null
  )
  select
    r.document_type,
    r.record_id,
    r.record_number,
    r.booking_id,
    r.booking_ref,
    r.customer_name,
    r.customer_email,
    r.currency,
    r.amount,
    r.status,
    r.recorded_at,
    r.document_id,
    r.file_status,
    r.payment_id
  from billing_records as r
  where (p_document_type is null or r.document_type = p_document_type)
    and (
      v_search is null
      or pg_catalog.strpos(pg_catalog.lower(r.record_number), pg_catalog.lower(v_search)) > 0
      or pg_catalog.strpos(pg_catalog.lower(r.booking_ref), pg_catalog.lower(v_search)) > 0
      or pg_catalog.strpos(pg_catalog.lower(r.customer_name), pg_catalog.lower(v_search)) > 0
      or pg_catalog.strpos(pg_catalog.lower(coalesce(r.customer_email, '')), pg_catalog.lower(v_search)) > 0
    )
  order by r.recorded_at desc, r.record_number desc
  limit p_limit
  offset p_offset;
end;
$function$;

revoke all on function public.admin_list_billing_documents(text, text, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_list_billing_documents(text, text, integer, integer)
  to authenticated;

comment on function public.admin_list_billing_documents(text, text, integer, integer) is
  'Paginated invoice and verified receipt history for active Admins; document access remains protected by the document download authorization path.';
