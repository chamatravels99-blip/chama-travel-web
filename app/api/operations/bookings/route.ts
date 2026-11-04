import { NextResponse } from 'next/server';
import { authorizationResponse, isSameOriginRequest, requireRoles } from '@/lib/server/authorization';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET() {
  try {
    const { supabase, roles } = await requireRoles(['admin', 'super_admin', 'operator']);
    const [bookings, resources] = await Promise.all([
      supabase.rpc('list_operations_bookings'),
      supabase.rpc('list_dispatch_resources'),
    ]);
    if (bookings.error || resources.error) {
      console.error('Operations dashboard data failed.', bookings.error?.code, resources.error?.code);
      return NextResponse.json(
        { success: false, error: 'Operations data is temporarily unavailable.' },
        { status: 503 }
      );
    }
    return NextResponse.json({
      success: true,
      data: { bookings: bookings.data ?? [], resources: resources.data ?? { drivers: [], vehicles: [] } },
      roles,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return authorizationResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ success: false, error: 'Request origin is not allowed.' }, { status: 403 });
    }
    const { supabase } = await requireRoles(['admin', 'super_admin', 'operator']);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Enter valid operation details.' }, { status: 400 });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: 'Enter valid operation details.' }, { status: 400 });
    }

    const input = body as Record<string, unknown>;
    if (input.action === 'issue_quote') {
      const bookingId = typeof input.booking_id === 'string' ? input.booking_id : '';
      const currency = input.currency;
      const expiresAt = input.expires_at;
      if (!UUID_PATTERN.test(bookingId) || !['LKR', 'USD'].includes(String(currency)) ||
          typeof expiresAt !== 'string' || Number.isNaN(Date.parse(expiresAt))) {
        return NextResponse.json({ success: false, error: 'Quote details are invalid.' }, { status: 400 });
      }

      const { data, error } = await supabase.rpc('issue_booking_quote', {
        p_booking_id: bookingId,
        p_currency: currency,
        p_expires_at: expiresAt,
      });
      if (error) {
        console.error('Quote issuance failed.', error.code);
        return NextResponse.json(
          { success: false, error: 'The quote could not be issued. Verify the booking and pricing configuration.' },
          { status: 400 }
        );
      }
      const result = Array.isArray(data) ? data[0] : data;
      const guestToken = result && typeof result === 'object' && 'guest_token' in result
        ? result.guest_token
        : null;
      const quoteId = result && typeof result === 'object' && 'quote_id' in result
        ? result.quote_id
        : null;
      const acceptanceUrl = typeof guestToken === 'string' && typeof quoteId === 'string'
        ? (() => {
            const url = new URL(`/quotes/accept/${quoteId}`, request.url);
            url.hash = guestToken;
            return url.toString();
          })()
        : null;
      return NextResponse.json({
        success: true,
        data: {
          quote_id: quoteId,
          total: result && typeof result === 'object' && 'total' in result ? result.total : null,
          currency,
          acceptance_url: acceptanceUrl,
          guest_delivery_required: Boolean(acceptanceUrl),
        },
      }, { headers: { 'Cache-Control': 'no-store' } });
    }

    if (input.action === 'assign') {
      const bookingId = typeof input.booking_id === 'string' ? input.booking_id : '';
      const driverId = typeof input.driver_user_id === 'string' ? input.driver_user_id : '';
      const vehicleId = typeof input.vehicle_id === 'string' ? input.vehicle_id : '';
      if (![bookingId, driverId, vehicleId].every((id) => UUID_PATTERN.test(id))) {
        return NextResponse.json({ success: false, error: 'Assignment details are invalid.' }, { status: 400 });
      }
      const { data, error } = await supabase.rpc('create_booking_assignment', {
        p_booking_id: bookingId,
        p_driver_user_id: driverId,
        p_vehicle_id: vehicleId,
      });
      if (error) {
        console.error('Booking assignment failed.', error.code);
        return NextResponse.json(
          { success: false, error: 'The assignment could not be made. Check vehicle/driver availability and the booking schedule.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ success: true, data: { assignment_id: data } }, { status: 201 });
    }

    return NextResponse.json({ success: false, error: 'Unsupported operation.' }, { status: 400 });
  } catch (error) {
    return authorizationResponse(error);
  }
}
