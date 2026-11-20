-- Centralized Customer CRM Profiles & Admin Aggregation RPC
-- Customers remain guest records managed centrally by Admin (no customer auth accounts).

create table if not exists public.customer_crm_profiles (
  id uuid primary key default gen_random_uuid(),
  normalized_key text not null unique
    check (pg_catalog.char_length(pg_catalog.btrim(normalized_key)) between 2 and 254),
  full_name text not null
    check (pg_catalog.char_length(pg_catalog.btrim(full_name)) between 1 and 160),
  email text
    check (email is null or pg_catalog.char_length(email) <= 254),
  phone text
    check (phone is null or pg_catalog.char_length(phone) <= 40),
  whatsapp text
    check (whatsapp is null or pg_catalog.char_length(whatsapp) <= 40),
  country text
    check (country is null or pg_catalog.char_length(country) <= 100),
  vip_status text not null default 'standard'
    check (vip_status in ('standard', 'repeat', 'vip')),
  notes text
    check (notes is null or pg_catalog.char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_crm_profiles_vip_updated_idx
  on public.customer_crm_profiles (vip_status, updated_at desc);

create index if not exists customer_crm_profiles_email_idx
  on public.customer_crm_profiles (pg_catalog.lower(email))
  where email is not null;

create trigger customer_crm_profiles_set_updated_at
before update on public.customer_crm_profiles
for each row execute function private.set_updated_at();

alter table public.customer_crm_profiles enable row level security;

revoke all on table public.customer_crm_profiles
  from public, anon, authenticated, service_role;

grant select, insert, update, delete on table public.customer_crm_profiles to authenticated;
grant all on table public.customer_crm_profiles to service_role;

create policy customer_crm_profiles_admin_all
  on public.customer_crm_profiles
  for all
  to authenticated
  using (private.is_active_admin())
  with check (private.is_active_admin());

comment on table public.customer_crm_profiles is
  'Admin-only centralized guest customer CRM metadata, VIP status, contact details, and confidential notes.';

create or replace function public.admin_get_customer_crm_source_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
begin
  if not private.is_active_admin() then
    raise exception 'An active Admin is required';
  end if;

  select pg_catalog.jsonb_build_object(
    'crm_profiles', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', c.id,
          'normalized_key', c.normalized_key,
          'full_name', c.full_name,
          'email', c.email,
          'phone', c.phone,
          'whatsapp', c.whatsapp,
          'country', c.country,
          'vip_status', c.vip_status,
          'notes', c.notes,
          'created_at', c.created_at,
          'updated_at', c.updated_at
        ) order by c.updated_at desc
      )
      from public.customer_crm_profiles as c
    ), '[]'::jsonb),
    'bookings', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', b.id,
          'booking_ref', b.booking_ref,
          'customer_name', b.customer_name,
          'customer_email', b.customer_email,
          'customer_phone', b.customer_phone,
          'service_type', b.service_type,
          'journey_type', b.journey_type,
          'booking_status', b.booking_status,
          'requested_currency', pg_catalog.btrim(b.requested_currency::text),
          'passenger_count', b.passenger_count,
          'luggage_count', b.luggage_count,
          'customer_notes', b.customer_notes,
          'created_at', b.created_at,
          'updated_at', b.updated_at,
          'legs', coalesce((
            select pg_catalog.jsonb_agg(
              pg_catalog.jsonb_build_object(
                'sequence_no', bl.sequence_no,
                'pickup_location', bl.pickup_location,
                'dropoff_location', bl.dropoff_location,
                'pickup_at', bl.pickup_at,
                'planned_end_at', bl.planned_end_at,
                'trip_status', bl.trip_status
              ) order by bl.sequence_no asc
            )
            from public.booking_legs as bl
            where bl.booking_id = b.id
          ), '[]'::jsonb)
        ) order by b.created_at desc
      )
      from public.bookings as b
    ), '[]'::jsonb),
    'quotes', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', q.id,
          'booking_id', q.booking_id,
          'revision', q.revision,
          'currency', pg_catalog.btrim(q.currency::text),
          'total', q.total,
          'quote_status', q.quote_status,
          'issued_at', q.issued_at,
          'expires_at', q.expires_at,
          'accepted_at', q.accepted_at,
          'created_at', q.created_at
        ) order by q.booking_id, q.revision desc
      )
      from public.booking_quotes as q
    ), '[]'::jsonb),
    'payments', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', p.id,
          'booking_id', p.booking_id,
          'booking_ref', b.booking_ref,
          'quote_id', p.quote_id,
          'entry_type', p.entry_type,
          'original_payment_id', p.original_payment_id,
          'amount', p.amount,
          'currency', pg_catalog.btrim(p.currency::text),
          'method', p.method,
          'provider_reference', p.provider_reference,
          'refund_reason', p.refund_reason,
          'receipt_number', p.receipt_number,
          'payment_date', p.payment_date,
          'verified_at', p.verified_at,
          'created_at', p.created_at,
          'document_id', d.id,
          'file_status', d.file_status
        ) order by p.created_at desc
      )
      from public.payments as p
      join public.bookings as b on b.id = p.booking_id
      left join public.booking_documents as d
        on d.source_payment_id = p.id and d.document_type = 'receipt'
    ), '[]'::jsonb),
    'invoices', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', i.id,
          'invoice_number', i.invoice_number,
          'booking_id', i.booking_id,
          'booking_ref', b.booking_ref,
          'quote_id', i.quote_id,
          'currency', pg_catalog.btrim(i.currency::text),
          'total', i.total,
          'revision', i.revision,
          'invoice_status', i.invoice_status,
          'issued_at', i.issued_at,
          'cancelled_at', i.cancelled_at,
          'cancellation_reason', i.cancellation_reason,
          'document_id', d.id,
          'file_status', d.file_status
        ) order by i.issued_at desc
      )
      from public.invoices as i
      join public.bookings as b on b.id = i.booking_id
      left join public.booking_documents as d
        on d.source_invoice_id = i.id and d.document_type = 'invoice'
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$function$;

revoke all on function public.admin_get_customer_crm_source_data()
  from public, anon, authenticated, service_role;
grant execute on function public.admin_get_customer_crm_source_data()
  to authenticated;

comment on function public.admin_get_customer_crm_source_data() is
  'Returns all bookings, quotes, payments, invoices, receipt documents, and customer CRM profiles to active Admins for centralized CRM aggregation.';
