import { NextResponse } from 'next/server';
import { isSameOriginRequest } from '@/lib/server/authorization';
import { isGuestBookingToken } from '@/lib/guest-booking-token';
import { enforceGuestRateLimit } from '@/lib/server/rate-limit';
import { createServiceClient } from '@/lib/server/service-client';

const MAX_BODY_BYTES = 4096;

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ success: false, error: 'Request origin is not allowed.' }, { status: 403 });
  }
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return NextResponse.json({ success: false, error: 'Tracker request is invalid.' }, { status: 415 });
  }
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ success: false, error: 'Tracker request is too large.' }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Tracker request is invalid.' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ success: false, error: 'Tracker request is invalid.' }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const action = input.action;
  const token = input.token;
  if (action !== 'view' || !isGuestBookingToken(token)) {
    return NextResponse.json({ success: false, error: 'This booking link is invalid or unavailable.' }, { status: 404 });
  }

  const limitedResponse = await enforceGuestRateLimit(request, 'guest_tracker', token);
  if (limitedResponse) return limitedResponse;

  const serviceClient = createServiceClient();
  if (!serviceClient) {
    return NextResponse.json({ success: false, error: 'This service is temporarily unavailable.' }, { status: 503 });
  }
  const { data, error } = await serviceClient.rpc('get_guest_booking_tracker', { p_token: token });
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
    if (error) console.error('Guest booking tracker lookup failed.', error.code);
    return NextResponse.json(
      { success: false, error: 'This booking link is invalid, expired, revoked, or unavailable.' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } }
    );
  }
  return NextResponse.json(
    { success: true, data },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
