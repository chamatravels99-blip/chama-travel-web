import { NextResponse } from 'next/server';
import { authorizationResponse, isSameOriginRequest, requireRoles } from '@/lib/server/authorization';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ success: false, error: 'Request origin is not allowed.' }, { status: 403 });
    }
    const { supabase } = await requireRoles(['customer']);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Quote details are invalid.' }, { status: 400 });
    }
    const quoteId = body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>).quote_id
      : null;
    if (typeof quoteId !== 'string' || !UUID_PATTERN.test(quoteId)) {
      return NextResponse.json({ success: false, error: 'Quote details are invalid.' }, { status: 400 });
    }

    const { error } = await supabase.rpc('accept_customer_quote', { p_quote_id: quoteId });
    if (error) {
      console.error('Customer quote acceptance failed.', error.code);
      return NextResponse.json(
        { success: false, error: 'This quote is expired, unavailable, or already processed.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: true, message: 'Your booking is confirmed.' });
  } catch (error) {
    return authorizationResponse(error);
  }
}
