import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('vehicle_categories')
    .select('code, display_name, max_passengers, max_luggage')
    .eq('is_active', true)
    .order('display_name');

  if (error) {
    console.error('Active vehicle categories could not be loaded.', error.code);
    return NextResponse.json(
      { success: false, error: 'Vehicle options are temporarily unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  return NextResponse.json(
    { success: true, data: data ?? [] },
    { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } }
  );
}
