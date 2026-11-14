import { NextResponse } from 'next/server';
import { authorizationResponse, isSameOriginRequest, requireRoles } from '@/lib/server/authorization';
import { isUuid, readJsonBody } from '@/lib/server/documents';

const NO_STORE = { 'Cache-Control': 'no-store' };

/** Admin control to revoke or restore guest document access for a booking audience. */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ success: false, error: 'Request origin is not allowed.' }, { status: 403 });
  }
  const input = await readJsonBody(request);
  if (!input || !isUuid(input.booking_id) || (input.audience !== 'customer' && input.audience !== 'driver')
      || typeof input.enabled !== 'boolean') {
    return NextResponse.json({ success: false, error: 'Request is invalid.' }, { status: 400, headers: NO_STORE });
  }
  try {
    const { supabase } = await requireRoles(['admin', 'super_admin']);
    const { error } = await supabase.rpc('admin_set_guest_document_access', {
      p_booking_id: input.booking_id,
      p_audience: input.audience,
      p_enabled: input.enabled,
    });
    if (error) {
      console.error('Guest document access update failed.', error.code);
      return NextResponse.json({ success: false, error: 'Access could not be updated.' }, { status: 409, headers: NO_STORE });
    }
    return NextResponse.json({ success: true }, { headers: NO_STORE });
  } catch (error) {
    return authorizationResponse(error);
  }
}
