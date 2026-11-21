'use client';

import { Suspense, useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { whatsAppLink } from '@/lib/whatsapp';

type Claim = {
  id: string;
  booking_id: string;
  booking_ref: string;
  customer_name: string;
  quote_id: string;
  amount: number;
  currency: string;
  method: string;
  customer_reference: string | null;
  claim_status: string;
  submitted_at: string;
};
type Payment = {
  id: string;
  booking_id: string;
  booking_ref: string;
  entry_type: string;
  original_payment_id: string | null;
  amount: number;
  currency: string;
  method: string;
  refund_reason: string | null;
  receipt_number: string | null;
  payment_date: string | null;
  verified_at: string;
};
type BillingDocument = {
  document_type: 'invoice' | 'receipt';
  record_id: string;
  record_number: string;
  booking_id: string;
  booking_ref: string;
  customer_name: string;
  customer_email: string | null;
  currency: string;
  amount: number;
  status: string;
  recorded_at: string;
  document_id: string | null;
  file_status: 'pending' | 'stored' | null;
  payment_id: string | null;
};
type Settlement = {
  id: string;
  booking_ref: string;
  driver_name: string;
  currency: string;
  amount: number;
  settlement_status: 'pending' | 'paid';
  payout_method: string | null;
  payout_reference: string | null;
  created_at: string;
  paid_at: string | null;
};
type DriverHireCandidate = {
  assignment_id: string;
  booking_ref: string;
  driver_user_id: string;
  driver_name: string;
  assignment_status: string;
  current_offer_id: string | null;
  current_offer_status: 'offered' | 'accepted' | 'declined' | null;
  current_amount: number | null;
  current_currency: string | null;
};
type CustomerPaymentCandidate = {
  booking_id: string;
  booking_ref: string;
  customer_name: string;
  customer_phone: string;
  quote_id: string;
  currency: string;
  total: number;
  amount_paid: number;
  balance: number;
};
type CustomerPaymentInput = {
  amount: string;
  method: string;
  payment_date: string;
  reference: string;
  request_id: string;
};
type DriverHireOffer = {
  id: string;
  assignment_id: string;
  booking_ref: string;
  driver_user_id: string;
  driver_name: string;
  revision: number;
  amount: number;
  currency: string;
  offer_status: 'offered' | 'accepted' | 'declined';
  is_current: boolean;
  created_at: string;
  responded_at: string | null;
  paid_total: number;
  outstanding: number | null;
};
type DriverHirePayout = {
  id: string;
  assignment_id: string;
  booking_ref: string;
  driver_user_id: string;
  driver_name: string;
  amount: number;
  currency: string;
  payment_date: string;
  payment_method: string;
  payment_reference: string | null;
  recorded_at: string;
};
type DriverHireFinance = {
  candidates: DriverHireCandidate[];
  offers: DriverHireOffer[];
  offer_history: DriverHireOffer[];
  payouts: DriverHirePayout[];
};
type DriverHireOfferInput = {
  amount: string;
  currency: string;
  request_id: string;
};
type DriverHirePayoutInput = {
  amount: string;
  payment_date: string;
  method: string;
  reference: string;
  request_id: string;
};

const EMPTY_CUSTOMER_PAYMENT: CustomerPaymentInput = {
  amount: '',
  method: 'cash',
  payment_date: '',
  reference: '',
  request_id: '',
};
const EMPTY_DRIVER_HIRE_OFFER: DriverHireOfferInput = {
  amount: '',
  currency: 'LKR',
  request_id: '',
};
const EMPTY_DRIVER_HIRE_PAYOUT: DriverHirePayoutInput = {
  amount: '',
  payment_date: '',
  method: 'bank_transfer',
  reference: '',
  request_id: '',
};

async function fetchBillingDocuments(search: string, type: string, offset: number) {
  const params = new URLSearchParams({ offset: String(offset) });
  if (search) params.set('search', search);
  if (type) params.set('type', type);
  const response = await fetch(`/api/admin/billing/documents?${params}`, { cache: 'no-store' });
  const result = await response.json() as {
    success?: boolean;
    error?: string;
    data?: BillingDocument[];
    has_more?: boolean;
  };
  if (!response.ok || !result.success || !Array.isArray(result.data)) {
    throw new Error(result.error || 'Billing document history could not be loaded.');
  }
  return { documents: result.data, hasMore: result.has_more === true };
}

function PaymentsPageContent() {
  const searchParams = useSearchParams();
  const bookingFilter = searchParams.get('booking_id') ?? '';
  const bookingRefFilter = searchParams.get('booking_ref') ?? '';
  const [claims, setClaims] = useState<Claim[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [billingDocuments, setBillingDocuments] = useState<BillingDocument[]>([]);
  const [billingSearchInput, setBillingSearchInput] = useState('');
  const [billingTypeInput, setBillingTypeInput] = useState('');
  const [billingSearch, setBillingSearch] = useState('');
  const [billingType, setBillingType] = useState('');
  const [billingHasMore, setBillingHasMore] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [customerPaymentCandidates, setCustomerPaymentCandidates] = useState<CustomerPaymentCandidate[]>([]);
  const [driverHireFinance, setDriverHireFinance] = useState<DriverHireFinance>({
    candidates: [],
    offers: [],
    offer_history: [],
    payouts: [],
  });
  const [customerPaymentInputs, setCustomerPaymentInputs] = useState<Record<string, CustomerPaymentInput>>({});
  const [payoutDetails, setPayoutDetails] = useState<Record<string, { method: string; reference: string }>>({});
  const [driverHireOfferInputs, setDriverHireOfferInputs] = useState<Record<string, DriverHireOfferInput>>({});
  const [driverHirePayoutInputs, setDriverHirePayoutInputs] = useState<Record<string, DriverHirePayoutInput>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [receiptWhatsAppUrl, setReceiptWhatsAppUrl] = useState('');
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({});
  const [refunds, setRefunds] = useState<Record<string, { amount: string; reason: string }>>({});
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try {
      const [response, documentResult] = await Promise.all([
        fetch('/api/admin/payments', { cache: 'no-store' }),
        fetchBillingDocuments(billingSearch, billingType, 0),
      ]);
      const result = await response.json() as {
        success?: boolean;
        error?: string;
        data?: {
          claims: Claim[];
          payments: Payment[];
          settlements: Settlement[];
          customer_payment_candidates: CustomerPaymentCandidate[];
          driver_hire: DriverHireFinance;
        };
      };
      if (!response.ok || !result.success || !result.data) throw new Error(result.error || 'Finance data could not be loaded.');
      setClaims(result.data.claims);
      setPayments(result.data.payments);
      setSettlements(result.data.settlements);
      setCustomerPaymentCandidates(result.data.customer_payment_candidates);
      setDriverHireFinance(result.data.driver_hire);
      setBillingDocuments(documentResult.documents);
      setBillingHasMore(documentResult.hasMore);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Finance data could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [billingSearch, billingType]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const visibleCandidates = bookingFilter
    ? customerPaymentCandidates.filter((candidate) => candidate.booking_id === bookingFilter)
    : customerPaymentCandidates;
  const visibleClaims = claims.filter((claim) =>
    (!bookingFilter || claim.booking_id === bookingFilter) && claim.claim_status === 'submitted'
  );
  const visiblePayments = bookingFilter
    ? payments.filter((payment) => payment.booking_id === bookingFilter)
    : payments;

  async function searchBillingDocuments(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const search = billingSearchInput.trim();
    const type = billingTypeInput;
    setBillingLoading(true);
    setNotice('');
    try {
      const result = await fetchBillingDocuments(search, type, 0);
      setBillingSearch(search);
      setBillingType(type);
      setBillingDocuments(result.documents);
      setBillingHasMore(result.hasMore);
    } catch (searchError) {
      setNotice(searchError instanceof Error ? searchError.message : 'Billing document history could not be loaded.');
    } finally {
      setBillingLoading(false);
    }
  }

  async function loadMoreBillingDocuments() {
    setBillingLoading(true);
    try {
      const result = await fetchBillingDocuments(billingSearch, billingType, billingDocuments.length);
      setBillingDocuments((current) => [...current, ...result.documents]);
      setBillingHasMore(result.hasMore);
    } catch (searchError) {
      setNotice(searchError instanceof Error ? searchError.message : 'More billing documents could not be loaded.');
    } finally {
      setBillingLoading(false);
    }
  }

  async function updateBillingPdf(action: 'issue_receipt' | 'retry_render', document: BillingDocument) {
    if (action === 'issue_receipt' && !document.payment_id) return;
    if (action === 'retry_render' && !document.document_id) return;
    setBusy(document.record_id);
    setNotice('');
    try {
      const response = await fetch('/api/admin/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify(action === 'issue_receipt'
          ? { action, payment_id: document.payment_id }
          : { action, document_id: document.document_id }),
      });
      const result = await response.json() as { success?: boolean; message?: string; warning?: string; error?: string };
      if ((!response.ok && response.status !== 202) || result.success !== true) {
        throw new Error(result.error || 'The billing PDF could not be prepared.');
      }
      setNotice(result.warning || result.message || 'Billing document is ready.');
      await load();
    } catch (actionError) {
      setNotice(actionError instanceof Error ? actionError.message : 'The billing PDF could not be prepared.');
    } finally {
      setBusy('');
    }
  }

  async function submit(body: Record<string, unknown>): Promise<{ created?: boolean; data?: Record<string, unknown> }> {
    const response = await fetch('/api/admin/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = await response.json() as { success?: boolean; error?: string; created?: boolean; data?: Record<string, unknown> };
    if (!response.ok || !result.success) throw new Error(result.error || 'Finance operation failed.');
    return { created: result.created, data: result.data };
  }

  function updateCustomerPayment(quoteId: string, field: keyof CustomerPaymentInput, value: string) {
    setCustomerPaymentInputs((currentInputs) => {
      const current = currentInputs[quoteId] ?? EMPTY_CUSTOMER_PAYMENT;
      return {
        ...currentInputs,
        [quoteId]: { ...current, [field]: value, request_id: '' },
      };
    });
  }

  async function recordCustomerPayment(candidate: CustomerPaymentCandidate) {
    const input = customerPaymentInputs[candidate.quote_id] ?? EMPTY_CUSTOMER_PAYMENT;
    if (!window.confirm(
      `Record ${candidate.currency} ${input.amount} payment for ${candidate.booking_ref} on ${input.payment_date}?`
    )) return;
    const requestId = input.request_id || crypto.randomUUID();
    const stableInput = { ...input, request_id: requestId };
    setCustomerPaymentInputs((currentInputs) => ({ ...currentInputs, [candidate.quote_id]: stableInput }));
    setBusy(candidate.quote_id);
    setNotice('');
    setReceiptWhatsAppUrl('');
    try {
      const result = await submit({
        action: 'record_customer_payment',
        booking_id: candidate.booking_id,
        quote_id: candidate.quote_id,
        amount: input.amount,
        method: input.method,
        payment_date: input.payment_date,
        reference: input.reference,
        request_id: requestId,
      });
      const receiptNumber = typeof result.data?.receipt_number === 'string'
        ? result.data.receipt_number
        : '';
      if (!receiptNumber) throw new Error('The payment was recorded but its receipt number could not be verified.');
      setCustomerPaymentInputs((currentInputs) => ({
        ...currentInputs,
        [candidate.quote_id]: EMPTY_CUSTOMER_PAYMENT,
      }));
      setNotice(result.data?.created === false
        ? `Payment already recorded as receipt ${receiptNumber}.`
        : `Payment recorded as receipt ${receiptNumber}.`);
      setReceiptWhatsAppUrl(whatsAppLink(
        candidate.customer_phone,
        `Hello ${candidate.customer_name}, your payment of ${candidate.currency} ${Number(input.amount).toFixed(2)} for booking ${candidate.booking_ref} has been recorded. Receipt number: ${receiptNumber}.`
      ) ?? '');
      await load();
    } catch (actionError) {
      setNotice(actionError instanceof Error ? actionError.message : 'Customer payment could not be recorded.');
    } finally {
      setBusy('');
    }
  }

  async function reviewClaim(claimId: string, approve: boolean) {
    setBusy(claimId);
    setNotice('');
    try {
      await submit({ action: 'review_claim', claim_id: claimId, approve, note: reviewNote[claimId] ?? '' });
      setNotice(approve ? 'Payment claim verified and recorded in the ledger.' : 'Payment claim rejected.');
      await load();
    } catch (actionError) {
      setNotice(actionError instanceof Error ? actionError.message : 'Claim review failed.');
    } finally {
      setBusy('');
    }
  }

  async function refundPayment(paymentId: string) {
    const input = refunds[paymentId] ?? { amount: '', reason: '' };
    setBusy(paymentId);
    setNotice('');
    try {
      await submit({ action: 'refund', payment_id: paymentId, amount: input.amount, reason: input.reason });
      setNotice('Refund entry recorded. The payment ledger is append-only.');
      await load();
    } catch (actionError) {
      setNotice(actionError instanceof Error ? actionError.message : 'Refund failed.');
    } finally {
      setBusy('');
    }
  }

  async function paySettlement(settlementId: string) {
    const payout = payoutDetails[settlementId] ?? { method: 'bank_transfer', reference: '' };
    setBusy(settlementId);
    setNotice('');
    try {
      await submit({
        action: 'pay_settlement',
        settlement_id: settlementId,
        method: payout.method,
        reference: payout.reference,
      });
      setNotice('Driver payout recorded or already recorded with these details.');
      await load();
    } catch (actionError) {
      setNotice(actionError instanceof Error ? actionError.message : 'Payout recording failed.');
    } finally {
      setBusy('');
    }
  }

  function updateDriverHireOffer(assignmentId: string, field: keyof DriverHireOfferInput, value: string) {
    setDriverHireOfferInputs((currentInputs) => {
      const current = currentInputs[assignmentId] ?? EMPTY_DRIVER_HIRE_OFFER;
      return {
        ...currentInputs,
        [assignmentId]: { ...current, [field]: value, request_id: '' },
      };
    });
  }

  async function issueDriverHireOffer(candidate: DriverHireCandidate) {
    const input = driverHireOfferInputs[candidate.assignment_id] ?? EMPTY_DRIVER_HIRE_OFFER;
    if (!input.amount) return;
    if (!window.confirm(
      `${candidate.current_offer_id ? 'Revise' : 'Issue'} ${input.currency} ${input.amount} hire offer for ${candidate.booking_ref}? The driver must accept it before payout.`
    )) return;
    const requestId = input.request_id || crypto.randomUUID();
    const stableInput = { ...input, request_id: requestId };
    setDriverHireOfferInputs((currentInputs) => ({ ...currentInputs, [candidate.assignment_id]: stableInput }));
    setBusy(candidate.assignment_id);
    setNotice('');
    try {
      const result = await submit({
        action: 'create_driver_hire_offer',
        assignment_id: candidate.assignment_id,
        amount: input.amount,
        currency: input.currency,
        request_id: requestId,
      });
      setDriverHireOfferInputs((currentInputs) => ({
        ...currentInputs,
        [candidate.assignment_id]: EMPTY_DRIVER_HIRE_OFFER,
      }));
      setNotice(result.created === false
        ? `That hire offer request is already recorded for ${candidate.booking_ref}.`
        : `Hire offer issued for ${candidate.booking_ref}.`);
      await load();
    } catch (actionError) {
      setNotice(actionError instanceof Error ? actionError.message : 'Driver hire offer could not be issued.');
    } finally {
      setBusy('');
    }
  }

  function updateDriverHirePayout(assignmentId: string, field: keyof DriverHirePayoutInput, value: string) {
    setDriverHirePayoutInputs((currentInputs) => {
      const current = currentInputs[assignmentId] ?? EMPTY_DRIVER_HIRE_PAYOUT;
      return {
        ...currentInputs,
        [assignmentId]: { ...current, [field]: value, request_id: '' },
      };
    });
  }

  async function recordDriverHirePayout(offer: DriverHireOffer) {
    const input = driverHirePayoutInputs[offer.assignment_id] ?? EMPTY_DRIVER_HIRE_PAYOUT;
    if (!input.amount || !input.payment_date || offer.outstanding === null) return;
    if (!window.confirm(
      `Record ${offer.currency} ${input.amount} payout for ${offer.booking_ref}? Outstanding balance: ${offer.currency} ${Number(offer.outstanding).toFixed(2)}.`
    )) return;
    const requestId = input.request_id || crypto.randomUUID();
    const stableInput = { ...input, request_id: requestId };
    setDriverHirePayoutInputs((currentInputs) => ({ ...currentInputs, [offer.assignment_id]: stableInput }));
    setBusy(offer.assignment_id);
    setNotice('');
    try {
      const result = await submit({
        action: 'record_driver_hire_payout',
        assignment_id: offer.assignment_id,
        amount: input.amount,
        payment_date: input.payment_date,
        method: input.method,
        reference: input.reference,
        request_id: requestId,
      });
      setDriverHirePayoutInputs((currentInputs) => ({
        ...currentInputs,
        [offer.assignment_id]: EMPTY_DRIVER_HIRE_PAYOUT,
      }));
      setNotice(result.created === false
        ? `This payout was already recorded for ${offer.booking_ref}.`
        : `Driver payout recorded for ${offer.booking_ref}.`);
      await load();
    } catch (actionError) {
      setNotice(actionError instanceof Error ? actionError.message : 'Driver payout could not be recorded.');
    } finally {
      setBusy('');
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/admin/dashboard" className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline"><ArrowLeft className="h-4 w-4" />Operations</Link>
            <h1 className="mt-2 text-2xl font-black text-slate-900">Payments &amp; refunds</h1>
            <p className="mt-1 text-sm text-slate-500">Admin and Super Admin only. Customer receipts are immutable, individually numbered ledger entries.</p>
          </div>
          <button type="button" onClick={() => void load()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800"><RefreshCw className="h-4 w-4" />Refresh</button>
        </header>
        {bookingFilter && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            <span>Showing payment activity for booking <b>{bookingRefFilter || bookingFilter}</b>.</span>
            <Link href="/admin/payments" className="font-bold underline">View all finance</Link>
          </div>
        )}
        {error && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        {notice && (
          <div className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900" aria-live="polite">
            {notice}
            {receiptWhatsAppUrl && (
              <p className="mt-2">
                <a href={receiptWhatsAppUrl} target="_blank" rel="noopener noreferrer" className="font-bold underline">
                  Prepare WhatsApp payment confirmation
                </a>
              </p>
            )}
          </div>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-5">
            <h2 className="font-extrabold">Invoices &amp; receipts</h2>
            <p className="mt-1 text-xs text-slate-500">Search the booking-linked billing archive. Issuance and corrections remain in each booking&apos;s Billing &amp; Documents panel.</p>
            <form onSubmit={(event) => void searchBillingDocuments(event)} className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <input
                value={billingSearchInput}
                onChange={(event) => setBillingSearchInput(event.target.value)}
                maxLength={100}
                placeholder="Invoice, receipt, booking, or customer"
                className="w-full rounded-xl border border-slate-200 p-2.5 text-sm sm:min-w-60 sm:flex-1"
              />
              <select
                value={billingTypeInput}
                onChange={(event) => setBillingTypeInput(event.target.value)}
                className="w-full rounded-xl border border-slate-200 p-2.5 text-sm sm:w-auto"
                aria-label="Billing document type"
              >
                <option value="">All documents</option>
                <option value="invoice">Invoices</option>
                <option value="receipt">Receipts</option>
              </select>
              <button type="submit" disabled={billingLoading} className="min-h-11 rounded-xl bg-blue-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">
                Search
              </button>
            </form>
          </div>
          {billingDocuments.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">{loading || billingLoading ? 'Loading billing documents…' : 'No invoices or receipts match this search.'}</p>
          ) : billingDocuments.map((document) => (
            <article key={`${document.document_type}-${document.record_id}`} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900">
                  {document.document_type === 'invoice' ? 'Invoice' : 'Receipt'} {document.record_number}
                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">{document.status}</span>
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  <b>{document.booking_ref}</b> · {document.customer_name}
                  {document.customer_email ? ` · ${document.customer_email}` : ''}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {document.currency} {Number(document.amount).toFixed(2)} · {new Date(document.recorded_at).toLocaleDateString('en-GB')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {document.document_id && document.file_status === 'stored' ? (
                  <>
                    <a className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-bold text-slate-800" target="_blank" rel="noopener noreferrer" href={`/api/documents/download?id=${document.document_id}&view=1`}>View PDF</a>
                    <a className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-bold text-slate-800" href={`/api/documents/download?id=${document.document_id}`}>Download</a>
                  </>
                ) : document.document_id ? (
                  <button type="button" disabled={busy === document.record_id} className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-bold text-slate-800 disabled:opacity-50" onClick={() => void updateBillingPdf('retry_render', document)}>Generate PDF</button>
                ) : document.document_type === 'receipt' ? (
                  <button type="button" disabled={busy === document.record_id} className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-bold text-slate-800 disabled:opacity-50" onClick={() => void updateBillingPdf('issue_receipt', document)}>Issue receipt PDF</button>
                ) : null}
                <Link className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-bold text-slate-800" href={`/admin/payments?booking_id=${encodeURIComponent(document.booking_id)}&booking_ref=${encodeURIComponent(document.booking_ref)}`}>Payment ledger</Link>
              </div>
            </article>
          ))}
          {billingHasMore && (
            <div className="p-4 text-center">
              <button type="button" disabled={billingLoading} onClick={() => void loadMoreBillingDocuments()} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-800 disabled:opacity-50">
                {billingLoading ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-5">
            <h2 className="font-extrabold">Record customer payment</h2>
            <p className="mt-1 text-xs text-slate-500">Payments are recorded against the accepted quote, capped at its remaining balance, and assigned a unique receipt number.</p>
          </div>
          {visibleCandidates.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No accepted bookings have an outstanding balance.</p>
          ) : visibleCandidates.map((candidate) => {
            const input = customerPaymentInputs[candidate.quote_id] ?? EMPTY_CUSTOMER_PAYMENT;
            return (
              <article key={candidate.quote_id} className="space-y-3 border-b border-slate-100 p-5">
                <div>
                  <b>{candidate.booking_ref}</b> · {candidate.customer_name}
                  <p className="text-xs text-slate-500">
                    {candidate.currency} {Number(candidate.amount_paid).toFixed(2)} paid ·
                    {' '}{candidate.currency} {Number(candidate.balance).toFixed(2)} outstanding
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                  <label className="text-xs font-semibold text-slate-600">
                    Amount ({candidate.currency})
                    <input
                      value={input.amount}
                      onChange={(event) => updateCustomerPayment(candidate.quote_id, 'amount', event.target.value)}
                      inputMode="decimal"
                      pattern="[0-9]+([.][0-9]{1,2})?"
                      required
                      placeholder="0.00"
                      className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Method
                    <select
                      value={input.method}
                      onChange={(event) => updateCustomerPayment(candidate.quote_id, 'method', event.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                    >
                      <option value="cash">Cash</option>
                      <option value="bank_transfer">Bank transfer</option>
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Payment date
                    <input
                      type="date"
                      value={input.payment_date}
                      onChange={(event) => updateCustomerPayment(candidate.quote_id, 'payment_date', event.target.value)}
                      required
                      className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Reference (optional)
                    <input
                      value={input.reference}
                      onChange={(event) => updateCustomerPayment(candidate.quote_id, 'reference', event.target.value)}
                      maxLength={160}
                      className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={busy === candidate.quote_id || !input.amount || !input.payment_date}
                    onClick={() => void recordCustomerPayment(candidate)}
                    className="self-end rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {busy === candidate.quote_id ? 'Recording…' : 'Record payment'}
                  </button>
                </div>
              </article>
            );
          })}
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100"><h2 className="font-extrabold">Submitted claims</h2></div>
          {loading ? <p className="p-6 text-sm text-slate-500">Loading…</p> : visibleClaims.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No submitted claims need review.</p>
          ) : visibleClaims.map((claim) => (
            <article key={claim.id} className="p-5 border-b border-slate-100 space-y-3">
              <div className="flex flex-wrap justify-between gap-2">
                <div><b>{claim.booking_ref}</b> · {claim.customer_name}<p className="text-xs text-slate-500">{claim.method.replaceAll('_', ' ')} · {claim.currency} {Number(claim.amount).toFixed(2)} · {new Date(claim.submitted_at).toLocaleString()}</p></div>
                <span className="text-xs text-slate-500">Customer reference: {claim.customer_reference || '—'}</span>
              </div>
              <textarea value={reviewNote[claim.id] ?? ''} maxLength={1000} onChange={(event) => setReviewNote({ ...reviewNote, [claim.id]: event.target.value })} placeholder="Optional review note" className="w-full rounded-xl border border-slate-200 p-3 text-sm" />
              <div className="flex justify-end gap-2">
                <button disabled={busy === claim.id} onClick={() => void reviewClaim(claim.id, false)} className="rounded-xl bg-red-50 px-4 py-2 text-xs font-bold text-red-700 disabled:opacity-50">Reject claim</button>
                <button disabled={busy === claim.id} onClick={() => void reviewClaim(claim.id, true)} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Verify payment</button>
              </div>
            </article>
          ))}
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100"><h2 className="font-extrabold">Verified payment ledger</h2></div>
          {visiblePayments.length === 0 ? <p className="p-6 text-sm text-slate-500">No verified ledger entries.</p> : visiblePayments.map((payment) => (
            <article key={payment.id} className="p-5 border-b border-slate-100 space-y-3">
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <div>
                  <b>{payment.booking_ref}</b> · {payment.entry_type} · {payment.currency} {Number(payment.amount).toFixed(2)} · {payment.method.replaceAll('_', ' ')}
                  {payment.receipt_number && <p className="mt-1 text-xs text-slate-500">Receipt {payment.receipt_number}</p>}
                </div>
                <span className="text-xs text-slate-500">
                  {payment.payment_date || new Date(payment.verified_at).toLocaleDateString()}
                </span>
              </div>
              {payment.entry_type === 'receipt' && (
                <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
                  <input value={refunds[payment.id]?.amount ?? ''} onChange={(event) => setRefunds({ ...refunds, [payment.id]: { ...(refunds[payment.id] ?? { amount: '', reason: '' }), amount: event.target.value } })} placeholder="Refund amount" inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" className="rounded-xl border border-slate-200 p-2.5 text-sm" />
                  <input value={refunds[payment.id]?.reason ?? ''} onChange={(event) => setRefunds({ ...refunds, [payment.id]: { ...(refunds[payment.id] ?? { amount: '', reason: '' }), reason: event.target.value } })} placeholder="Refund reason" maxLength={500} className="rounded-xl border border-slate-200 p-2.5 text-sm" />
                  <button disabled={busy === payment.id} onClick={() => void refundPayment(payment.id)} className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Record refund</button>
                </div>
              )}
              {payment.entry_type === 'refund' && <p className="text-xs text-slate-500">Refund reason: {payment.refund_reason}</p>}
            </article>
          ))}
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h2 className="font-extrabold">Driver hire offers</h2>
            <p className="mt-1 text-xs text-slate-500">Issue or revise an agreed hire amount in LKR or USD. Every revision is retained and requires the driver’s acceptance before any payout.</p>
          </div>
          {driverHireFinance.candidates.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No active driver assignments are available.</p>
          ) : driverHireFinance.candidates.map((candidate) => {
            const input = driverHireOfferInputs[candidate.assignment_id] ?? {
              ...EMPTY_DRIVER_HIRE_OFFER,
              amount: candidate.current_amount === null ? '' : String(candidate.current_amount),
              currency: candidate.current_currency ?? 'LKR',
            };
            return (
              <article key={candidate.assignment_id} className="space-y-3 border-b border-slate-100 p-5">
                <div>
                  <b>{candidate.booking_ref}</b> · {candidate.driver_name}
                  <p className="text-xs text-slate-500">
                    Assignment {candidate.assignment_status.replaceAll('_', ' ')}
                    {candidate.current_offer_status && ` · current offer ${candidate.current_offer_status}`}
                    {candidate.current_amount !== null && candidate.current_currency &&
                      ` · ${candidate.current_currency} ${Number(candidate.current_amount).toFixed(2)}`}
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_10rem_auto]">
                  <label className="text-xs font-semibold text-slate-600">
                    Hire amount
                    <input
                      value={input.amount}
                      onChange={(event) => updateDriverHireOffer(candidate.assignment_id, 'amount', event.target.value)}
                      inputMode="decimal"
                      pattern="[0-9]+([.][0-9]{1,2})?"
                      placeholder="0.00"
                      className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Currency
                    <select
                      value={input.currency}
                      onChange={(event) => updateDriverHireOffer(candidate.assignment_id, 'currency', event.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                    >
                      <option value="LKR">LKR</option>
                      <option value="USD">USD</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={busy === candidate.assignment_id || !input.amount}
                    onClick={() => void issueDriverHireOffer(candidate)}
                    className="self-end rounded-xl bg-blue-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {candidate.current_offer_id ? 'Issue revised offer' : 'Issue hire offer'}
                  </button>
                </div>
              </article>
            );
          })}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-5">
            <h2 className="font-extrabold">Agreed driver hire and outstanding balance</h2>
            <p className="mt-1 text-xs text-slate-500">Payouts are separate immutable entries. The database enforces the accepted currency and remaining balance.</p>
          </div>
          {driverHireFinance.offers.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No driver hire offers have been issued.</p>
          ) : driverHireFinance.offers.map((offer) => {
            const input = driverHirePayoutInputs[offer.assignment_id] ?? EMPTY_DRIVER_HIRE_PAYOUT;
            return (
              <article key={offer.id} className="space-y-3 border-b border-slate-100 p-5">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <b>{offer.booking_ref}</b> · {offer.driver_name}
                    <p className="text-xs text-slate-500">
                      Revision {offer.revision} · {offer.offer_status} · {offer.currency} {Number(offer.amount).toFixed(2)}
                    </p>
                  </div>
                  {offer.offer_status === 'accepted' && (
                    <div className="text-right text-xs">
                      <p>{offer.currency} {Number(offer.paid_total).toFixed(2)} paid</p>
                      <p className="font-bold">{offer.currency} {Number(offer.outstanding ?? 0).toFixed(2)} outstanding</p>
                    </div>
                  )}
                </div>
                {offer.offer_status === 'accepted' && Number(offer.outstanding) > 0 && (
                  <div className="grid gap-2 sm:grid-cols-[1fr_10rem_10rem_1fr_auto]">
                    <label className="text-xs font-semibold text-slate-600">
                      Payout amount ({offer.currency})
                      <input
                        value={input.amount}
                        onChange={(event) => updateDriverHirePayout(offer.assignment_id, 'amount', event.target.value)}
                        inputMode="decimal"
                        pattern="[0-9]+([.][0-9]{1,2})?"
                        placeholder="0.00"
                        className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                      />
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      Payment date
                      <input
                        type="date"
                        value={input.payment_date}
                        onChange={(event) => updateDriverHirePayout(offer.assignment_id, 'payment_date', event.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                      />
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      Method
                      <select
                        value={input.method}
                        onChange={(event) => updateDriverHirePayout(offer.assignment_id, 'method', event.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                      >
                        <option value="bank_transfer">Bank transfer</option>
                        <option value="cash">Cash</option>
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      Reference (optional)
                      <input
                        value={input.reference}
                        onChange={(event) => updateDriverHirePayout(offer.assignment_id, 'reference', event.target.value)}
                        maxLength={160}
                        className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={busy === offer.assignment_id || !input.amount || !input.payment_date}
                      onClick={() => void recordDriverHirePayout(offer)}
                      className="self-end rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                    >
                      Record payout
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-5">
            <h2 className="font-extrabold">Driver payout history</h2>
          </div>
          {driverHireFinance.payouts.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No partial driver payouts have been recorded.</p>
          ) : driverHireFinance.payouts.map((payout) => (
            <article key={payout.id} className="flex flex-wrap justify-between gap-2 border-b border-slate-100 p-5 text-sm">
              <div>
                <b>{payout.booking_ref}</b> · {payout.driver_name}
                <p className="text-xs text-slate-500">
                  {payout.payment_date} · {payout.payment_method.replaceAll('_', ' ')}
                  {payout.payment_reference && ` · ${payout.payment_reference}`}
                </p>
              </div>
              <span className="font-bold">{payout.currency} {Number(payout.amount).toFixed(2)}</span>
            </article>
          ))}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-5">
            <h2 className="font-extrabold">Driver hire offer revision history</h2>
          </div>
          {driverHireFinance.offer_history.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No offer revisions have been recorded.</p>
          ) : driverHireFinance.offer_history.map((offer) => (
            <article key={offer.id} className="flex flex-wrap justify-between gap-2 border-b border-slate-100 p-5 text-sm">
              <div>
                <b>{offer.booking_ref}</b> · {offer.driver_name}
                <p className="text-xs text-slate-500">
                  Revision {offer.revision} · {offer.offer_status}{offer.is_current ? ' · current' : ' · superseded'}
                  {offer.responded_at && ` · responded ${new Date(offer.responded_at).toLocaleString()}`}
                </p>
              </div>
              <span className="font-bold">{offer.currency} {Number(offer.amount).toFixed(2)}</span>
            </article>
          ))}
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h2 className="font-extrabold">Legacy one-time driver settlements</h2>
            <p className="mt-1 text-xs text-slate-500">Historical settlement records are kept separate from the current hire-offer and partial-payout ledger.</p>
          </div>
          {settlements.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No driver settlements have been recorded.</p>
          ) : settlements.map((settlement) => {
            const payout = payoutDetails[settlement.id] ?? { method: 'bank_transfer', reference: '' };
            return (
              <article key={settlement.id} className="space-y-3 border-b border-slate-100 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <b>{settlement.booking_ref}</b> · {settlement.driver_name}
                    <p className="text-xs text-slate-500">{settlement.currency} {Number(settlement.amount).toFixed(2)} · {settlement.settlement_status}</p>
                  </div>
                  {settlement.paid_at && <span className="text-xs text-slate-500">Paid {new Date(settlement.paid_at).toLocaleString()}</span>}
                </div>
                {settlement.settlement_status === 'pending' && (
                  <div className="grid gap-2 sm:grid-cols-[12rem_1fr_auto]">
                    <select
                      value={payout.method}
                      onChange={(event) => setPayoutDetails({
                        ...payoutDetails,
                        [settlement.id]: { ...payout, method: event.target.value },
                      })}
                      className="rounded-xl border border-slate-200 p-2.5 text-sm"
                    >
                      <option value="bank_transfer">Bank transfer</option>
                      <option value="cash">Cash</option>
                    </select>
                    <input
                      value={payout.reference}
                      onChange={(event) => setPayoutDetails({
                        ...payoutDetails,
                        [settlement.id]: { ...payout, reference: event.target.value },
                      })}
                      maxLength={160}
                      placeholder="Payout reference (optional)"
                      className="rounded-xl border border-slate-200 p-2.5 text-sm"
                    />
                    <button
                      disabled={busy === settlement.id}
                      onClick={() => void paySettlement(settlement.id)}
                      className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                    >
                      Record payout
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense fallback={<main className="p-6 text-sm text-slate-500">Loading payments…</main>}>
      <PaymentsPageContent />
    </Suspense>
  );
}
