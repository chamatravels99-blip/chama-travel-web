import { NextResponse } from 'next/server';
import { authorizationResponse, isSameOriginRequest, requireRoles } from '@/lib/server/authorization';
import { isUuid, readJsonBody } from '@/lib/server/documents';
import { enforceGuestRateLimit } from '@/lib/server/rate-limit';
import { createServiceClient } from '@/lib/server/service-client';
import { isGuestBookingToken } from '@/lib/guest-booking-token';

const NO_STORE = { 'Cache-Control': 'no-store' };
const GENERIC = 'This invitation is invalid, expired, revoked, or unavailable.';

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status, headers: NO_STORE });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return fail('Request origin is not allowed.', 403);
  const input = await readJsonBody(request, 4096);
  if (!input) return fail('Request is invalid.', 400);

  const action = input.action;
  const token = input.token;
  if (!isGuestBookingToken(token)) return fail(GENERIC, 404);
  if (!['view', 'accept', 'decline', 'offer', 'link'].includes(String(action))) return fail('Request is invalid.', 400);

  const limited = await enforceGuestRateLimit(request, action === 'link' ? 'guest_driver_link' : 'guest_driver_invitation', token);
  if (limited) return limited;

  try {
    if (action === 'link') {
      const { user } = await requireRoles(['driver']);
      const service = createServiceClient();
      if (!service) return fail('This service is temporarily unavailable.', 503);
      const { error } = await service.rpc('service_claim_driver_invitation', {
        p_token: token,
        p_user_id: user.id,
      });
      if (error) {
        console.error('Driver invitation link failed.', error.code);
        return fail('This invitation cannot be linked to your account.', 409);
      }
      return NextResponse.json({ success: true, redirect: '/driver/dashboard' }, { headers: NO_STORE });
    }

    const service = createServiceClient();
    if (!service) return fail('This service is temporarily unavailable.', 503);

    if (action === 'view') {
      const { data, error } = await service.rpc('get_guest_driver_invitation', { p_token: token });
      if (error || !data) {
        if (error) console.error('Driver invitation lookup failed.', error.code);
        return fail(GENERIC, 404);
      }
      return NextResponse.json({ success: true, data }, { headers: NO_STORE });
    }

    if (action === 'accept' || action === 'decline') {
      const { error } = await service.rpc('guest_driver_respond_assignment', { p_token: token, p_action: action });
      if (error) {
        console.error('Driver invitation response failed.', error.code);
        return fail('This response could not be recorded. The assignment may already have changed.', 409);
      }
      return NextResponse.json({ success: true }, { headers: NO_STORE });
    }

    if (!isUuid(input.offer_id) || typeof input.accept !== 'boolean') return fail('Request is invalid.', 400);
    const { error } = await service.rpc('guest_driver_respond_hire_offer', {
      p_token: token,
      p_offer_id: input.offer_id,
      p_accept: input.accept,
    });
    if (error) {
      console.error('Driver hire offer response failed.', error.code);
      return fail('This offer response could not be recorded.', 409);
    }
    return NextResponse.json({ success: true }, { headers: NO_STORE });
  } catch (error) {
    return authorizationResponse(error);
  }
}
