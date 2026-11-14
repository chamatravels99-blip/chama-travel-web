'use client';

import { useCallback, useEffect, useState } from 'react';
import Navbar from '@/components/shared/Navbar';
import BookingForm from '@/components/BookingForm';
import AssignedDriver from './AssignedDriver';
import BookingDocuments from '@/components/BookingDocuments';
import { Calendar, CheckCircle, Clock, MapPin, Plus, Wallet } from 'lucide-react';

type QuoteLine = { id: string; description: string; quantity: number; unit_amount: number; line_total: number };
type Quote = {
  id: string;
  revision: number;
  currency: string;
  total: number;
  quote_status: string;
  issued_at: string | null;
  expires_at: string | null;
  accepted_at: string | null;
  lines: QuoteLine[];
};
type Leg = {
  id: string;
  sequence_no: number;
  pickup_location: string;
  dropoff_location: string;
  pickup_at: string;
  planned_end_at: string | null;
  flight_number: string | null;
  trip_notes: string | null;
  trip_status: string;
};
type PaymentClaim = {
  id: string;
  quote_id: string;
  amount: number;
  currency: string;
  method: string;
  claim_status: string;
  submitted_at: string;
};
type Payment = {
  id: string;
  quote_id: string;
  entry_type: string;
  amount: number;
  currency: string;
  method: string;
  receipt_number: string | null;
  payment_date: string | null;
  verified_at: string;
};
type Booking = {
  id: string;
  booking_ref: string;
  service_type: string;
  journey_type: string;
  booking_status: string;
  passenger_count: number;
  luggage_count: number;
  customer_notes: string | null;
  created_at: string;
  legs: Leg[];
  quotes: Quote[];
  payment_claims: PaymentClaim[];
  payments: Payment[];
  events: { id: string; event_type: string; from_status: string | null; to_status: string | null; created_at: string }[];
};

function colomboDate(value: string) {
  return new Date(value).toLocaleString('en-GB', {
    timeZone: 'Asia/Colombo',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function statusBadgeClasses(status: string) {
  if (['pending', 'reviewing', 'submitted'].includes(status)) {
    return 'bg-amber-50 text-amber-800 ring-amber-600/15';
  }
  if (['confirmed', 'accepted', 'verified', 'completed', 'active'].includes(status)) {
    return 'bg-emerald-50 text-emerald-800 ring-emerald-600/15';
  }
  if (['sent', 'quoted', 'in_progress'].includes(status)) {
    return 'bg-blue-50 text-blue-800 ring-blue-600/15';
  }
  if (['cancelled', 'expired', 'rejected', 'declined'].includes(status)) {
    return 'bg-rose-50 text-rose-800 ring-rose-600/15';
  }
  return 'bg-slate-100 text-slate-700 ring-slate-600/10';
}

export default function CustomerDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [notice, setNotice] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [claimInputs, setClaimInputs] = useState<Record<string, { amount: string; method: string; reference: string }>>({});
  const [savingAction, setSavingAction] = useState('');
  const [refreshVersion, setRefreshVersion] = useState(0);

  const loadBookings = useCallback(async () => {
    try {
      const response = await fetch('/api/customer/bookings', { cache: 'no-store' });
      const result = await response.json() as { success?: boolean; error?: string; data?: Booking[] };
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || 'Your bookings could not be loaded.');
      }
      setBookings(result.data);
      setRefreshVersion((value) => value + 1);
      setPageError('');
    } catch (loadError) {
      setPageError(loadError instanceof Error ? loadError.message : 'Your bookings could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(loadBookings); }, [loadBookings]);

  async function respondToQuote(quoteId: string, action: 'accept' | 'reject') {
    setSavingAction(quoteId);
    setNotice('');
    try {
      const response = await fetch(`/api/customer/quotes/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quote_id: quoteId }),
      });
      const result = await response.json() as { success?: boolean; error?: string; message?: string };
      if (!response.ok || !result.success) throw new Error(result.error || 'The quote response could not be recorded.');
      setNotice(action === 'accept' ? 'Quote accepted. Your booking is now confirmed.' : 'Quote rejected.');
      await loadBookings();
    } catch (actionError) {
      setNotice(actionError instanceof Error ? actionError.message : 'The quote response could not be recorded.');
    } finally {
      setSavingAction('');
    }
  }

  async function submitPaymentClaim(bookingId: string, quoteId: string) {
    const input = claimInputs[quoteId] ?? { amount: '', method: 'cash', reference: '' };
    setSavingAction(quoteId);
    setNotice('');
    try {
      const response = await fetch('/api/customer/payment-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: bookingId,
          quote_id: quoteId,
          amount: input.amount,
          method: input.method,
          customer_reference: input.reference,
        }),
      });
      const result = await response.json() as { success?: boolean; error?: string };
      if (!response.ok || !result.success) throw new Error(result.error || 'The payment claim could not be submitted.');
      setNotice('Payment claim submitted. It is not verified until an administrator reviews it.');
      await loadBookings();
    } catch (actionError) {
      setNotice(actionError instanceof Error ? actionError.message : 'The payment claim could not be submitted.');
    } finally {
      setSavingAction('');
    }
  }

  const needsAttention = bookings.filter((booking) =>
    ['pending', 'reviewing', 'quoted'].includes(booking.booking_status)
  ).length;
  const confirmedBookings = bookings.filter((booking) => booking.booking_status === 'confirmed').length;
  const pendingClaims = bookings.reduce(
    (count, booking) => count + booking.payment_claims.filter((claim) => claim.claim_status === 'submitted').length,
    0
  );

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 font-sans text-slate-800">
      <Navbar currentRole="Customer" />
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <header className="flex flex-col justify-between gap-5 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7 md:flex-row md:items-center">
          <div className="min-w-0">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-800">
              <Calendar className="h-4 w-4" /> Chama Travels customer portal
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Welcome to your journeys</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">View your transfers, follow booking updates, accept quotes and submit payment claims.</p>
          </div>
          <button type="button" onClick={() => setIsModalOpen(true)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-blue-700 px-5 py-3.5 text-xs font-extrabold uppercase tracking-wider text-white shadow-sm transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
            <Plus className="h-4 w-4" /> Book a transfer
          </button>
        </header>

        {!loading && !pageError && (
          <section aria-label="Booking overview" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Total bookings', count: bookings.length, icon: Calendar, color: 'bg-blue-50 text-blue-700' },
              { label: 'Needs attention', count: needsAttention, icon: Clock, color: 'bg-amber-50 text-amber-700' },
              { label: 'Confirmed journeys', count: confirmedBookings, icon: CheckCircle, color: 'bg-emerald-50 text-emerald-700' },
              { label: 'Payment claims in review', count: pendingClaims, icon: Wallet, color: 'bg-slate-100 text-slate-700' },
            ].map(({ label, count, icon: Icon, color }) => (
              <div key={label} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                </div>
                <p className="mt-3 text-3xl font-black tracking-tight text-slate-950">{count}</p>
              </div>
            ))}
          </section>
        )}

        {notice && <p className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900" aria-live="polite">{notice}</p>}
        {pageError && <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900" role="alert">{pageError}</p>}

        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-slate-900">Your booking history</h2>
              <p className="mt-1 text-xs text-slate-500">Review details, trip progress, quotes and payments for each journey.</p>
            </div>
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-600 ring-1 ring-inset ring-slate-200">{bookings.length} bookings</span>
          </div>
          {loading ? (
            <div className="rounded-3xl border border-slate-200/80 bg-white px-5 py-12 text-center text-sm text-slate-500 shadow-sm">Loading your bookings…</div>
          ) : bookings.length === 0 ? (
            <div className="space-y-3 rounded-3xl border border-slate-200/80 bg-white px-5 py-12 text-center shadow-sm">
              <p className="text-sm font-semibold text-slate-700">No bookings yet. Arrange a transfer to get started.</p>
              <button type="button" onClick={() => setIsModalOpen(true)} className="rounded-xl bg-blue-700 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">Book your first transfer</button>
            </div>
          ) : (
            <div className="space-y-4">
              {bookings.map((booking) => {
                const acceptedQuote = booking.quotes.find((quote) => quote.quote_status === 'accepted');
                const acceptedPayments = acceptedQuote
                  ? booking.payments.filter((payment) => payment.quote_id === acceptedQuote.id)
                  : [];
                const paidCents = acceptedPayments.reduce(
                  (sum, payment) => sum + (payment.entry_type === 'receipt' ? Math.round(Number(payment.amount) * 100) : 0),
                  0
                );
                const refundedCents = acceptedPayments.reduce(
                  (sum, payment) => sum + (payment.entry_type === 'refund' ? Math.round(Number(payment.amount) * 100) : 0),
                  0
                );
                const netPaidCents = paidCents - refundedCents;
                const outstandingCents = Math.max(Math.round(Number(acceptedQuote?.total ?? 0) * 100) - netPaidCents, 0);
                const paymentStatus = refundedCents > 0 && netPaidCents <= 0
                  ? 'refunded'
                  : netPaidCents <= 0
                    ? 'unpaid'
                    : netPaidCents >= Math.round(Number(acceptedQuote?.total ?? 0) * 100)
                      ? 'paid'
                      : 'partially paid';
                return (
                <article key={booking.id} className="min-w-0 space-y-5 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="break-all font-black text-slate-950">{booking.booking_ref}</span>
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800 ring-1 ring-inset ring-blue-600/15">{booking.service_type.replaceAll('_', ' ')}</span>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[10px] font-extrabold uppercase ring-1 ring-inset ${statusBadgeClasses(booking.booking_status)}`}>{booking.booking_status.replaceAll('_', ' ')}</span>
                  </div>

                  <div className="grid min-w-0 gap-3 md:grid-cols-2">
                    {booking.legs.map((leg) => (
                      <div key={leg.id} className="min-w-0 space-y-2 rounded-2xl border border-slate-200/70 bg-slate-50 p-4">
                        <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase text-slate-500">
                          <span>Leg {leg.sequence_no}</span>
                          <span className={`rounded-full px-2 py-1 ring-1 ring-inset ${statusBadgeClasses(leg.trip_status)}`}>{leg.trip_status.replaceAll('_', ' ')}</span>
                        </div>
                        <div className="flex min-w-0 items-start gap-2 text-sm"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" /><span className="break-words"><b>Pickup:</b> {leg.pickup_location}</span></div>
                        <div className="flex min-w-0 items-start gap-2 text-sm"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" /><span className="break-words"><b>Drop-off:</b> {leg.dropoff_location}</span></div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600"><Calendar className="h-3.5 w-3.5 shrink-0" />{colomboDate(leg.pickup_at)}</div>
                        {leg.flight_number && <div className="break-words text-xs text-slate-600">Flight {leg.flight_number}</div>}
                      </div>
                    ))}
                  </div>
                  <p className="break-words text-xs leading-5 text-slate-600">{booking.passenger_count} passenger(s) · {booking.luggage_count} bag(s){booking.customer_notes ? ` · ${booking.customer_notes}` : ''}</p>

                  {['confirmed', 'assigned', 'in_progress', 'completed'].includes(booking.booking_status) && (
                    <AssignedDriver key={`${booking.id}-${refreshVersion}`} bookingId={booking.id} />
                  )}
                  <BookingDocuments bookingId={booking.id} />
                  {acceptedQuote && (
                    <section className="grid gap-2 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 text-xs text-slate-800 sm:grid-cols-2 lg:grid-cols-3">
                      <p className="font-bold text-slate-900 sm:col-span-2 lg:col-span-3">Payment summary · {acceptedQuote.currency}</p>
                      <p>Accepted quote: <b>{acceptedQuote.currency} {Number(acceptedQuote.total).toFixed(2)}</b></p>
                      <p>Total received: <b>{acceptedQuote.currency} {(paidCents / 100).toFixed(2)}</b></p>
                      <p>Refunded: <b>{acceptedQuote.currency} {(refundedCents / 100).toFixed(2)}</b></p>
                      <p>Net paid: <b>{acceptedQuote.currency} {(netPaidCents / 100).toFixed(2)}</b></p>
                      <p>Outstanding: <b>{acceptedQuote.currency} {(outstandingCents / 100).toFixed(2)}</b></p>
                      <p>Status: <b>{paymentStatus}</b></p>
                    </section>
                  )}

                  {booking.quotes.map((quote) => {
                    const canAccept = quote.quote_status === 'sent' && quote.expires_at && new Date(quote.expires_at).getTime() > Date.now();
                    const input = claimInputs[quote.id] ?? { amount: String(quote.total), method: 'cash', reference: '' };
                    const claimExists = booking.payment_claims.some((claim) => claim.quote_id === quote.id && claim.claim_status === 'submitted');
                    return (
                      <section key={quote.id} className="space-y-3 rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="font-extrabold text-slate-900">Quote revision {quote.revision}</h3>
                          <span className="flex flex-wrap items-center gap-2 font-black text-blue-900">{quote.currency} {Number(quote.total).toFixed(2)} <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ring-1 ring-inset ${statusBadgeClasses(quote.quote_status)}`}>{quote.quote_status}</span></span>
                        </div>
                        {quote.expires_at && <p className="text-xs text-slate-600">Expires {colomboDate(quote.expires_at)}</p>}
                        <ul className="space-y-1 text-xs text-slate-600">
                          {quote.lines.map((line) => <li key={line.id} className="flex min-w-0 justify-between gap-3"><span className="break-words">{line.description} × {line.quantity}</span><span className="shrink-0">{quote.currency} {Number(line.line_total).toFixed(2)}</span></li>)}
                        </ul>
                        {canAccept && (
                          <div className="flex flex-wrap gap-2">
                            <button type="button" disabled={savingAction === quote.id} onClick={() => void respondToQuote(quote.id, 'accept')} className="rounded-xl bg-blue-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">Accept quote and confirm booking</button>
                            <button type="button" disabled={savingAction === quote.id} onClick={() => { if (window.confirm('Reject this quote? This will reject the booking.')) void respondToQuote(quote.id, 'reject'); }} className="rounded-xl border border-rose-300 px-4 py-2.5 text-xs font-bold text-rose-700 disabled:opacity-50">Reject quote</button>
                          </div>
                        )}
                        {quote.quote_status === 'accepted' && !claimExists && (
                          <form onSubmit={(event) => { event.preventDefault(); void submitPaymentClaim(booking.id, quote.id); }} className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                            <label className="sr-only" htmlFor={`payment-amount-${quote.id}`}>Payment amount</label>
                            <input id={`payment-amount-${quote.id}`} required inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" value={input.amount} onChange={(event) => setClaimInputs({ ...claimInputs, [quote.id]: { ...input, amount: event.target.value } })} className="min-w-0 rounded-xl border border-slate-200 bg-white p-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" aria-label="Payment amount" />
                            <select value={input.method} onChange={(event) => setClaimInputs({ ...claimInputs, [quote.id]: { ...input, method: event.target.value } })} className="min-w-0 rounded-xl border border-slate-200 bg-white p-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" aria-label="Payment method">
                              <option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option>
                            </select>
                            <input value={input.reference} onChange={(event) => setClaimInputs({ ...claimInputs, [quote.id]: { ...input, reference: event.target.value } })} maxLength={160} placeholder="Payment reference (optional)" className="min-w-0 rounded-xl border border-slate-200 bg-white p-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
                            <button disabled={savingAction === quote.id} className="rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 disabled:opacity-50"><Wallet className="mr-1 inline h-4 w-4" />Submit claim</button>
                          </form>
                        )}
                      </section>
                    );
                  })}

                  {(booking.payment_claims.length > 0 || booking.payments.length > 0) && (
                    <section className="space-y-2 border-t border-slate-100 pt-4">
                      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">Payments and claims</h3>
                      {booking.payment_claims.map((claim) => (
                        <p key={claim.id} className="flex flex-wrap items-center gap-2 text-xs text-slate-700">Claim · {claim.currency} {Number(claim.amount).toFixed(2)} · {claim.method.replaceAll('_', ' ')} <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ring-1 ring-inset ${statusBadgeClasses(claim.claim_status)}`}>{claim.claim_status}</span></p>
                      ))}
                      {booking.payments.map((payment) => (
                        <p key={payment.id} className="flex flex-wrap items-center gap-1 text-xs text-slate-700">
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-700" />
                          {payment.entry_type} · {payment.currency} {Number(payment.amount).toFixed(2)}
                          {payment.receipt_number ? ` · receipt ${payment.receipt_number}` : ''}
                          {' · '}{payment.payment_date || `verified ${colomboDate(payment.verified_at)}`}
                        </p>
                      ))}
                    </section>
                  )}

                  {booking.events.length > 0 && (
                    <details className="border-t border-slate-100 pt-3">
                      <summary className="cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 text-xs font-bold text-slate-700">Booking history</summary>
                      <ul className="mt-2 space-y-1">
                        {booking.events.map((event) => (
                          <li key={event.id} className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                            <Clock className="h-3 w-3" />{event.event_type.replaceAll('_', ' ')}
                            {event.from_status && event.to_status ? `: ${event.from_status} → ${event.to_status}` : ''}
                            · {colomboDate(event.created_at)}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
      {isModalOpen && (
        <BookingForm
          isOpen
          onClose={() => setIsModalOpen(false)}
          onSuccess={(bookingReference) => {
            setNotice(`Booking saved successfully. Reference: ${bookingReference}.`);
            void loadBookings();
          }}
        />
      )}
    </div>
  );
}
