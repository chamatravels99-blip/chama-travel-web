'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { customerWhatsAppUrl } from '@/lib/whatsapp';
import { CheckCircle, CreditCard, Download, Eye, FileText, PlusCircle, RefreshCw } from 'lucide-react';

type Invoice = {
  id: string;
  invoice_number: string;
  revision: number;
  status: string;
  currency: string;
  total: number;
  issued_at: string;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  paid_now: number;
  supersedes_invoice_id: string | null;
  document_id: string | null;
  file_status: string | null;
};

type Receipt = {
  payment_id: string;
  receipt_number: string;
  amount: number;
  currency: string;
  payment_date: string | null;
  document_id: string | null;
  file_status: string | null;
};

type PaymentRecord = {
  payment_id: string;
  quote_id: string;
  entry_type: 'receipt' | 'refund';
  original_payment_id: string | null;
  amount: number;
  currency: string;
  method: string;
  reference: string | null;
  refund_reason: string | null;
  receipt_number: string | null;
  payment_date: string | null;
  status: string;
  verified_at: string;
  created_at: string;
};

type QuoteSummary = {
  quote_id: string;
  quote_revision: number;
  quote_status: string;
  currency: string;
  quote_total: number;
  total_paid: number;
  total_refunded: number;
  net_paid: number;
  outstanding_balance: number | null;
  payment_status: string | null;
  invoice_status: string | null;
};

type PaymentSummary = {
  booking_id: string;
  booking_ref: string;
  payments: PaymentRecord[];
  quote_summaries: QuoteSummary[];
  totals_by_currency: Array<{
    currency: string;
    total_paid: number;
    total_refunded: number;
    net_paid: number;
  }>;
};

type Billing = {
  invoices: Invoice[];
  receipts: Receipt[];
  documents: Array<{ id: string; title: string; customer_visible?: boolean; driver_visible?: boolean }>;
  payment_summary: PaymentSummary;
};

type PaymentTypeOption = 'full' | 'advance' | 'part';

const DEFAULT_INVOICE_NOTE =
  'Includes private air-conditioned vehicle, fuel, driver allowance, and highway tolls. Entrance tickets and personal expenses are excluded unless specified.';

function getColomboToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function formatMoney(amount: number | string | null | undefined): string {
  const num = Number(amount ?? 0);
  if (!Number.isFinite(num)) return '0.00';
  return num.toFixed(2);
}

function paymentStatusBadge(status: string | null | undefined) {
  if (status === 'paid') {
    return 'bg-emerald-100 text-emerald-800 ring-emerald-600/20';
  }
  if (status === 'partially_paid') {
    return 'bg-amber-100 text-amber-800 ring-amber-600/20';
  }
  if (status === 'refunded') {
    return 'bg-slate-200 text-slate-700 ring-slate-500/20';
  }
  return 'bg-rose-100 text-rose-800 ring-rose-600/20';
}

export default function BookingBillingPanel({
  bookingId,
  bookingRef,
  acceptedQuoteId,
  customerName,
  customerPhone,
  sentQuoteId,
  onConfirmSentQuote,
  onUpdated,
}: {
  bookingId: string;
  bookingRef: string;
  acceptedQuoteId: string | null;
  assignmentId?: string | null;
  customerName?: string;
  customerPhone?: string;
  sentQuoteId?: string | null;
  onConfirmSentQuote?: (quoteId: string) => Promise<void>;
  onUpdated?: () => Promise<void> | void;
}) {
  const [billing, setBilling] = useState<Billing | null>(null);
  const [loadingBilling, setLoadingBilling] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [paymentType, setPaymentType] = useState<PaymentTypeOption>('full');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'cash' | 'bank_transfer'>('cash');
  const [payCurrency, setPayCurrency] = useState<'LKR' | 'USD'>('LKR');
  const [payDate, setPayDate] = useState<string>(getColomboToday);
  const [payRef, setPayRef] = useState('');
  const [payNote, setPayNote] = useState('');
  const [invoiceNote, setInvoiceNote] = useState(DEFAULT_INVOICE_NOTE);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [lastCreatedReceipt, setLastCreatedReceipt] = useState<{
    receiptNumber: string;
    amount: string;
    currency: string;
    documentId: string | null;
  } | null>(null);

  const invoiceRequestId = useRef<string | null>(null);
  const replacementRequestIds = useRef<Record<string, string>>({});
  const paymentRequestId = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    setLoadingBilling(true);
    try {
      const response = await fetch(`/api/admin/billing?booking_id=${bookingId}`, { cache: 'no-store' });
      const billingResult = (await response.json()) as { success?: boolean; data?: Billing };
      if (!response.ok || !billingResult.success || !billingResult.data) {
        throw new Error('Billing details could not be loaded.');
      }
      setBilling(billingResult.data);
      const summary = billingResult.data.payment_summary.quote_summaries.find(
        (s) => s.quote_id === acceptedQuoteId
      ) ?? billingResult.data.payment_summary.quote_summaries.find(
        (s) => s.quote_status === 'accepted'
      );
      if (summary) {
        if (summary.currency === 'LKR' || summary.currency === 'USD') {
          setPayCurrency(summary.currency);
        }
        const rem = Number(summary.outstanding_balance ?? 0);
        if (rem > 0) {
          setPayAmount(rem.toFixed(2));
          setPaymentType('full');
        } else {
          setPayAmount('');
        }
      }
    } finally {
      setLoadingBilling(false);
    }
  }, [bookingId, acceptedQuoteId]);

  useEffect(() => {
    void Promise.resolve()
      .then(refresh)
      .catch(() => setError('Billing details could not be loaded.'));
  }, [refresh]);

  const acceptedSummary =
    billing?.payment_summary.quote_summaries.find((summary) => summary.quote_id === acceptedQuoteId) ??
    billing?.payment_summary.quote_summaries.find((summary) => summary.quote_status === 'accepted');

  const outstandingBalance = Number(acceptedSummary?.outstanding_balance ?? 0);
  const quoteTotal = Number(acceptedSummary?.quote_total ?? 0);
  const totalPaid = Number(acceptedSummary?.total_paid ?? 0);
  const netPaid = Number(acceptedSummary?.net_paid ?? 0);
  const activeCurrency = (acceptedSummary?.currency as 'LKR' | 'USD') || payCurrency;

  function handleSelectPaymentType(type: PaymentTypeOption) {
    setPaymentType(type);
    if (!acceptedSummary) return;
    const rem = Number(acceptedSummary.outstanding_balance ?? 0);
    if (type === 'full') {
      setPayAmount(rem > 0 ? rem.toFixed(2) : '');
    } else if (type === 'advance') {
      const half = Math.min(rem, Math.round((Number(acceptedSummary.quote_total) * 0.5) * 100) / 100);
      setPayAmount(half > 0 ? half.toFixed(2) : rem.toFixed(2));
    } else {
      setPayAmount('');
    }
  }

  async function postBillingAction(url: string, body: Record<string, unknown>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        message?: string;
        warning?: string;
      };
      if ((!response.ok && response.status !== 202) || result.success !== true) {
        throw new Error(result.error || 'The request failed.');
      }
      setNotice(result.warning || result.message || 'Done.');
      await refresh();
      if (onUpdated) await onUpdated();
      return true;
    } catch (postError) {
      setError(postError instanceof Error ? postError.message : 'The request failed.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submitPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetQuoteId = acceptedSummary?.quote_id ?? acceptedQuoteId;
    if (!targetQuoteId || recordingPayment) return;

    const normalizedAmount = payAmount.trim();
    const numericAmount = Number(normalizedAmount);
    if (!/^\d{1,10}(\.\d{1,2})?$/.test(normalizedAmount) || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Enter a valid positive payment amount (up to 2 decimal places).');
      return;
    }
    if (numericAmount > outstandingBalance + 0.001) {
      setError(`Payment amount (${activeCurrency} ${numericAmount.toFixed(2)}) cannot exceed the outstanding balance (${activeCurrency} ${outstandingBalance.toFixed(2)}).`);
      return;
    }

    setRecordingPayment(true);
    setError('');
    setNotice('');
    setLastCreatedReceipt(null);

    const typeLabel =
      paymentType === 'advance'
        ? 'Advance'
        : paymentType === 'part'
          ? 'Part Payment'
          : 'Balance Payment';
    const combinedRefParts = [
      typeLabel,
      payRef.trim(),
      payNote.trim(),
    ].filter(Boolean);
    const combinedReference = combinedRefParts.join(' - ').slice(0, 160);

    try {
      paymentRequestId.current ??= crypto.randomUUID();
      const response = await fetch('/api/operations/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'record_customer_payment',
          booking_id: bookingId,
          quote_id: targetQuoteId,
          amount: numericAmount.toFixed(2),
          method: payMethod,
          payment_date: payDate,
          reference: combinedReference,
          payment_type: paymentType,
          payment_ref: payRef.trim(),
          payment_note: payNote.trim(),
          request_id: paymentRequestId.current,
        }),
      });
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        message?: string;
        data?: {
          payment_id?: string;
          receipt_number?: string;
          document_id?: string | null;
        };
      };
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Payment recording failed.');
      }

      paymentRequestId.current = null;
      const receiptNo = result.data?.receipt_number ?? 'Generated';
      setLastCreatedReceipt({
        receiptNumber: receiptNo,
        amount: numericAmount.toFixed(2),
        currency: activeCurrency,
        documentId: result.data?.document_id ?? null,
      });
      setNotice(
        result.message ||
          `Payment of ${activeCurrency} ${numericAmount.toFixed(2)} recorded. Official Receipt ${receiptNo} is ready.`
      );
      setPayRef('');
      setPayNote('');
      await refresh();
      if (onUpdated) await onUpdated();
    } catch (payError) {
      paymentRequestId.current = null;
      setError(payError instanceof Error ? payError.message : 'Payment recording failed.');
    } finally {
      setRecordingPayment(false);
    }
  }

  const btn =
    'inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 disabled:opacity-50 hover:bg-slate-50 transition';
  const primaryBtn =
    'inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50 hover:bg-blue-800 transition shadow-sm';
  const emeraldBtn =
    'inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50 hover:bg-emerald-800 transition shadow-sm';

  return (
    <section className="space-y-5" aria-label="Booking payments, invoices, and receipts">
      {/* Top Financial Ledger Bar */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 to-blue-950 p-5 text-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-300 block">
              Booking Financial Ledger · {bookingRef}
            </span>
            <h4 className="text-base font-black text-white">
              Payments, Official Invoices &amp; Customer Receipts
            </h4>
          </div>
          {acceptedSummary && (
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black uppercase ring-1 ring-inset ${paymentStatusBadge(
                acceptedSummary.payment_status
              )}`}
            >
              {(acceptedSummary.payment_status ?? 'unpaid').replaceAll('_', ' ')}
            </span>
          )}
        </div>

        {!acceptedSummary ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/10 p-4 text-xs text-slate-200">
            <div>
              <p className="font-bold text-white">No Confirmed / Accepted Quotation Yet</p>
              <p className="mt-0.5 text-slate-300">
                Issue and confirm a quotation in Tab 2 before recording payments or generating an invoice.
              </p>
            </div>
            {sentQuoteId && onConfirmSentQuote && (
              <button
                type="button"
                onClick={() => void onConfirmSentQuote(sentQuoteId)}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black text-slate-950 hover:bg-emerald-400 transition"
              >
                Confirm Sent Quote Now
              </button>
            )}
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-white/10 p-3.5 border border-white/10">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 block">
                Quoted Total
              </span>
              <span className="mt-1 block text-lg font-black text-white">
                {activeCurrency} {formatMoney(quoteTotal)}
              </span>
            </div>
            <div className="rounded-xl bg-emerald-500/15 p-3.5 border border-emerald-400/20">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-200 block">
                Total Paid (Net)
              </span>
              <span className="mt-1 block text-lg font-black text-emerald-300">
                {activeCurrency} {formatMoney(netPaid)}
              </span>
              {totalPaid !== netPaid && (
                <span className="text-[10px] text-slate-300">
                  Gross received: {activeCurrency} {formatMoney(totalPaid)}
                </span>
              )}
            </div>
            <div className="rounded-xl bg-amber-500/15 p-3.5 border border-amber-400/20">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-200 block">
                Outstanding Balance
              </span>
              <span className="mt-1 block text-lg font-black text-amber-300">
                {activeCurrency} {formatMoney(outstandingBalance)}
              </span>
            </div>
            <div className="rounded-xl bg-white/10 p-3.5 border border-white/10">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 block">
                Payment Status
              </span>
              <span className="mt-1 block text-sm font-black uppercase text-white">
                {(acceptedSummary.payment_status ?? 'unpaid').replaceAll('_', ' ')}
              </span>
              <span className="text-[11px] text-slate-300">
                {billing?.receipts.length ?? 0} receipt(s) · {billing?.invoices.length ?? 0} invoice(s)
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Alerts & Instant Receipt Banner */}
      {error && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}

      {(notice || lastCreatedReceipt) && (
        <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 shrink-0 text-emerald-700" />
              <span className="font-bold">{notice}</span>
            </div>
            {lastCreatedReceipt && (
              <div className="flex flex-wrap items-center gap-2">
                {lastCreatedReceipt.documentId && (
                  <>
                    <a
                      href={`/api/documents/download?id=${lastCreatedReceipt.documentId}&view=1`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={btn}
                    >
                      <Eye className="h-3.5 w-3.5" /> View Receipt PDF
                    </a>
                    <a
                      href={`/api/documents/download?id=${lastCreatedReceipt.documentId}`}
                      className={emeraldBtn}
                    >
                      <Download className="h-3.5 w-3.5" /> Download Receipt PDF
                    </a>
                  </>
                )}
                {customerPhone &&
                  customerWhatsAppUrl(
                    customerPhone,
                    `Hello ${customerName || 'Customer'}, we have received your payment of ${lastCreatedReceipt.currency} ${lastCreatedReceipt.amount} for booking ${bookingRef}. Official Receipt No: ${lastCreatedReceipt.receiptNumber}. Thank you for choosing Chama Travels!`
                  ) && (
                    <a
                      href={
                        customerWhatsAppUrl(
                          customerPhone,
                          `Hello ${customerName || 'Customer'}, we have received your payment of ${lastCreatedReceipt.currency} ${lastCreatedReceipt.amount} for booking ${bookingRef}. Official Receipt No: ${lastCreatedReceipt.receiptNumber}. Thank you for choosing Chama Travels!`
                        )!
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className={btn}
                    >
                      Send Confirmation via WhatsApp
                    </a>
                  )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Streamlined "Record Customer Payment" Form */}
      {acceptedSummary && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 pb-3">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-blue-700" />
              <h5 className="text-sm font-extrabold text-slate-900">Record Customer Payment</h5>
            </div>
            {outstandingBalance <= 0 && (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                Fully Paid — No Balance Remaining
              </span>
            )}
          </div>

          {outstandingBalance > 0 ? (
            <form onSubmit={submitPayment} className="mt-4 space-y-4">
              {/* Payment Type Selector Pills */}
              <div>
                <span className="block text-xs font-bold text-slate-700 mb-2">1. Select Payment Type</span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {(
                    [
                      {
                        id: 'full',
                        title: 'Full Balance Payment',
                        subtitle: `${activeCurrency} ${formatMoney(outstandingBalance)}`,
                      },
                      {
                        id: 'advance',
                        title: 'Advance Payment (50%)',
                        subtitle: `${activeCurrency} ${formatMoney(Math.min(outstandingBalance, quoteTotal * 0.5))}`,
                      },
                      {
                        id: 'part',
                        title: 'Part Payment',
                        subtitle: 'Enter custom amount',
                      },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleSelectPaymentType(option.id)}
                      className={`flex flex-col items-start rounded-xl border p-3 text-left transition ${
                        paymentType === option.id
                          ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                          : 'border-slate-200 bg-white text-slate-800 hover:border-blue-300'
                      }`}
                    >
                      <span className="text-xs font-extrabold">{option.title}</span>
                      <span
                        className={`mt-0.5 text-[11px] font-semibold ${
                          paymentType === option.id ? 'text-blue-100' : 'text-slate-500'
                        }`}
                      >
                        {option.subtitle}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Inputs */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="block text-xs font-bold text-slate-700">
                  Amount ({activeCurrency})
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={outstandingBalance}
                    required
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder={formatMoney(outstandingBalance)}
                    className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm font-bold text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </label>

                <label className="block text-xs font-bold text-slate-700">
                  Payment Method
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as 'cash' | 'bank_transfer')}
                    className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm font-semibold text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </label>

                <label className="block text-xs font-bold text-slate-700">
                  Currency
                  <select
                    value={activeCurrency}
                    disabled
                    className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-100 p-2.5 text-sm font-bold text-slate-700"
                  >
                    <option value="LKR">LKR (Sri Lankan Rupee)</option>
                    <option value="USD">USD (US Dollar)</option>
                  </select>
                </label>

                <label className="block text-xs font-bold text-slate-700">
                  Payment Date
                  <input
                    type="date"
                    required
                    max={getColomboToday()}
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-bold text-slate-700">
                  {payMethod === 'bank_transfer'
                    ? 'Bank Slip / Transaction Reference No.'
                    : 'Cash Receipt / Reference No. (Optional)'}
                  <input
                    type="text"
                    maxLength={80}
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    placeholder={
                      payMethod === 'bank_transfer'
                        ? 'e.g. BOC / Sampath Slip #948201'
                        : 'e.g. Received at airport pickup'
                    }
                    className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </label>

                <label className="block text-xs font-bold text-slate-700">
                  Payment Note (Optional)
                  <input
                    type="text"
                    maxLength={80}
                    value={payNote}
                    onChange={(e) => setPayNote(e.target.value)}
                    placeholder="e.g. 50% advance confirmed via WhatsApp"
                    className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-blue-100 pt-3">
                <p className="text-xs text-slate-600">
                  Recording this payment immediately updates the balance and generates an official PDF Receipt.
                </p>
                <button
                  type="submit"
                  disabled={recordingPayment || !payAmount || Number(payAmount) <= 0}
                  className={emeraldBtn}
                >
                  <PlusCircle className="h-4 w-4" />
                  {recordingPayment
                    ? 'Recording & Generating Receipt…'
                    : `Record Payment (${activeCurrency} ${formatMoney(payAmount || 0)})`}
                </button>
              </div>
            </form>
          ) : (
            <p className="mt-3 text-xs text-slate-600">
              All quoted amounts for this booking have been settled in full. You can download the official receipts below.
            </p>
          )}
        </div>
      )}

      {/* Invoices & Receipts Grid */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Official Invoices Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h5 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" /> Official Invoices
              </h5>
              <p className="text-[11px] text-slate-500">Issue and download customer tax/booking invoices.</p>
            </div>
            {acceptedQuoteId && billing && !billing.invoices.some((i) => i.status === 'issued') && (
              <button
                type="button"
                disabled={busy}
                className={primaryBtn}
                onClick={() => {
                  invoiceRequestId.current ??= crypto.randomUUID();
                  void postBillingAction('/api/admin/billing', {
                    action: 'issue_invoice',
                    booking_id: bookingId,
                    quote_id: acceptedQuoteId,
                    request_id: invoiceRequestId.current,
                    invoice_note: invoiceNote.trim() || DEFAULT_INVOICE_NOTE,
                  });
                }}
              >
                <FileText className="h-3.5 w-3.5" /> Generate Invoice
              </button>
            )}
          </div>

          {acceptedQuoteId && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-700">
                Customer-Facing Invoice Note &amp; Inclusions{' '}
                <span className="font-normal text-slate-500">(Printed on Invoice PDF)</span>
              </label>
              <textarea
                rows={2}
                maxLength={600}
                value={invoiceNote}
                onChange={(e) => setInvoiceNote(e.target.value)}
                placeholder={DEFAULT_INVOICE_NOTE}
                className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
              />
            </div>
          )}

          {loadingBilling && !billing ? (
            <p className="text-xs text-slate-500 py-4 text-center">Loading invoices…</p>
          ) : billing?.invoices.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              No invoice generated yet. Click &ldquo;Generate Invoice&rdquo; above to create one.
            </p>
          ) : (
            <div className="space-y-2.5">
              {billing?.invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-slate-900">{inv.invoice_number}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          inv.status === 'issued'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </div>
                    <p className="text-slate-600 font-semibold">
                      {inv.currency} {formatMoney(inv.total)} · Rev {inv.revision} ·{' '}
                      {new Date(inv.issued_at).toLocaleDateString('en-GB')}
                    </p>
                    {inv.cancellation_reason && (
                      <p className="text-[11px] text-rose-700">Reason: {inv.cancellation_reason}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {inv.document_id && inv.file_status === 'stored' && (
                      <>
                        <a
                          className={btn}
                          target="_blank"
                          rel="noopener noreferrer"
                          href={`/api/documents/download?id=${inv.document_id}&view=1`}
                        >
                          <Eye className="h-3.5 w-3.5" /> View
                        </a>
                        <a
                          className={primaryBtn}
                          href={`/api/documents/download?id=${inv.document_id}`}
                        >
                          <Download className="h-3.5 w-3.5" /> Download Invoice PDF
                        </a>
                      </>
                    )}
                    {inv.document_id && inv.file_status !== 'stored' && inv.status === 'issued' && (
                      <button
                        type="button"
                        disabled={busy}
                        className={btn}
                        onClick={() =>
                          void postBillingAction('/api/admin/billing', {
                            action: 'retry_render',
                            document_id: inv.document_id,
                            booking_id: bookingId,
                            invoice_note: invoiceNote.trim() || DEFAULT_INVOICE_NOTE,
                          })
                        }
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Generate PDF
                      </button>
                    )}
                    {inv.status === 'issued' && (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          className={btn}
                          onClick={() => {
                            const reason = window.prompt('Reason for issuing a replacement invoice?');
                            if (!reason || reason.trim().length < 3) return;
                            replacementRequestIds.current[inv.id] ??= crypto.randomUUID();
                            void postBillingAction('/api/admin/billing', {
                              action: 'replace_invoice',
                              invoice_id: inv.id,
                              booking_id: bookingId,
                              reason: reason.trim(),
                              request_id: replacementRequestIds.current[inv.id],
                              invoice_note: invoiceNote.trim() || DEFAULT_INVOICE_NOTE,
                            });
                          }}
                        >
                          Replace
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          className="rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
                          onClick={() => {
                            const reason = window.prompt('Reason for cancelling this invoice?');
                            if (reason && reason.trim().length >= 3) {
                              void postBillingAction('/api/admin/billing', {
                                action: 'cancel_invoice',
                                invoice_id: inv.id,
                                reason: reason.trim(),
                              });
                            }
                          }}
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recorded Payments & Official Receipts Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <div className="border-b border-slate-100 pb-3">
            <h5 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-600" /> Payment History &amp; Receipts
            </h5>
            <p className="text-[11px] text-slate-500">
              Every verified payment automatically generates an official numbered receipt.
            </p>
          </div>

          {loadingBilling && !billing ? (
            <p className="text-xs text-slate-500 py-4 text-center">Loading payments…</p>
          ) : billing?.payment_summary.payments.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              No payments recorded yet for this booking.
            </p>
          ) : (
            <div className="space-y-2.5">
              {billing?.payment_summary.payments.map((payment) => {
                const receipt = billing.receipts.find((item) => item.payment_id === payment.payment_id);
                return (
                  <div
                    key={payment.payment_id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-slate-900">
                          {payment.entry_type === 'receipt'
                            ? payment.receipt_number ?? 'Receipt'
                            : 'Refund'}
                        </span>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800">
                          {payment.method.replaceAll('_', ' ')}
                        </span>
                      </div>
                      <p className="font-bold text-slate-900">
                        {payment.currency} {formatMoney(payment.amount)}{' '}
                        <span className="font-normal text-slate-500">
                          · {payment.payment_date ?? new Date(payment.verified_at).toLocaleDateString('en-GB')}
                        </span>
                      </p>
                      {payment.reference && (
                        <p className="text-[11px] text-slate-600">Ref: {payment.reference}</p>
                      )}
                      {payment.refund_reason && (
                        <p className="text-[11px] text-rose-700">Refund: {payment.refund_reason}</p>
                      )}
                    </div>

                    {payment.entry_type === 'receipt' && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {receipt?.document_id && receipt.file_status === 'stored' ? (
                          <>
                            <a
                              className={btn}
                              target="_blank"
                              rel="noopener noreferrer"
                              href={`/api/documents/download?id=${receipt.document_id}&view=1`}
                            >
                              <Eye className="h-3.5 w-3.5" /> View
                            </a>
                            <a
                              className={emeraldBtn}
                              href={`/api/documents/download?id=${receipt.document_id}`}
                            >
                              <Download className="h-3.5 w-3.5" /> Download Receipt PDF
                            </a>
                          </>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            className={primaryBtn}
                            onClick={() =>
                              void postBillingAction('/api/admin/billing', {
                                action: 'issue_receipt',
                                payment_id: payment.payment_id,
                                booking_id: bookingId,
                              })
                            }
                          >
                            <Download className="h-3.5 w-3.5" /> Generate Receipt PDF
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
