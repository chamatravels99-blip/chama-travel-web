import { NextResponse } from 'next/server';
import { authorizationResponse, isSameOriginRequest, requireRoles } from '@/lib/server/authorization';
import { isUuid, readJsonBody, renderAndStoreBillingDocument } from '@/lib/server/documents';

const NO_STORE = { 'Cache-Control': 'no-store' };

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status, headers: NO_STORE });
}

export async function GET(request: Request) {
  try {
    const { supabase } = await requireRoles(['admin', 'super_admin']);
    const bookingId = new URL(request.url).searchParams.get('booking_id');
    if (!isUuid(bookingId)) return fail('Booking is invalid.', 400);
    const [documents, paymentSummary] = await Promise.all([
      supabase.rpc('admin_list_booking_billing_documents', { p_booking_id: bookingId }),
      supabase.rpc('admin_get_booking_payment_summary', { p_booking_id: bookingId }),
    ]);
    if (documents.error || paymentSummary.error) {
      console.error('Booking billing details failed.', documents.error?.code, paymentSummary.error?.code);
      return fail('Billing details could not be loaded.', 503);
    }
    if (!documents.data || !paymentSummary.data) {
      return fail('Billing details could not be loaded.', 503);
    }
    return NextResponse.json({
      success: true,
      data: { ...documents.data, payment_summary: paymentSummary.data },
    }, { headers: NO_STORE });
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
    const action = input.action;
    let documentId: string | null = null;
    let message = '';

    if (action === 'issue_invoice') {
      if (!isUuid(input.booking_id) || !isUuid(input.quote_id) || !isUuid(input.request_id)) {
        return fail('Invoice request is invalid.', 400);
      }
      const { data, error } = await supabase.rpc('admin_issue_invoice', {
        p_booking_id: input.booking_id,
        p_quote_id: input.quote_id,
        p_request_id: input.request_id,
      });
      const row = Array.isArray(data) ? data[0] : null;
      if (error || !row || !isUuid(row.invoice_id) || !isUuid(row.document_id) ||
          typeof row.invoice_number !== 'string' || typeof row.created !== 'boolean') {
        if (error) console.error('Invoice issue failed.', error.code);
        return fail('The invoice could not be issued for this booking.', 409);
      }
      documentId = row.document_id;
      message = `Invoice ${row.invoice_number} issued.`;
    } else if (action === 'replace_invoice') {
      const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
      if (!isUuid(input.invoice_id) || !isUuid(input.request_id) || reason.length < 3 || reason.length > 500) {
        return fail('Invoice request is invalid.', 400);
      }
      const { data, error } = await supabase.rpc('admin_replace_invoice', {
        p_invoice_id: input.invoice_id,
        p_reason: reason,
        p_request_id: input.request_id,
      });
      const row = Array.isArray(data) ? data[0] : null;
      if (error || !row || !isUuid(row.invoice_id) || !isUuid(row.document_id) ||
          typeof row.invoice_number !== 'string' || typeof row.created !== 'boolean') {
        if (error) console.error('Invoice replace failed.', error.code);
        return fail('The invoice could not be replaced.', 409);
      }
      documentId = row.document_id;
      message = `Replacement invoice ${row.invoice_number} issued.`;
    } else if (action === 'cancel_invoice') {
      const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
      if (!isUuid(input.invoice_id) || reason.length < 3 || reason.length > 500) {
        return fail('Invoice request is invalid.', 400);
      }
      const { error } = await supabase.rpc('admin_cancel_invoice', {
        p_invoice_id: input.invoice_id,
        p_reason: reason,
      });
      if (error) {
        console.error('Invoice cancel failed.', error.code);
        return fail('The invoice could not be cancelled.', 409);
      }
      return NextResponse.json({ success: true, message: 'Invoice cancelled.' }, { headers: NO_STORE });
    } else if (action === 'issue_receipt') {
      if (!isUuid(input.payment_id)) return fail('Receipt request is invalid.', 400);
      const { data, error } = await supabase.rpc('admin_issue_payment_receipt_document', {
        p_payment_id: input.payment_id,
      });
      const row = Array.isArray(data) ? data[0] : null;
      if (error || !row || !isUuid(row.document_id) || typeof row.created !== 'boolean') {
        if (error) console.error('Receipt document issue failed.', error.code);
        return fail('A receipt could not be issued for this payment.', 409);
      }
      documentId = row.document_id;
      message = 'Receipt ready.';
    } else if (action === 'retry_render') {
      if (!isUuid(input.document_id)) return fail('Request is invalid.', 400);
      documentId = input.document_id;
      message = 'Document regenerated.';
    } else {
      return fail('Request is invalid.', 400);
    }

    if (documentId) {
      try {
        await renderAndStoreBillingDocument(supabase, documentId);
      } catch (error) {
        console.error('Billing document rendering failed.', error instanceof Error ? error.message : 'unknown');
        return NextResponse.json(
          { success: true, document_id: documentId, message, warning: 'Issued, but the PDF is not ready yet. Retry to regenerate it.' },
          { status: 202, headers: NO_STORE }
        );
      }
    }
    return NextResponse.json({ success: true, document_id: documentId, message }, { headers: NO_STORE });
  } catch (error) {
    return authorizationResponse(error);
  }
}
