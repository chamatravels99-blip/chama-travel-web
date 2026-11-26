import { NextResponse } from 'next/server';
import { isSameOriginRequest } from '@/lib/server/authorization';
import { enforceGuestRateLimit } from '@/lib/server/rate-limit';
import { createServiceClient } from '@/lib/server/service-client';
import { syncBookingToGoogleCalendar } from '@/lib/google-calendar';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN_PATTERN = /^[0-9a-f]{64}$/i;

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ success: false, error: 'Request origin is not allowed.' }, { status: 403 });
  }
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return NextResponse.json({ success: false, error: 'Content-Type must be application/json.' }, { status: 415 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Quotation decline details are invalid.' }, { status: 400 });
  }

  const input =
    body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const quoteId = typeof input.quote_id === 'string' ? input.quote_id : '';
  const token = typeof input.token === 'string' ? input.token : '';
  const rawReason = typeof input.reason === 'string' ? input.reason.trim().slice(0, 500) : '';

  if (!UUID_PATTERN.test(quoteId) || !TOKEN_PATTERN.test(token)) {
    return NextResponse.json(
      { success: false, error: 'This quotation link is invalid or expired.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const limitedResponse = await enforceGuestRateLimit(request, 'guest_quote_accept', token);
  if (limitedResponse) return limitedResponse;

  const supabase = createServiceClient();
  if (!supabase) {
    console.error('Guest quote decline is not configured.');
    return NextResponse.json(
      { success: false, error: 'Quotation cancellation is temporarily unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const { error } = await supabase.rpc('decline_guest_quote', {
    p_quote_id: quoteId,
    p_token: token,
    p_reason: rawReason || null,
  });

  if (error) {
    console.error('Guest quote decline failed.', error.code);
    return NextResponse.json(
      { success: false, error: 'This quotation can no longer be declined. It may have already been confirmed, declined, or expired.' },
      { status: 409, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    await syncBookingToGoogleCalendar({ quoteId }, supabase);
  } catch (syncError) {
    console.error('Non-blocking Google Calendar sync failed on guest quote decline:', syncError);
  }

  return NextResponse.json(
    { success: true, message: 'The quotation has been declined and the booking request has been cancelled.' },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
