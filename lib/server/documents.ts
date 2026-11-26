import type { SupabaseClient } from '@supabase/supabase-js';
import {
  renderInvoicePdf,
  renderReceiptPdf,
  sha256Hex,
  type ReceiptRenderOptions,
} from '@/lib/pdf/billing-documents';
import { createServiceClient, DOCUMENT_BUCKET } from '@/lib/server/service-client';
import { getServerSiteSettings } from '@/lib/server/site-settings';

export interface BillingRenderOptions {
  invoiceNote?: string | null;
  paymentType?: string | null;
  paymentNote?: string | null;
  paymentRef?: string | null;
  bookingId?: string | null;
}

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function detectMime(bytes: Uint8Array) {
  const startsWith = (sig: number[]) => sig.every((value, index) => bytes[index] === value);
  if (startsWith([0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf';
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith([0xff, 0xd8, 0xff])) return 'image/jpeg';
  return null;
}

export async function readJsonBody(request: Request, maxBytes = 8192): Promise<Record<string, unknown> | null> {
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) return null;
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Renders the PDF for an Admin-created pending billing document from its
 * database snapshot, uploads it to the private bucket and marks it stored.
 * The Admin session client performs the authorizing RPCs; the service client
 * only moves bytes after those RPCs succeeded.
 */
export async function renderAndStoreBillingDocument(
  adminClient: SupabaseClient,
  documentId: string,
  options: BillingRenderOptions = {}
) {
  const { data, error } = await adminClient.rpc('admin_get_document_for_render', { p_document_id: documentId });
  if (error || !data || typeof data !== 'object') throw new Error('Document could not be loaded.');
  const doc = data as {
    document_type: string;
    storage_path: string;
    file_status: string;
    booking_id?: string | null;
    snapshot: unknown;
  };
  if (doc.file_status === 'stored') return;
  if (doc.document_type !== 'invoice' && doc.document_type !== 'receipt') {
    throw new Error('Only invoice and receipt documents can be generated here.');
  }
  if (!doc.snapshot) throw new Error('Document snapshot is unavailable.');

  const siteSettings = await getServerSiteSettings(adminClient);
  const companySettings = {
    businessName: siteSettings.business_name,
    officeAddress: siteSettings.office_address,
    primaryPhone: siteSettings.primary_phone,
    contactEmail: siteSettings.contact_email,
    registrationNumber: siteSettings.registration_number,
    bankAccountDetails: siteSettings.bank_account_details,
    invoiceFooterNote: siteSettings.invoice_footer_note,
  };

  let bytes: Uint8Array;
  if (doc.document_type === 'invoice') {
    bytes = await renderInvoicePdf(doc.snapshot, {
      invoiceNote: options.invoiceNote ?? null,
      companySettings,
    });
  } else {
    // Optionally enrich receipt journey details (route/date/passengers) without ever exposing internal notes
    let journey: ReceiptRenderOptions['journey'] = null;
    const targetBookingId =
      options.bookingId ??
      doc.booking_id ??
      (doc.snapshot && typeof doc.snapshot === 'object' && 'booking_id' in doc.snapshot
        ? String((doc.snapshot as Record<string, unknown>).booking_id)
        : null);

    if (targetBookingId && isUuid(targetBookingId)) {
      try {
        const bookingRes = await adminClient.rpc('get_booking_for_calendar_sync', {
          p_booking_id: targetBookingId,
          p_quote_id: null,
        });
        if (!bookingRes.error && bookingRes.data && typeof bookingRes.data === 'object') {
          const b = bookingRes.data as {
            service_type?: string;
            journey_type?: string;
            passenger_count?: number;
            luggage_count?: number;
            legs?: Array<{
              pickup_location?: string;
              dropoff_location?: string;
              pickup_at?: string;
            }>;
          };
          const firstLeg = Array.isArray(b.legs) ? b.legs[0] : undefined;
          const lastLeg = Array.isArray(b.legs) ? b.legs[b.legs.length - 1] : firstLeg;
          journey = {
            service_type: b.service_type ?? null,
            journey_type: b.journey_type ?? null,
            passenger_count: b.passenger_count ?? null,
            luggage_count: b.luggage_count ?? null,
            pickup_location: firstLeg?.pickup_location ?? null,
            dropoff_location: lastLeg?.dropoff_location ?? firstLeg?.dropoff_location ?? null,
            pickup_at: firstLeg?.pickup_at ?? null,
          };
        }
      } catch {
        // Non-blocking journey enrichment
      }
    }

    bytes = await renderReceiptPdf(doc.snapshot, {
      paymentType: options.paymentType ?? null,
      paymentNote: options.paymentNote ?? null,
      paymentRef: options.paymentRef ?? null,
      companySettings,
      journey,
    });
  }

  if (bytes.length === 0 || bytes.length > MAX_DOCUMENT_BYTES) {
    throw new Error('Generated PDF exceeds the 5 MB document limit.');
  }
  const service = createServiceClient();
  if (!service) throw new Error('Storage is not configured.');

  const upload = await service.storage
    .from(DOCUMENT_BUCKET)
    .upload(doc.storage_path, bytes, { contentType: 'application/pdf', upsert: false });
  // A previous attempt may have uploaded the bytes before failing to mark them.
  if (upload.error && !/exist|duplicate/i.test(upload.error.message)) throw new Error('Document upload failed.');

  const { error: markError } = await adminClient.rpc('admin_mark_document_stored', {
    p_document_id: documentId,
    p_sha256_hex: await sha256Hex(bytes),
    p_byte_size: bytes.length,
  });
  if (markError) throw new Error('Document could not be finalized.');
}

export function pdfResponse(bytes: ArrayBuffer | Uint8Array, filename: string) {
  const safe = filename.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80) || 'document';
  return new Response(bytes as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safe}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

/** Streams an object only after the caller has been authorized by an RPC. */
export async function streamAuthorizedObject(
  storagePath: string,
  mimeType: string,
  title: string,
  inline = false
) {
  const service = createServiceClient();
  if (!service) return Response.json({ success: false, error: 'Documents are temporarily unavailable.' }, { status: 503 });
  const { data, error } = await service.storage.from(DOCUMENT_BUCKET).download(storagePath);
  if (error || !data) {
    return Response.json({ success: false, error: 'Document is unavailable.' }, { status: 404 });
  }
  const extension = mimeType === 'application/pdf' ? 'pdf' : mimeType === 'image/png' ? 'png' : 'jpg';
  const safe = title.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 60) || 'document';
  const disposition = inline && mimeType === 'application/pdf' ? 'inline' : 'attachment';
  return new Response(await data.arrayBuffer(), {
    headers: {
      'Content-Type': mimeType,
      'Content-Disposition': `${disposition}; filename="${safe}.${extension}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      ...(disposition === 'inline' ? { 'Content-Security-Policy': 'sandbox' } : {}),
    },
  });
}
