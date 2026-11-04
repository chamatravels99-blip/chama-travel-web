import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { isSameOriginRequest } from '@/lib/server/authorization';

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
    return NextResponse.json({ success: false, error: 'Acceptance details are invalid.' }, { status: 400 });
  }
  const input = body && typeof body === 'object' && !Array.isArray(body)
    ? body as Record<string, unknown>
    : {};
  const quoteId = typeof input.quote_id === 'string' ? input.quote_id : '';
  const token = typeof input.token === 'string' ? input.token : '';
  if (!UUID_PATTERN.test(quoteId) || !TOKEN_PATTERN.test(token)) {
    return NextResponse.json({ success: false, error: 'This acceptance link is invalid or expired.' }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    console.error('Guest quote acceptance is not configured.');
    return NextResponse.json({ success: false, error: 'Quote acceptance is temporarily unavailable.' }, { status: 503 });
  }

  const supabase = createSupabaseClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await supabase.rpc('accept_guest_quote', {
    p_quote_id: quoteId,
    p_token: token,
  });
  if (error) {
    console.error('Guest quote acceptance failed.', error.code);
    return NextResponse.json(
      { success: false, error: 'This acceptance link is invalid, expired, or already used.' },
      { status: 409, headers: { 'Cache-Control': 'no-store' } }
    );
  }
  return NextResponse.json(
    { success: true, message: 'Your booking is confirmed.' },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
