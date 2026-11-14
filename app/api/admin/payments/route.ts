import { NextResponse } from 'next/server';
import { authorizationResponse, isSameOriginRequest, requireRoles } from '@/lib/server/authorization';
import { parseAdminCustomerPaymentInput } from '@/lib/admin-customer-payment';
import { renderAndStoreBillingDocument } from '@/lib/server/documents';
import {
  parseAdminDriverHireOfferInput,
  parseAdminDriverHirePayoutInput,
} from '@/lib/admin-driver-hire';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET() {
  try {
    const { supabase } = await requireRoles(['admin', 'super_admin']);
    const [claims, payments, settlements, paymentCandidates, driverHire] = await Promise.all([
      supabase.rpc('list_payment_claims'),
      supabase.rpc('list_financial_records'),
      supabase.rpc('admin_list_driver_settlements'),
      supabase.rpc('admin_list_customer_payment_candidates'),
      supabase.rpc('admin_list_driver_hire_data'),
    ]);
    if (claims.error || payments.error || settlements.error || paymentCandidates.error || driverHire.error) {
      console.error(
        'Finance dashboard data failed.',
        claims.error?.code,
        payments.error?.code,
        settlements.error?.code,
        paymentCandidates.error?.code,
        driverHire.error?.code
      );
      return NextResponse.json({ success: false, error: 'Finance data is temporarily unavailable.' }, { status: 503 });
    }
    return NextResponse.json({
      success: true,
      data: {
        claims: claims.data ?? [],
        payments: payments.data ?? [],
        settlements: settlements.data ?? [],
        customer_payment_candidates: paymentCandidates.data ?? [],
        driver_hire: driverHire.data ?? {
          candidates: [],
          offers: [],
          offer_history: [],
          payouts: [],
        },
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return authorizationResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ success: false, error: 'Request origin is not allowed.' }, { status: 403 });
    }
    const { supabase } = await requireRoles(['admin', 'super_admin']);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Finance operation details are invalid.' }, { status: 400 });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: 'Finance operation details are invalid.' }, { status: 400 });
    }
    const input = body as Record<string, unknown>;

    if (input.action === 'record_customer_payment') {
      const paymentInput = parseAdminCustomerPaymentInput(input);
      if (!paymentInput) {
        return NextResponse.json({ success: false, error: 'Customer payment details are invalid.' }, { status: 400 });
      }

      const { data, error } = await supabase.rpc('admin_record_customer_payment', {
        p_booking_id: paymentInput.bookingId,
        p_quote_id: paymentInput.quoteId,
        p_amount: paymentInput.amount,
        p_method: paymentInput.method,
        p_payment_date: paymentInput.paymentDate,
        p_reference: paymentInput.reference || null,
        p_request_id: paymentInput.requestId,
      });
      if (error) {
        console.error('Customer payment recording failed.', error.code);
        return NextResponse.json(
          { success: false, error: 'The payment could not be recorded. Check the accepted quote and remaining balance.' },
          { status: 409 }
        );
      }
      const payment = Array.isArray(data) ? data[0] : null;
      if (!payment || typeof payment !== 'object' ||
          typeof payment.payment_id !== 'string' || typeof payment.receipt_number !== 'string' ||
          typeof payment.created !== 'boolean') {
        console.error('Customer payment RPC returned an unexpected response.');
        return NextResponse.json({ success: false, error: 'The payment result could not be verified.' }, { status: 503 });
      }
      let receiptDocumentId: string | null = null;
      const docResult = await supabase.rpc('admin_issue_payment_receipt_document', {
        p_payment_id: payment.payment_id,
      });
      const docRow = Array.isArray(docResult.data) ? docResult.data[0] : null;
      if (docRow && typeof docRow.document_id === 'string') {
        const docId: string = docRow.document_id;
        receiptDocumentId = docId;
        try {
          await renderAndStoreBillingDocument(supabase, docId);
        } catch (renderErr) {
          console.error('Automatic receipt PDF render failed.', renderErr instanceof Error ? renderErr.message : 'unknown');
        }
      }
      return NextResponse.json({
        success: true,
        data: {
          payment_id: payment.payment_id,
          receipt_number: payment.receipt_number,
          document_id: receiptDocumentId,
          created: payment.created,
        },
      }, { status: payment.created ? 201 : 200 });
    }

    if (input.action === 'review_claim') {
      const claimId = typeof input.claim_id === 'string' ? input.claim_id : '';
      if (!UUID_PATTERN.test(claimId) || typeof input.approve !== 'boolean') {
        return NextResponse.json({ success: false, error: 'Claim review details are invalid.' }, { status: 400 });
      }
      const note = typeof input.note === 'string' ? input.note.trim().slice(0, 1000) : '';
      const { error } = await supabase.rpc('review_payment_claim', {
        p_claim_id: claimId,
        p_approve: input.approve,
        p_review_note: note || null,
      });
      if (error) {
        console.error('Payment claim review failed.', error.code);
        return NextResponse.json({ success: false, error: 'This claim has already been reviewed or is unavailable.' }, { status: 409 });
      }
      return NextResponse.json({ success: true });
    }

    if (input.action === 'refund') {
      const paymentId = typeof input.payment_id === 'string' ? input.payment_id : '';
      const amountText = typeof input.amount === 'string' ? input.amount : String(input.amount ?? '');
      const amount = Number(amountText);
      const reason = typeof input.reason === 'string' ? input.reason.trim().slice(0, 500) : '';
      if (!UUID_PATTERN.test(paymentId) || !/^\d{1,10}(?:\.\d{1,2})?$/.test(amountText) ||
          !Number.isFinite(amount) || amount <= 0 || !reason) {
        return NextResponse.json({ success: false, error: 'Refund details are invalid.' }, { status: 400 });
      }
      const { data, error } = await supabase.rpc('record_payment_refund', {
        p_original_payment_id: paymentId,
        p_amount: amount,
        p_reason: reason,
      });
      if (error) {
        console.error('Payment refund failed.', error.code);
        return NextResponse.json(
          { success: false, error: 'The refund exceeds the remaining balance or the original receipt is unavailable.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ success: true, data: { refund_id: data } }, { status: 201 });
    }

    if (input.action === 'create_settlement') {
      const assignmentId = typeof input.assignment_id === 'string' ? input.assignment_id : '';
      const amountText = typeof input.amount === 'string' ? input.amount : String(input.amount ?? '');
      const amount = Number(amountText);
      if (!UUID_PATTERN.test(assignmentId) || !/^\d{1,10}(?:\.\d{1,2})?$/.test(amountText) ||
          !Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ success: false, error: 'Settlement details are invalid.' }, { status: 400 });
      }
      const { data, error } = await supabase.rpc('admin_create_driver_settlement', {
        p_assignment_id: assignmentId,
        p_amount: amountText,
      });
      if (error) {
        console.error('Driver settlement creation failed.', error.code);
        return NextResponse.json(
          { success: false, error: 'The completed assignment could not be settled. Verify the amount and assignment status.' },
          { status: 409 }
        );
      }
      const settlement = Array.isArray(data) ? data[0] : null;
      if (!settlement || typeof settlement !== 'object' ||
          typeof settlement.settlement_id !== 'string' || typeof settlement.created !== 'boolean') {
        console.error('Driver settlement creation returned an unexpected response.');
        return NextResponse.json(
          { success: false, error: 'The settlement result could not be verified.' },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { success: true, data: { settlement_id: settlement.settlement_id }, created: settlement.created },
        { status: settlement.created ? 201 : 200 }
      );
    }

    if (input.action === 'pay_settlement') {
      const settlementId = typeof input.settlement_id === 'string' ? input.settlement_id : '';
      const method = input.method;
      const referenceInput = input.reference;
      const reference = typeof referenceInput === 'string' ? referenceInput.trim() : '';
      if (!UUID_PATTERN.test(settlementId) ||
          typeof method !== 'string' || !['cash', 'bank_transfer'].includes(method) ||
          (referenceInput !== undefined && referenceInput !== null && typeof referenceInput !== 'string') ||
          reference.length > 160) {
        return NextResponse.json({ success: false, error: 'Payout details are invalid.' }, { status: 400 });
      }
      const { error } = await supabase.rpc('admin_pay_driver_settlement', {
        p_settlement_id: settlementId,
        p_method: method,
        p_reference: reference || null,
      });
      if (error) {
        console.error('Driver payout recording failed.', error.code);
        return NextResponse.json(
          { success: false, error: 'The payout could not be recorded. It may already have been paid.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ success: true });
    }

    if (input.action === 'create_driver_hire_offer') {
      const offerInput = parseAdminDriverHireOfferInput(input);
      if (!offerInput) {
        return NextResponse.json({ success: false, error: 'Driver hire offer details are invalid.' }, { status: 400 });
      }
      const { data, error } = await supabase.rpc('admin_create_driver_hire_offer', {
        p_assignment_id: offerInput.assignmentId,
        p_amount: offerInput.amount,
        p_currency: offerInput.currency,
        p_request_id: offerInput.requestId,
      });
      if (error) {
        console.error('Driver hire offer creation failed.', error.code);
        return NextResponse.json(
          { success: false, error: 'The driver hire offer could not be issued. Verify the assignment and remaining payout balance.' },
          { status: 409 }
        );
      }
      const offer = Array.isArray(data) ? data[0] : null;
      if (!offer || typeof offer !== 'object' ||
          typeof offer.offer_id !== 'string' || typeof offer.created !== 'boolean') {
        console.error('Driver hire offer RPC returned an unexpected response.');
        return NextResponse.json({ success: false, error: 'The offer result could not be verified.' }, { status: 503 });
      }
      return NextResponse.json(
        { success: true, data: { offer_id: offer.offer_id }, created: offer.created },
        { status: offer.created ? 201 : 200 }
      );
    }

    if (input.action === 'record_driver_hire_payout') {
      const payoutInput = parseAdminDriverHirePayoutInput(input);
      if (!payoutInput) {
        return NextResponse.json({ success: false, error: 'Driver payout details are invalid.' }, { status: 400 });
      }
      const { data, error } = await supabase.rpc('admin_record_driver_hire_payout', {
        p_assignment_id: payoutInput.assignmentId,
        p_amount: payoutInput.amount,
        p_payment_date: payoutInput.paymentDate,
        p_payment_method: payoutInput.method,
        p_payment_reference: payoutInput.reference || null,
        p_request_id: payoutInput.requestId,
      });
      if (error) {
        console.error('Driver hire payout recording failed.', error.code);
        return NextResponse.json(
          { success: false, error: 'The payout could not be recorded. Verify the accepted hire offer and outstanding balance.' },
          { status: 409 }
        );
      }
      const payout = Array.isArray(data) ? data[0] : null;
      if (!payout || typeof payout !== 'object' ||
          typeof payout.payout_id !== 'string' || typeof payout.created !== 'boolean') {
        console.error('Driver hire payout RPC returned an unexpected response.');
        return NextResponse.json({ success: false, error: 'The payout result could not be verified.' }, { status: 503 });
      }
      return NextResponse.json(
        { success: true, data: { payout_id: payout.payout_id }, created: payout.created },
        { status: payout.created ? 201 : 200 }
      );
    }

    return NextResponse.json({ success: false, error: 'Unsupported finance operation.' }, { status: 400 });
  } catch (error) {
    return authorizationResponse(error);
  }
}
