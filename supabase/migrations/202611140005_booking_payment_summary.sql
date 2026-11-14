-- Uncapped, booking-scoped Admin view of the immutable customer payment ledger.
create or replace function public.admin_get_booking_payment_summary(p_booking_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
begin
  if not private.has_active_role(
    (select auth.uid()),
    array['admin', 'super_admin']
  ) then
    raise exception 'An active Admin is required';
  end if;
  if p_booking_id is null then
    raise exception 'Booking is unavailable';
  end if;

  select pg_catalog.jsonb_build_object(
    'booking_id', b.id,
    'booking_ref', b.booking_ref,
    'payments', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'payment_id', p.id,
          'quote_id', p.quote_id,
          'entry_type', p.entry_type,
          'original_payment_id', p.original_payment_id,
          'amount', p.amount,
          'currency', p.currency,
          'method', p.method,
          'reference', p.provider_reference,
          'refund_reason', p.refund_reason,
          'receipt_number', p.receipt_number,
          'payment_date', p.payment_date,
          'status', 'verified',
          'verified_at', p.verified_at,
          'created_at', p.created_at
        ) order by p.created_at, p.id
      )
        from public.payments as p
       where p.booking_id = b.id
    ), '[]'::jsonb),
    'quote_summaries', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'quote_id', summary.quote_id,
          'quote_revision', summary.quote_revision,
          'quote_status', summary.quote_status,
          'currency', summary.currency,
          'quote_total', summary.quote_total,
          'total_paid', summary.total_paid,
          'total_refunded', summary.total_refunded,
          'net_paid', summary.net_paid,
          'outstanding_balance', case
            when summary.quote_status = 'accepted'
              then greatest(summary.quote_total - summary.net_paid, 0)
            else null
          end,
          'payment_status', case
            when summary.quote_status <> 'accepted' then null
            when summary.total_refunded > 0 and summary.net_paid = 0 then 'refunded'
            when summary.net_paid <= 0 then 'unpaid'
            when summary.net_paid >= summary.quote_total then 'paid'
            else 'partially_paid'
          end,
          'invoice_status', (
            select i.invoice_status
              from public.invoices as i
             where i.quote_id = summary.quote_id
             order by i.revision desc
             limit 1
          )
        ) order by summary.quote_revision desc
      )
        from (
          select
            q.id as quote_id,
            q.revision as quote_revision,
            q.quote_status,
            q.currency,
            q.total as quote_total,
            coalesce(
              pg_catalog.sum(p.amount) filter (where p.entry_type = 'receipt'),
              0
            ) as total_paid,
            coalesce(
              pg_catalog.sum(p.amount) filter (where p.entry_type = 'refund'),
              0
            ) as total_refunded,
            coalesce(
              pg_catalog.sum(
                case when p.entry_type = 'receipt' then p.amount else -p.amount end
              ),
              0
            ) as net_paid
          from public.booking_quotes as q
          left join public.payments as p
            on p.booking_id = q.booking_id
           and p.quote_id = q.id
          where q.booking_id = b.id
          group by q.id, q.revision, q.quote_status, q.currency, q.total
        ) as summary
    ), '[]'::jsonb),
    'totals_by_currency', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'currency', totals.currency,
          'total_paid', totals.total_paid,
          'total_refunded', totals.total_refunded,
          'net_paid', totals.net_paid
        ) order by totals.currency
      )
        from (
          select
            p.currency,
            coalesce(
              pg_catalog.sum(p.amount) filter (where p.entry_type = 'receipt'),
              0
            ) as total_paid,
            coalesce(
              pg_catalog.sum(p.amount) filter (where p.entry_type = 'refund'),
              0
            ) as total_refunded,
            coalesce(
              pg_catalog.sum(
                case when p.entry_type = 'receipt' then p.amount else -p.amount end
              ),
              0
            ) as net_paid
          from public.payments as p
          where p.booking_id = b.id
          group by p.currency
        ) as totals
    ), '[]'::jsonb)
  )
    into v_result
    from public.bookings as b
   where b.id = p_booking_id;

  if v_result is null then
    raise exception 'Booking is unavailable';
  end if;
  return v_result;
end;
$function$;

revoke all on function public.admin_get_booking_payment_summary(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_get_booking_payment_summary(uuid)
  to authenticated;

comment on function public.admin_get_booking_payment_summary(uuid) is
  'Returns the complete booking-scoped verified payment/refund ledger and per-quote totals to active Admins only.';
