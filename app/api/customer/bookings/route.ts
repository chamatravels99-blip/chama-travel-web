import { NextResponse } from 'next/server';
import { authorizationResponse, requireRoles } from '@/lib/server/authorization';

export async function GET() {
  try {
    const { supabase } = await requireRoles(['customer']);
    const { data: bookings, error: bookingError } = await supabase
      .from('bookings')
      .select('id, booking_ref, customer_name, customer_phone, service_type, journey_type, requested_category_id, passenger_count, luggage_count, customer_notes, booking_status, created_at')
      .order('created_at', { ascending: false })
      .range(0, 199);

    if (bookingError) {
      console.error('Customer bookings could not be loaded.', bookingError.code);
      return NextResponse.json({ success: false, error: 'Your bookings are temporarily unavailable.' }, { status: 503 });
    }

    const bookingIds = (bookings ?? []).map((booking) => booking.id);
    if (!bookingIds.length) {
      return NextResponse.json({ success: true, data: [] }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const [legs, quotes, claims, payments, events] = await Promise.all([
      supabase.from('booking_legs')
        .select('id, booking_id, sequence_no, pickup_location, dropoff_location, pickup_at, planned_end_at, flight_number, trip_notes, trip_status')
        .in('booking_id', bookingIds)
        .order('sequence_no'),
      supabase.from('booking_quotes')
        .select('id, booking_id, revision, currency, total, quote_status, issued_at, expires_at, accepted_at')
        .in('booking_id', bookingIds)
        .order('revision', { ascending: false }),
      supabase.from('payment_claims')
        .select('id, booking_id, quote_id, amount, currency, method, claim_status, submitted_at, reviewed_at')
        .in('booking_id', bookingIds)
        .order('submitted_at', { ascending: false }),
      supabase.from('payments')
        .select('id, booking_id, quote_id, entry_type, amount, currency, method, verified_at, created_at')
        .in('booking_id', bookingIds)
        .order('created_at', { ascending: false }),
      supabase.from('booking_events')
        .select('id, booking_id, event_type, from_status, to_status, created_at')
        .in('booking_id', bookingIds)
        .order('created_at', { ascending: false }),
    ]);

    const quoteIds = (quotes.data ?? []).map((quote) => quote.id);
    const quoteLines = quoteIds.length
      ? await supabase.from('booking_quote_lines')
          .select('id, quote_id, description, quantity, unit_amount, line_total')
          .in('quote_id', quoteIds)
      : { data: [], error: null };
    const queryError = legs.error || quotes.error || claims.error || payments.error || events.error || quoteLines.error;
    if (queryError) {
      console.error('Customer booking details could not be loaded.', queryError.code);
      return NextResponse.json({ success: false, error: 'Your booking details are temporarily unavailable.' }, { status: 503 });
    }

    const data = (bookings ?? []).map((booking) => ({
      ...booking,
      legs: (legs.data ?? []).filter((leg) => leg.booking_id === booking.id),
      quotes: (quotes.data ?? []).filter((quote) => quote.booking_id === booking.id).map((quote) => ({
        ...quote,
        lines: (quoteLines.data ?? []).filter((line) => line.quote_id === quote.id),
      })),
      payment_claims: (claims.data ?? []).filter((claim) => claim.booking_id === booking.id),
      payments: (payments.data ?? []).filter((payment) => payment.booking_id === booking.id),
      events: (events.data ?? []).filter((event) => event.booking_id === booking.id),
    }));

    return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return authorizationResponse(error);
  }
}
