import { NextResponse } from 'next/server';
import { authorizationResponse, isSameOriginRequest, requireRoles } from '@/lib/server/authorization';
import { isUuid, readJsonBody } from '@/lib/server/documents';

const NO_STORE = { 'Cache-Control': 'no-store' };

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status, headers: NO_STORE });
}

export async function GET(request: Request) {
  try {
    const { supabase } = await requireRoles(['admin', 'super_admin']);
    const bookingId = new URL(request.url).searchParams.get('booking_id');
    if (!isUuid(bookingId)) return fail('Booking is invalid.', 400);
    const { data, error } = await supabase.rpc('admin_list_driver_invitations', { p_booking_id: bookingId });
    if (error) {
      console.error('Driver invitation list failed.', error.code);
      return fail('Invitations could not be loaded.', 400);
    }
    return NextResponse.json({ success: true, data }, { headers: NO_STORE });
  } catch (error) {
    return authorizationResponse(error);
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return fail('Request origin is not allowed.', 403);
  const input = await readJsonBody(request);
  if (!input) return fail('Request is invalid.', 400);

  try {
    const { supabase } = await requireRoles(['admin', 'super_admin']);
    if (input.action === 'create') {
      if (!isUuid(input.assignment_id)) return fail('Assignment is invalid.', 400);
      const hours = typeof input.expires_in_hours === 'number' ? Math.trunc(input.expires_in_hours) : 72;
      const { data, error } = await supabase.rpc('admin_create_driver_invitation', {
        p_assignment_id: input.assignment_id,
        p_expires_in_hours: hours,
      });
      const row = Array.isArray(data) ? data[0] : null;
      if (error || !row) {
        if (error) console.error('Driver invitation creation failed.', error.code);
        return fail('The invitation could not be created for this assignment.', 409);
      }
      // The raw token is returned once for the Admin to share; nothing is sent automatically.
      const link = `${new URL(request.url).origin}/driver/invitation#token=${row.token}`;
      return NextResponse.json(
        { success: true, invitation_id: row.invitation_id, expires_at: row.expires_at, link },
        { headers: NO_STORE }
      );
    }
    if (input.action === 'revoke') {
      if (!isUuid(input.invitation_id)) return fail('Invitation is invalid.', 400);
      const { error } = await supabase.rpc('admin_revoke_driver_invitation', { p_invitation_id: input.invitation_id });
      if (error) {
        console.error('Driver invitation revoke failed.', error.code);
        return fail('The invitation could not be revoked.', 409);
      }
      return NextResponse.json({ success: true, message: 'Invitation revoked.' }, { headers: NO_STORE });
    }
    return fail('Request is invalid.', 400);
  } catch (error) {
    return authorizationResponse(error);
  }
}
