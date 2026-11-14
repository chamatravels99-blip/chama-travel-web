import { NextResponse } from 'next/server';
import { authorizationResponse, isSameOriginRequest, requireRoles } from '@/lib/server/authorization';
import { isGuestBookingToken } from '@/lib/guest-booking-token';
import { createClient } from '@/utils/supabase/server';
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
  if ((action !== 'view' && action !== 'claim') || !isGuestBookingToken(token)) {
    return NextResponse.json({ success: false, error: 'This booking link is invalid or unavailable.' }, { status: 404 });
  }

  const limitedResponse = await enforceGuestRateLimit(request, 'guest_tracker', token);
  if (limitedResponse) return limitedResponse;

  try {
    const supabase = await createClient();
    const serviceClient = createServiceClient();
    if (action === 'claim') {
      const { user } = await requireRoles(['customer']);
      if (!serviceClient) {
        return NextResponse.json({ success: false, error: 'This service is temporarily unavailable.' }, { status: 503 });
      }
      const { error } = await serviceClient.rpc('service_claim_guest_booking_access', {
        p_token: token,
        p_user_id: user.id,
      });
      if (error) {
        console.error('Guest booking account link failed.', error.code);
        return NextResponse.json(
          { success: false, error: 'This booking link is invalid, expired, revoked, or already linked.' },
          { status: 409, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      return NextResponse.json(
        { success: true, message: 'Booking linked to your customer account.' },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

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

    let canLinkToAccount = false;
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError && userError.code !== 'AuthSessionMissingError') {
      console.error('Guest tracker account role could not be checked.', userError.code);
    } else if (userData.user) {
      const { data: roles, error: rolesError } = await supabase.rpc('get_my_roles');
      if (rolesError) {
        console.error('Guest tracker account role could not be checked.', rolesError.code);
      } else {
        canLinkToAccount = Array.isArray(roles) && roles.includes('customer');
      }
    }

    return NextResponse.json(
      { success: true, data, can_link_to_account: canLinkToAccount },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return authorizationResponse(error);
  }
}
