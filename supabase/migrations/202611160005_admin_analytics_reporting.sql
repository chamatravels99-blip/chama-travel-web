-- Business Analytics & Financial Reports Aggregation RPC
-- Admin and Super Admin only (SECURITY DEFINER, empty search_path).

create or replace function public.admin_get_analytics_data()
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
          'quote_id', p.quote_id,
          'entry_type', p.entry_type,
          'original_payment_id', p.original_payment_id,
          'amount', p.amount,
          'currency', pg_catalog.btrim(p.currency::text),
          'method', p.method,
          'receipt_number', p.receipt_number,
          'payment_date', p.payment_date,
          'verified_at', p.verified_at,
          'created_at', p.created_at
        ) order by p.created_at desc
      )
      from public.payments as p
    ), '[]'::jsonb),
    'assignments', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', ba.id,
          'booking_id', ba.booking_id,
          'driver_user_id', ba.driver_user_id,
          'driver_name', dp.full_name,
          'driver_phone', dp.phone,
          'vehicle_id', ba.vehicle_id,
          'vehicle_name', v.display_name,
          'vehicle_registration', v.registration_number,
          'vehicle_category', vc.display_name,
          'assignment_status', ba.assignment_status,
          'assigned_at', ba.assigned_at,
          'responded_at', ba.responded_at,
          'released_at', ba.released_at
        ) order by ba.assigned_at desc
      )
      from public.booking_assignments as ba
      left join public.profiles as dp on dp.id = ba.driver_user_id
      left join public.vehicles as v on v.id = ba.vehicle_id
      left join public.vehicle_categories as vc on vc.id = v.category_id
    ), '[]'::jsonb),
    'drivers', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', p.id,
          'full_name', p.full_name,
          'phone', p.phone,
          'license_number', p.license_number,
          'account_status', p.account_status,
          'default_vehicle_id', p.default_vehicle_id,
          'default_vehicle_name', dv.display_name,
          'default_vehicle_registration', dv.registration_number,
          'default_vehicle_category', dvc.display_name
        ) order by p.full_name asc
      )
      from public.profiles as p
      join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
      join public.roles as r on r.id = ur.role_id and r.code = 'driver'
      left join public.vehicles as dv on dv.id = p.default_vehicle_id
      left join public.vehicle_categories as dvc on dvc.id = dv.category_id
    ), '[]'::jsonb),
    'vehicles', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', v.id,
          'display_name', v.display_name,
          'registration_number', v.registration_number,
          'operational_status', v.operational_status,
          'category_name', vc.display_name
        ) order by v.display_name asc
      )
      from public.vehicles as v
      join public.vehicle_categories as vc on vc.id = v.category_id
    ), '[]'::jsonb),
    'driver_settlements', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', ds.id,
          'assignment_id', ds.assignment_id,
          'booking_id', ds.booking_id,
          'driver_user_id', ds.driver_user_id,
          'quote_id', ds.quote_id,
          'currency', pg_catalog.btrim(ds.currency::text),
          'amount', ds.amount,
          'settlement_status', ds.settlement_status,
          'payout_method', ds.payout_method,
          'created_at', ds.created_at,
          'paid_at', ds.paid_at
        ) order by ds.created_at desc
      )
      from public.driver_settlements as ds
    ), '[]'::jsonb),
    'driver_hire_offers', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', dho.id,
          'assignment_id', dho.assignment_id,
          'booking_id', dho.booking_id,
          'driver_user_id', dho.driver_user_id,
          'revision', dho.revision,
          'amount', dho.amount,
          'currency', pg_catalog.btrim(dho.currency::text),
          'offer_status', dho.offer_status,
          'is_current', dho.is_current,
          'created_at', dho.created_at,
          'responded_at', dho.responded_at
        ) order by dho.created_at desc
      )
      from public.driver_hire_offers as dho
    ), '[]'::jsonb),
    'driver_hire_payouts', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', dhp.id,
          'assignment_id', dhp.assignment_id,
          'booking_id', dhp.booking_id,
          'driver_user_id', dhp.driver_user_id,
          'amount', dhp.amount,
          'currency', pg_catalog.btrim(dhp.currency::text),
          'payment_date', dhp.payment_date,
          'payment_method', dhp.payment_method,
          'recorded_at', dhp.recorded_at
        ) order by dhp.payment_date desc, dhp.recorded_at desc
      )
      from public.driver_hire_payouts as dhp
    ), '[]'::jsonb),
    'tour_packages', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', tp.id,
          'title', tp.title,
          'slug', tp.slug,
          'category', tp.category,
          'duration', tp.duration,
          'days_count', tp.days_count,
          'price_usd', tp.price_usd,
          'price_lkr', tp.price_lkr,
          'destinations_covered', tp.destinations_covered,
          'is_active', tp.is_active
        ) order by tp.display_order asc, tp.created_at asc
      )
      from public.tour_packages as tp
    ), '[]'::jsonb),
    'destinations', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', d.id,
          'name', d.name,
          'slug', d.slug,
          'region', d.region,
          'is_active', d.is_active
        ) order by d.display_order asc, d.created_at asc
      )
      from public.destinations as d
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$function$;

revoke all on function public.admin_get_analytics_data()
  from public, anon, authenticated, service_role;
grant execute on function public.admin_get_analytics_data()
  to authenticated;

comment on function public.admin_get_analytics_data() is
  'Returns complete historical bookings, quotes, payments, assignments, drivers, vehicles, settlements, tour packages, and destinations to active Admins for business analytics.';
