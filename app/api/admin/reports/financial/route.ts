import { NextResponse } from 'next/server';
import { authorizationResponse, requireRoles } from '@/lib/server/authorization';
import { parseFinancialReportRange } from '@/lib/financial-report-range';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const range = parseFinancialReportRange(
      url.searchParams.get('start_date'),
      url.searchParams.get('end_date')
    );
    if (!range) {
      return NextResponse.json({ success: false, error: 'Choose a valid date range of up to ten years.' }, { status: 400 });
    }

    const { supabase } = await requireRoles(['admin', 'super_admin']);
    const { data, error } = await supabase.rpc('admin_financial_report', {
      p_start_date: range.startDate,
      p_end_date: range.endDate,
    });
    if (error) {
      console.error('Financial report aggregation failed.', error.code);
      return NextResponse.json({ success: false, error: 'Financial report data is temporarily unavailable.' }, { status: 503 });
    }
    return NextResponse.json({ success: true, data }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return authorizationResponse(error);
  }
}
