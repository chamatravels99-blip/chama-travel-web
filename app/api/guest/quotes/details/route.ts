import { NextResponse } from 'next/server';
import { isSameOriginRequest } from '@/lib/server/authorization';
import { enforceGuestRateLimit } from '@/lib/server/rate-limit';
import { createServiceClient } from '@/lib/server/service-client';

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
    return NextResponse.json({ success: false, error: 'Quotation request is invalid.' }, { status: 400 });
  }

  const input =
    body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const quoteId = typeof input.quote_id === 'string' ? input.quote_id : '';
  const token = typeof input.token === 'string' ? input.token : '';

  if (!UUID_PATTERN.test(quoteId) || !TOKEN_PATTERN.test(token)) {
    return NextResponse.json(
      { success: false, error: 'This quotation link is invalid or expired.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const limitedResponse = await enforceGuestRateLimit(request, 'guest_token_validation', token);
  if (limitedResponse) return limitedResponse;

  const supabase = createServiceClient();
  if (!supabase) {
    console.error('Guest quote details lookup is not configured.');
    return NextResponse.json(
      { success: false, error: 'Quotation review is temporarily unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const { data, error } = await supabase.rpc('get_guest_quote_details', {
    p_quote_id: quoteId,
    p_token: token,
  });

  if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
    if (error) console.error('Guest quote details lookup failed.', error.code);
    return NextResponse.json(
      { success: false, error: 'This quotation link is invalid, expired, or no longer available.' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  return NextResponse.json(
    { success: true, data },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
