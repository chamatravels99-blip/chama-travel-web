import { NextResponse } from 'next/server';
import { authorizationResponse, requireRoles } from '@/lib/server/authorization';
import {
  aggregateBusinessAnalytics,
  type AnalyticsSourceData,
} from '@/lib/admin-analytics';

export async function GET(request: Request) {
  try {
    const { supabase } = await requireRoles(['admin', 'super_admin']);

    const { searchParams } = new URL(request.url);
    const yearParam = (searchParams.get('year') ?? 'all').trim();
    if (yearParam !== 'all' && !/^\d{4}$/.test(yearParam)) {
      return NextResponse.json(
        { success: false, error: 'Choose a valid 4-digit year or "all".' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc('admin_get_analytics_data');
    if (error || !data || typeof data !== 'object') {
      console.error('Analytics source data RPC failed.', error?.code);
      return NextResponse.json(
        { success: false, error: 'Business analytics data is temporarily unavailable.' },
        { status: 503 }
      );
    }

    const source = data as AnalyticsSourceData;
    const report = aggregateBusinessAnalytics(
      {
        bookings: Array.isArray(source.bookings) ? source.bookings : [],
        quotes: Array.isArray(source.quotes) ? source.quotes : [],
        payments: Array.isArray(source.payments) ? source.payments : [],
        assignments: Array.isArray(source.assignments) ? source.assignments : [],
        drivers: Array.isArray(source.drivers) ? source.drivers : [],
        vehicles: Array.isArray(source.vehicles) ? source.vehicles : [],
        driver_settlements: Array.isArray(source.driver_settlements)
          ? source.driver_settlements
          : [],
        driver_hire_offers: Array.isArray(source.driver_hire_offers)
          ? source.driver_hire_offers
          : [],
        driver_hire_payouts: Array.isArray(source.driver_hire_payouts)
          ? source.driver_hire_payouts
          : [],
        tour_packages: Array.isArray(source.tour_packages) ? source.tour_packages : [],
        destinations: Array.isArray(source.destinations) ? source.destinations : [],
      },
      yearParam
    );

    return NextResponse.json(
      {
        success: true,
        data: report,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return authorizationResponse(error);
  }
}
