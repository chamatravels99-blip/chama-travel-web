import { NextResponse } from 'next/server';
import { authorizationResponse, requireRoles } from '@/lib/server/authorization';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Ownership and "driver has accepted" are enforced inside the database function;
// an unowned or not-yet-accepted booking yields the same empty response.
export async function GET(request: Request) {
  try {
    const { supabase } = await requireRoles(['customer']);
    const bookingId = new URL(request.url).searchParams.get('booking_id') ?? '';
    if (!UUID_PATTERN.test(bookingId)) {
      return NextResponse.json({ success: false, error: 'Booking details are invalid.' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('get_customer_assigned_driver', { p_booking_id: bookingId });
    if (error) {
      console.error('Assigned driver lookup failed.', error.code);
      return NextResponse.json(
        { success: false, error: 'Driver details are temporarily unavailable.' },
        { status: 503 }
      );
    }
    const driver = Array.isArray(data) ? data[0] ?? null : null;
    return NextResponse.json({ success: true, data: driver }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return authorizationResponse(error);
  }
}
