import { NextResponse } from 'next/server';
import { authorizationResponse, isSameOriginRequest, requireRoles } from '@/lib/server/authorization';
import { detectMime, isUuid } from '@/lib/server/documents';
import { createServiceClient, DOCUMENT_BUCKET } from '@/lib/server/service-client';
import { sha256Hex } from '@/lib/pdf/billing-documents';

const NO_STORE = { 'Cache-Control': 'no-store' };
const MAX_BYTES = 5 * 1024 * 1024;

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status, headers: NO_STORE });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return fail('Request origin is not allowed.', 403);
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_BYTES + 64 * 1024) return fail('File is too large.', 413);

  try {
    const { supabase } = await requireRoles(['admin', 'super_admin']);
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return fail('Upload is invalid.', 400);
    }
    const bookingId = form.get('booking_id');
    const title = form.get('title');
    const file = form.get('file');
    if (!isUuid(bookingId) || typeof title !== 'string' || !(file instanceof File)) return fail('Upload is invalid.', 400);
    if (file.size === 0 || file.size > MAX_BYTES) return fail('File must be between 1 byte and 5 MB.', 413);

    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = detectMime(bytes);
    if (!mime) return fail('Only PDF, PNG, and JPEG files are allowed.', 415);

    const { data, error } = await supabase.rpc('admin_create_document_upload', {
      p_booking_id: bookingId,
      p_title: title,
      p_mime_type: mime,
      p_byte_size: bytes.length,
      p_customer_visible: form.get('customer_visible') === 'true',
      p_driver_visible: form.get('driver_visible') === 'true',
    });
    const row = Array.isArray(data) ? data[0] : null;
    if (error || !row) {
      if (error) console.error('Document upload registration failed.', error.code);
      return fail('The document could not be registered.', 409);
    }

    const service = createServiceClient();
    if (!service) return fail('Storage is temporarily unavailable.', 503);
    const upload = await service.storage
      .from(DOCUMENT_BUCKET)
      .upload(row.storage_path, bytes, { contentType: mime, upsert: false });
    if (upload.error) {
      console.error('Document upload failed.');
      return fail('The document could not be stored.', 502);
    }
    const { error: markError } = await supabase.rpc('admin_mark_document_stored', {
      p_document_id: row.document_id,
      p_sha256_hex: await sha256Hex(bytes),
      p_byte_size: bytes.length,
    });
    if (markError) return fail('The document could not be finalized.', 409);
    return NextResponse.json({ success: true, document_id: row.document_id }, { headers: NO_STORE });
  } catch (error) {
    return authorizationResponse(error);
  }
}
