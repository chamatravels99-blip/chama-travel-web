import { NextResponse } from 'next/server';
import { authorizationResponse, getAuthenticatedContext } from '@/lib/server/authorization';
import { isUuid } from '@/lib/server/documents';

export async function GET(request: Request) {
  try {
    const bookingId = new URL(request.url).searchParams.get('booking_id');
    if (!isUuid(bookingId)) {
      return NextResponse.json({ success: false, error: 'Booking is invalid.' }, { status: 400 });
    }
    const { supabase } = await getAuthenticatedContext();
    const { data, error } = await supabase.rpc('list_my_booking_documents', { p_booking_id: bookingId });
    if (error) {
      console.error('Document list failed.', error.code);
      return NextResponse.json({ success: false, error: 'Documents could not be loaded.' }, { status: 400 });
    }
    return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return authorizationResponse(error);
  }
}
