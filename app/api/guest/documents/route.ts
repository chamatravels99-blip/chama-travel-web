import { NextResponse } from 'next/server';
import { isSameOriginRequest } from '@/lib/server/authorization';
import { isUuid, readJsonBody, streamAuthorizedObject } from '@/lib/server/documents';
import { enforceGuestRateLimit } from '@/lib/server/rate-limit';
import { createServiceClient } from '@/lib/server/service-client';
import { isGuestBookingToken } from '@/lib/guest-booking-token';

const NO_STORE = { 'Cache-Control': 'no-store' };
const GENERIC = 'Documents are unavailable for this link.';

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status, headers: NO_STORE });
}

// The token travels in the POST body, never in a URL, so it is not logged or cached.
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return fail('Request origin is not allowed.', 403);
  const input = await readJsonBody(request, 4096);
  if (!input) return fail('Request is invalid.', 400);

  const { token, audience, action } = input;
  if (!isGuestBookingToken(token) || (audience !== 'customer' && audience !== 'driver')) return fail(GENERIC, 404);
  if (action !== 'list' && action !== 'download' && action !== 'view') return fail('Request is invalid.', 400);
  if (action !== 'list' && !isUuid(input.document_id)) return fail(GENERIC, 404);

  const limited = await enforceGuestRateLimit(request, 'guest_documents', token);
  if (limited) return limited;

  const service = createServiceClient();
  if (!service) return fail('This service is temporarily unavailable.', 503);

  if (action === 'list') {
    const { data, error } = await service.rpc(`guest_${audience}_list_documents`, { p_token: token });
    if (error) {
      console.error('Guest document list failed.', error.code);
      return fail(GENERIC, 404);
    }
    return NextResponse.json({ success: true, data }, { headers: NO_STORE });
  }

  const { data, error } = await service.rpc(`guest_${audience}_authorize_document`, {
    p_token: token,
    p_document_id: input.document_id,
  });
  const row = Array.isArray(data) ? data[0] : null;
  if (error || !row) {
    if (error) console.error('Guest document authorization failed.', error.code);
    return fail(GENERIC, 404);
  }
  return streamAuthorizedObject(row.storage_path, row.mime_type, row.title, action === 'view');
}
