create or replace function public.admin_financial_report(
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_result jsonb;
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
    raise exception 'Only an active Admin may view financial reports';
  end if;
  if p_start_date is null or p_end_date is null
     or p_start_date > p_end_date
     or p_end_date - p_start_date > 3660
  then
    raise exception 'Financial report date range is invalid';
  end if;

  v_start_at := p_start_date::timestamp at time zone 'Asia/Colombo';
  v_end_at := (p_end_date + 1)::timestamp at time zone 'Asia/Colombo';

  with currencies(currency) as (
    values ('LKR'::text), ('USD'::text)
  ),
  customer_activity as (
    select
      p.currency::text as currency,
      coalesce(pg_catalog.sum(p.amount) filter (where p.entry_type = 'receipt'), 0) as received,
      coalesce(pg_catalog.sum(p.amount) filter (where p.entry_type = 'refund'), 0) as refunded
    from public.payments as p
    where coalesce(
        p.payment_date,
        (p.verified_at at time zone 'Asia/Colombo')::date
      ) between p_start_date and p_end_date
    group by p.currency
  ),
  customer_methods as (
    select
      p.currency::text as currency,
      coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'entry_type', p.entry_type,
        'method', p.method,
        'amount', p.amount_total
      ) order by p.entry_type, p.method), '[]'::jsonb) as details
    from (
      select
        currency, entry_type, method, pg_catalog.sum(amount) as amount_total
      from public.payments
      where coalesce(
          payment_date,
          (verified_at at time zone 'Asia/Colombo')::date
        ) between p_start_date and p_end_date
      group by currency, entry_type, method
    ) as p
    group by p.currency
  ),
  customer_balances as (
    select q.currency::text as currency,
      coalesce(pg_catalog.sum(q.total), 0) as booking_value,
      coalesce(pg_catalog.sum(greatest(
        q.total - coalesce(paid.amount_paid, 0), 0
      )), 0) as outstanding
    from public.booking_quotes as q
    join public.bookings as b on b.id = q.booking_id
    left join lateral (
      select pg_catalog.sum(
        case when p.entry_type = 'receipt' then p.amount else -p.amount end
      ) as amount_paid
      from public.payments as p
      where p.quote_id = q.id
        and coalesce(
          p.payment_date,
          (p.verified_at at time zone 'Asia/Colombo')::date
        ) < p_end_date + 1
    ) as paid on true
    where q.quote_status = 'accepted'
      and q.accepted_at >= v_start_at
      and q.accepted_at < v_end_at
      and b.booking_status <> 'cancelled'
    group by q.currency
  ),
  accepted_hire_offers as (
    select dho.assignment_id, dho.currency::text as currency, dho.amount
    from public.driver_hire_offers as dho
    where dho.offer_status = 'accepted'
      and dho.responded_at >= v_start_at
      and dho.responded_at < v_end_at
      and (dho.superseded_at is null or dho.superseded_at >= v_end_at)
  ),
  driver_liabilities as (
    select liability.currency,
      coalesce(pg_catalog.sum(liability.obligation), 0) as obligations,
      coalesce(pg_catalog.sum(liability.outstanding), 0) as outstanding
    from (
      select
        aho.currency,
        aho.amount as obligation,
        greatest(aho.amount - coalesce(paid.amount_paid, 0), 0) as outstanding
      from accepted_hire_offers as aho
      left join lateral (
        select pg_catalog.sum(dhp.amount) as amount_paid
        from public.driver_hire_payouts as dhp
        where dhp.assignment_id = aho.assignment_id
          and dhp.currency = aho.currency
          and dhp.payment_date < p_end_date + 1
      ) as paid on true
      union all
      select
        ds.currency::text,
        ds.amount,
        case
          when ds.settlement_status = 'pending'
            or ds.paid_at >= v_end_at then ds.amount
          else 0
        end
      from public.driver_settlements as ds
      where ds.created_at >= v_start_at
        and ds.created_at < v_end_at
    ) as liability
    group by liability.currency
  ),
  driver_activity as (
    select
      activity.currency,
      coalesce(pg_catalog.sum(activity.paid), 0) as paid
    from (
      select dhp.currency::text as currency, dhp.amount as paid
      from public.driver_hire_payouts as dhp
      where dhp.payment_date between p_start_date and p_end_date
      union all
      select ds.currency::text, ds.amount
      from public.driver_settlements as ds
      where ds.settlement_status = 'paid'
        and ds.paid_at >= v_start_at
        and ds.paid_at < v_end_at
    ) as activity
    group by activity.currency
  ),
  driver_methods as (
    select
      dhp.currency,
      coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'method', dhp.payment_method,
        'amount', dhp.amount_total
      ) order by dhp.payment_method), '[]'::jsonb) as details
    from (
      select currency, payment_method, pg_catalog.sum(amount) as amount_total
      from public.driver_hire_payouts
      where payment_date between p_start_date and p_end_date
      group by currency, payment_method
      union all
      select currency, payout_method, pg_catalog.sum(amount)
      from public.driver_settlements
      where settlement_status = 'paid'
        and paid_at >= v_start_at
        and paid_at < v_end_at
      group by currency, payout_method
    ) as dhp
    group by dhp.currency
  ),
  monthly_activity as (
    select
      activity_row.currency,
      activity_row.month,
      coalesce(pg_catalog.sum(activity_row.customer_received), 0) as customer_received,
      coalesce(pg_catalog.sum(activity_row.customer_refunded), 0) as customer_refunded,
      coalesce(pg_catalog.sum(activity_row.driver_paid), 0) as driver_paid
    from (
      select
        p.currency::text as currency,
        pg_catalog.to_char(coalesce(
          p.payment_date,
          (p.verified_at at time zone 'Asia/Colombo')::date
      )::timestamp, 'YYYY-MM') as month,
        case when p.entry_type = 'receipt' then p.amount else 0 end as customer_received,
        case when p.entry_type = 'refund' then p.amount else 0 end as customer_refunded,
        0::numeric as driver_paid
      from public.payments as p
      where coalesce(
          p.payment_date,
          (p.verified_at at time zone 'Asia/Colombo')::date
        ) between p_start_date and p_end_date
      union all
      select
        dhp.currency::text,
        pg_catalog.to_char(dhp.payment_date::timestamp, 'YYYY-MM'),
        0::numeric,
        0::numeric,
        dhp.amount
      from public.driver_hire_payouts as dhp
      where dhp.payment_date between p_start_date and p_end_date
      union all
      select
        ds.currency::text,
        pg_catalog.to_char((ds.paid_at at time zone 'Asia/Colombo')::date::timestamp, 'YYYY-MM'),
        0::numeric,
        0::numeric,
        ds.amount
      from public.driver_settlements as ds
      where ds.settlement_status = 'paid'
        and ds.paid_at >= v_start_at
        and ds.paid_at < v_end_at
    ) as activity_row
    group by activity_row.currency, activity_row.month
  ),
  annual_activity as (
    select
      activity_row.currency,
      activity_row.year,
      coalesce(pg_catalog.sum(activity_row.customer_received), 0) as customer_received,
      coalesce(pg_catalog.sum(activity_row.customer_refunded), 0) as customer_refunded,
      coalesce(pg_catalog.sum(activity_row.driver_paid), 0) as driver_paid
    from (
      select
        p.currency::text as currency,
        pg_catalog.to_char(coalesce(
          p.payment_date,
          (p.verified_at at time zone 'Asia/Colombo')::date
        )::timestamp, 'YYYY') as year,
        case when p.entry_type = 'receipt' then p.amount else 0 end as customer_received,
        case when p.entry_type = 'refund' then p.amount else 0 end as customer_refunded,
        0::numeric as driver_paid
      from public.payments as p
      where coalesce(
          p.payment_date,
          (p.verified_at at time zone 'Asia/Colombo')::date
        ) between p_start_date and p_end_date
      union all
      select
        dhp.currency::text,
        pg_catalog.to_char(dhp.payment_date::timestamp, 'YYYY'),
        0::numeric,
        0::numeric,
        dhp.amount
      from public.driver_hire_payouts as dhp
      where dhp.payment_date between p_start_date and p_end_date
      union all
      select
        ds.currency::text,
        pg_catalog.to_char((ds.paid_at at time zone 'Asia/Colombo')::date::timestamp, 'YYYY'),
        0::numeric,
        0::numeric,
        ds.amount
      from public.driver_settlements as ds
      where ds.settlement_status = 'paid'
        and ds.paid_at >= v_start_at
        and ds.paid_at < v_end_at
    ) as activity_row
    group by activity_row.currency, activity_row.year
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'currency', c.currency,
    'customer_received', coalesce(ca.received, 0),
    'customer_refunded', coalesce(ca.refunded, 0),
    'net_customer_income', coalesce(ca.received, 0) - coalesce(ca.refunded, 0),
    'booking_value', coalesce(cb.booking_value, 0),
    'outstanding_customer_balance', coalesce(cb.outstanding, 0),
    'driver_hire_obligations', coalesce(dl.obligations, 0),
    'actual_driver_payouts', coalesce(da.paid, 0),
    'outstanding_driver_balance', coalesce(dl.outstanding, 0),
    'customer_payment_methods', coalesce(cm.details, '[]'::jsonb),
    'driver_payout_methods', coalesce(dm.details, '[]'::jsonb),
    'monthly_summary', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'month', ma.month,
        'customer_received', ma.customer_received,
        'customer_refunded', ma.customer_refunded,
        'driver_payouts', ma.driver_paid
      ) order by ma.month)
      from monthly_activity as ma
      where ma.currency = c.currency
    ), '[]'::jsonb),
    'annual_summary', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'year', aa.year,
        'customer_received', aa.customer_received,
        'customer_refunded', aa.customer_refunded,
        'driver_payouts', aa.driver_paid
      ) order by aa.year)
      from annual_activity as aa
      where aa.currency = c.currency
    ), '[]'::jsonb)
  ) order by c.currency), '[]'::jsonb)
    into v_result
    from currencies as c
    left join customer_activity as ca on ca.currency = c.currency
    left join customer_methods as cm on cm.currency = c.currency
    left join customer_balances as cb on cb.currency = c.currency
    left join driver_liabilities as dl on dl.currency = c.currency
    left join driver_activity as da on da.currency = c.currency
    left join driver_methods as dm on dm.currency = c.currency;

  return pg_catalog.jsonb_build_object(
    'start_date', p_start_date,
    'end_date', p_end_date,
    'currencies', v_result
  );
end;
$function$;

revoke all on function public.admin_financial_report(date, date)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_financial_report(date, date)
  to authenticated;

comment on function public.admin_financial_report(date, date) is
  'Returns complete Admin-authorized financial aggregates separated by currency, with period activity and accepted-quote/offer outstanding cohorts.';
