import { NextResponse } from 'next/server';
import { authorizationResponse, getAuthenticatedContext } from '@/lib/server/authorization';
import { isUuid, streamAuthorizedObject } from '@/lib/server/documents';

export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!isUuid(id)) {
      return NextResponse.json({ success: false, error: 'Document is unavailable.' }, { status: 404 });
    }
    const { supabase } = await getAuthenticatedContext();
    // The database decides access (admin, owning customer, accepted assigned driver); the client-supplied id is never trusted.
    const { data, error } = await supabase.rpc('authorize_booking_document', { p_document_id: id });
    const row = Array.isArray(data) ? data[0] : null;
    if (error || !row) {
      return NextResponse.json({ success: false, error: 'Document is unavailable.' }, { status: 404 });
    }
    const inline = new URL(request.url).searchParams.get('view') === '1';
    return streamAuthorizedObject(row.storage_path, row.mime_type, row.title, inline);
  } catch (error) {
    return authorizationResponse(error);
  }
}
