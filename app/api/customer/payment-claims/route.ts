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
      return NextResponse.json({ success: false, error: 'Payment claim details are invalid.' }, { status: 400 });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: 'Payment claim details are invalid.' }, { status: 400 });
    }
    const input = body as Record<string, unknown>;
    const bookingId = typeof input.booking_id === 'string' ? input.booking_id : '';
    const quoteId = typeof input.quote_id === 'string' ? input.quote_id : '';
    const method = input.method;
    const amount = Number(input.amount);
    const reference = typeof input.customer_reference === 'string'
      ? input.customer_reference.trim().slice(0, 160)
      : '';
    if (!UUID_PATTERN.test(bookingId) || !UUID_PATTERN.test(quoteId) ||
        !['cash', 'bank_transfer'].includes(String(method)) ||
        !Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount * 100)) {
      return NextResponse.json({ success: false, error: 'Enter a valid payment amount and method.' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('submit_payment_claim', {
      p_booking_id: bookingId,
      p_quote_id: quoteId,
      p_amount: amount,
      p_method: method,
      p_customer_reference: reference || null,
    });
    if (error) {
      console.error('Payment claim submission failed.', error.code);
      return NextResponse.json(
        { success: false, error: 'The payment claim could not be submitted. Only accepted quotes can receive claims.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: true, data: { claim_id: data } }, { status: 201 });
  } catch (error) {
    return authorizationResponse(error);
  }
}
