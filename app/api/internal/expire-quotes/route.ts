import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

function constantTimeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i += 1) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
}

export async function POST(request: Request) {
  const secret = process.env.QUOTE_EXPIRY_CRON_SECRET;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!secret || !serviceRoleKey || !supabaseUrl) {
    console.error('Quote expiry job is not configured.');
    return NextResponse.json({ success: false, error: 'Job is not configured.' }, { status: 503 });
  }

  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!constantTimeEqual(supplied, secret)) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase.rpc('expire_booking_quotes');
  if (error) {
    console.error('Quote expiry operation failed.', error.code);
    return NextResponse.json({ success: false, error: 'Quote expiry operation failed.' }, { status: 503 });
  }
  return NextResponse.json({ success: true, expired_quotes: data }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
