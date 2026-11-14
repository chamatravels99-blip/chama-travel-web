'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Invoice = {
  id: string; invoice_number: string; revision: number; status: string; currency: string; total: number;
  issued_at: string; cancelled_at: string | null; cancellation_reason: string | null; paid_now: number;
  supersedes_invoice_id: string | null; document_id: string | null; file_status: string | null;
};
type Receipt = {
  payment_id: string; receipt_number: string; amount: number; currency: string; payment_date: string | null;
  document_id: string | null; file_status: string | null;
};
type PaymentRecord = {
  payment_id: string; quote_id: string; entry_type: 'receipt' | 'refund'; original_payment_id: string | null;
  amount: number; currency: string; method: string; reference: string | null; refund_reason: string | null;
  receipt_number: string | null; payment_date: string | null; status: string; verified_at: string; created_at: string;
};
type QuoteSummary = {
  quote_id: string; quote_revision: number; quote_status: string; currency: string; quote_total: number;
  total_paid: number; total_refunded: number; net_paid: number; outstanding_balance: number | null;
  payment_status: string | null; invoice_status: string | null;
};
type PaymentSummary = {
  booking_id: string; booking_ref: string; payments: PaymentRecord[];
  quote_summaries: QuoteSummary[];
  totals_by_currency: Array<{ currency: string; total_paid: number; total_refunded: number; net_paid: number }>;
};
type Billing = {
  invoices: Invoice[];
  receipts: Receipt[];
  documents: Array<{ id: string; title: string; customer_visible?: boolean; driver_visible?: boolean }>;
  payment_summary: PaymentSummary;
};
type Invitation = {
  id: string; assignment_id: string; driver_name?: string | null; status: string; expires_at: string;
  created_at?: string; first_viewed_at?: string | null; revoked_at?: string | null; consumed_at?: string | null;
};

export default function BookingBillingPanel({
  bookingId, bookingRef, acceptedQuoteId, assignmentId,
}: { bookingId: string; bookingRef: string; acceptedQuoteId: string | null; assignmentId: string | null }) {
  const [billing, setBilling] = useState<Billing | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [link, setLink] = useState('');
  const invoiceRequestId = useRef<string | null>(null);
  const replacementRequestIds = useRef<Record<string, string>>({});

  const refresh = useCallback(async () => {
    const [b, i] = await Promise.all([
      fetch(`/api/admin/billing?booking_id=${bookingId}`, { cache: 'no-store' }),
      fetch(`/api/admin/driver-invitations?booking_id=${bookingId}`, { cache: 'no-store' }),
    ]);
    const billingResult = await b.json() as { success?: boolean; data?: Billing };
    if (!b.ok || !billingResult.success || !billingResult.data) {
      throw new Error('Billing details could not be loaded.');
    }
    setBilling(billingResult.data);
    const inviteResult = await i.json() as { success?: boolean; data?: Invitation[] };
    if (i.ok && inviteResult.success && Array.isArray(inviteResult.data)) setInvitations(inviteResult.data);
  }, [bookingId]);

  useEffect(() => {
    void Promise.resolve().then(refresh).catch(() => setError('Billing details could not be loaded.'));
  }, [refresh]);

  async function post(url: string, body: Record<string, unknown>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', body: JSON.stringify(body),
      });
      const result = await response.json() as { success?: boolean; error?: string; message?: string; warning?: string; link?: string };
      if ((!response.ok && response.status !== 202) || result.success !== true) {
        throw new Error(result.error || 'The request failed.');
      }
      setNotice(result.warning || result.message || 'Done.');
      if (result.link) setLink(result.link);
      try {
        await refresh();
      } catch {
        setError('The operation succeeded, but billing details could not be refreshed.');
      }
      return true;
    } catch (postError) {
      setError(postError instanceof Error ? postError.message : 'The request failed.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function upload(form: HTMLFormElement) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const data = new FormData(form);
      data.set('booking_id', bookingId);
      const response = await fetch('/api/admin/documents', { method: 'POST', body: data });
      const result = await response.json() as { success?: boolean; error?: string };
      if (!response.ok || !result.success) throw new Error(result.error || 'Upload failed.');
      form.reset();
      setNotice('Document uploaded.');
      await refresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  const btn = 'rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-bold text-slate-800 disabled:opacity-50';
  const acceptedSummary = billing?.payment_summary.quote_summaries.find(
    (summary) => summary.quote_id === acceptedQuoteId
  );
  const latestInvoice = billing?.invoices.find((invoice) => invoice.status === 'issued') ?? billing?.invoices[0];
  const recordPaymentUrl = `/admin/payments?booking_id=${encodeURIComponent(bookingId)}&booking_ref=${encodeURIComponent(bookingRef)}`;

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4" aria-label="Billing documents and driver invitations">
      <h4 className="font-extrabold text-slate-900">Billing &amp; Documents</h4>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
      {notice && <p role="status" className="text-xs text-emerald-700">{notice}</p>}

      <div className="space-y-2 rounded-xl bg-blue-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase text-blue-900">Billing summary</p>
          <a className={btn} href={recordPaymentUrl}>Record / verify payment</a>
        </div>
        {!acceptedSummary ? (
          <p className="text-xs text-slate-600">No accepted quote is available for billing.</p>
        ) : (
          <div className="grid gap-2 text-xs text-slate-800 sm:grid-cols-2 lg:grid-cols-3">
            <p>Accepted quote: <b>{acceptedSummary.currency} {Number(acceptedSummary.quote_total).toFixed(2)}</b></p>
            <p>Total received: <b>{acceptedSummary.currency} {Number(acceptedSummary.total_paid).toFixed(2)}</b></p>
            <p>Refunded: <b>{acceptedSummary.currency} {Number(acceptedSummary.total_refunded).toFixed(2)}</b></p>
            <p>Net paid: <b>{acceptedSummary.currency} {Number(acceptedSummary.net_paid).toFixed(2)}</b></p>
            <p>Outstanding: <b>{acceptedSummary.currency} {Number(acceptedSummary.outstanding_balance ?? 0).toFixed(2)}</b></p>
            <p>Invoice: <b>{latestInvoice?.status ?? 'not issued'}</b> · Payment: <b>{acceptedSummary.payment_status ?? 'unknown'}</b></p>
            <p>Receipts issued: <b>{billing?.receipts.length ?? 0}</b></p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase text-slate-500">Invoice history</p>
          {acceptedQuoteId && billing && billing.invoices.length === 0 && (
            <button type="button" disabled={busy} className={btn}
              onClick={() => {
                invoiceRequestId.current ??= crypto.randomUUID();
                void post('/api/admin/billing', {
                  action: 'issue_invoice', booking_id: bookingId, quote_id: acceptedQuoteId,
                  request_id: invoiceRequestId.current,
                });
              }}>
              Issue invoice
            </button>
          )}
        </div>
        {!billing && <p className="text-xs text-slate-500">Loading billing details…</p>}
        {billing?.invoices.length === 0 && <p className="text-xs text-slate-500">No invoices issued.</p>}
        {billing?.invoices.map((inv) => (
          <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-2 text-xs">
            <span>
              <b>{inv.invoice_number}</b> r{inv.revision} · {inv.currency} {Number(inv.total).toFixed(2)} · {inv.status}
              {inv.supersedes_invoice_id ? ` · replaces ${billing.invoices.find((old) => old.id === inv.supersedes_invoice_id)?.invoice_number ?? 'previous invoice'}` : ''}
              {inv.cancellation_reason ? ` (${inv.cancellation_reason})` : ''}
              {' · '}issued {new Date(inv.issued_at).toLocaleDateString('en-GB')}
            </span>
            <span className="flex gap-2">
              {inv.document_id && inv.file_status === 'stored' && (
                <>
                  <a className={btn} target="_blank" rel="noopener noreferrer" href={`/api/documents/download?id=${inv.document_id}&view=1`}>View PDF</a>
                  <a className={btn} href={`/api/documents/download?id=${inv.document_id}`}>Download</a>
                </>
              )}
              {inv.document_id && inv.file_status !== 'stored' && inv.status === 'issued' && (
                <button type="button" disabled={busy} className={btn} onClick={() => void post('/api/admin/billing', { action: 'retry_render', document_id: inv.document_id })}>Generate PDF</button>
              )}
              {inv.status === 'issued' && (
                <>
                  <button type="button" disabled={busy} className={btn} onClick={() => {
                    if (!window.confirm(`Replace invoice ${inv.invoice_number}? The current invoice will be retained as cancelled history.`)) return;
                    const reason = window.prompt('Reason for issuing a replacement invoice?');
                    if (!reason?.trim()) return;
                    replacementRequestIds.current[inv.id] ??= crypto.randomUUID();
                    void post('/api/admin/billing', {
                      action: 'replace_invoice', invoice_id: inv.id, reason,
                      request_id: replacementRequestIds.current[inv.id],
                    });
                  }}>Replace</button>
                  <button type="button" disabled={busy} className={btn} onClick={() => {
                    if (!window.confirm(`Cancel invoice ${inv.invoice_number}? This cannot be undone.`)) return;
                    const reason = window.prompt('Reason for cancelling this invoice?');
                    if (reason) void post('/api/admin/billing', { action: 'cancel_invoice', invoice_id: inv.id, reason });
                  }}>Cancel</button>
                </>
              )}
            </span>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-bold uppercase text-slate-500">Payments, refunds &amp; receipts</p>
        {billing?.payment_summary.payments.length === 0 && <p className="text-xs text-slate-500">No verified payment or refund records.</p>}
        {billing?.payment_summary.payments.map((payment) => {
          const receipt = billing.receipts.find((item) => item.payment_id === payment.payment_id);
          return (
            <div key={payment.payment_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-2 text-xs">
              <span>
                <b>{payment.entry_type === 'receipt' ? payment.receipt_number ?? 'Payment' : 'Refund'}</b>
                {' · '}{payment.currency} {Number(payment.amount).toFixed(2)} · {payment.method.replaceAll('_', ' ')}
                {' · '}{payment.status} · {payment.payment_date ?? new Date(payment.verified_at).toLocaleDateString('en-GB')}
                {payment.reference ? ` · Ref ${payment.reference}` : ''}
                {payment.refund_reason ? ` · ${payment.refund_reason}` : ''}
              </span>
              {payment.entry_type === 'receipt' && (
                receipt?.document_id && receipt.file_status === 'stored'
                  ? <>
                    <a className={btn} target="_blank" rel="noopener noreferrer" href={`/api/documents/download?id=${receipt.document_id}&view=1`}>View receipt</a>
                    <a className={btn} href={`/api/documents/download?id=${receipt.document_id}`}>Download receipt</a>
                  </>
                  : <button type="button" disabled={busy} className={btn}
                    onClick={() => void post('/api/admin/billing', { action: 'issue_receipt', payment_id: payment.payment_id })}>
                    {receipt?.document_id ? 'Retry receipt PDF' : 'Issue receipt'}
                  </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-bold uppercase text-slate-500">Other documents</p>
        {billing?.documents.map((doc) => (
          <a key={doc.id} className="block text-xs font-semibold text-blue-800 underline" href={`/api/documents/download?id=${doc.id}`}>{doc.title}</a>
        ))}
        <form className="flex flex-wrap items-center gap-2 text-xs" onSubmit={(event) => { event.preventDefault(); void upload(event.currentTarget); }}>
          <input name="title" required maxLength={120} placeholder="Title" className="rounded-lg border border-slate-300 px-2 py-1" />
          <input name="file" type="file" required accept="application/pdf,image/png,image/jpeg" />
          <label><input type="checkbox" name="customer_visible" value="true" /> Customer</label>
          <label><input type="checkbox" name="driver_visible" value="true" /> Driver</label>
          <button type="submit" disabled={busy} className={btn}>Upload</button>
        </form>
        <div className="flex gap-2">
          {(['customer', 'driver'] as const).map((audience) => (
            <span key={audience} className="flex gap-1">
              <button type="button" disabled={busy} className={btn} onClick={() => void post('/api/admin/guest-access', { booking_id: bookingId, audience, enabled: false })}>Revoke guest {audience} documents</button>
              <button type="button" disabled={busy} className={btn} onClick={() => void post('/api/admin/guest-access', { booking_id: bookingId, audience, enabled: true })}>Restore</button>
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase text-slate-500">Driver invitations</p>
          {assignmentId && (
            <button type="button" disabled={busy} className={btn} onClick={() => void post('/api/admin/driver-invitations', { action: 'create', assignment_id: assignmentId })}>Create invitation</button>
          )}
        </div>
        {link && (
          <p className="break-all rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
            Share privately (shown once): {link}
          </p>
        )}
        {invitations.length === 0 && <p className="text-xs text-slate-500">No invitations.</p>}
        {invitations.map((inv) => (
          <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-2 text-xs">
            <span>{inv.driver_name ?? 'Driver'} · {inv.status} · expires {new Date(inv.expires_at).toLocaleString('en-GB')}{inv.first_viewed_at ? ' · viewed' : ''}</span>
            {inv.status === 'active' && (
              <button type="button" disabled={busy} className={btn} onClick={() => void post('/api/admin/driver-invitations', { action: 'revoke', invitation_id: inv.id })}>Revoke</button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
