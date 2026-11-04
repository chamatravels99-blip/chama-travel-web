'use client';

import { useCallback, useEffect, useState } from 'react';
import Navbar from '@/components/shared/Navbar';
import BookingForm from '@/components/BookingForm';
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
  entry_type: string;
  amount: number;
  currency: string;
  method: string;
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

export default function CustomerDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [notice, setNotice] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [claimInputs, setClaimInputs] = useState<Record<string, { amount: string; method: string; reference: string }>>({});
  const [savingAction, setSavingAction] = useState('');

  const loadBookings = useCallback(async () => {
    try {
      const response = await fetch('/api/customer/bookings', { cache: 'no-store' });
      const result = await response.json() as { success?: boolean; error?: string; data?: Booking[] };
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || 'Your bookings could not be loaded.');
      }
      setBookings(result.data);
      setPageError('');
    } catch (loadError) {
      setPageError(loadError instanceof Error ? loadError.message : 'Your bookings could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(loadBookings); }, [loadBookings]);

  async function acceptQuote(quoteId: string) {
    setSavingAction(quoteId);
    setNotice('');
    try {
      const response = await fetch('/api/customer/quotes/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quote_id: quoteId }),
      });
      const result = await response.json() as { success?: boolean; error?: string; message?: string };
      if (!response.ok || !result.success) throw new Error(result.error || 'The quote could not be accepted.');
      setNotice('Quote accepted. Your booking is now confirmed.');
      await loadBookings();
    } catch (actionError) {
      setNotice(actionError instanceof Error ? actionError.message : 'The quote could not be accepted.');
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

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans flex flex-col">
      <Navbar currentRole="Customer" />
      <main className="max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <header className="bg-gradient-to-r from-blue-700 via-blue-600 to-emerald-500 rounded-3xl p-6 md:p-8 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-xs font-bold uppercase tracking-wider">Chama Travels customer portal</div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">Your journeys and transfers</h1>
            <p className="text-blue-100 text-sm max-w-xl">Review your booking progress, accept quotes and submit payment claims.</p>
          </div>
          <button onClick={() => setIsModalOpen(true)} className="px-6 py-3.5 bg-white text-blue-700 hover:bg-blue-50 font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow-lg transition flex items-center justify-center gap-2 shrink-0">
            <Plus className="w-4 h-4" /> Book a transfer
          </button>
        </header>

        {notice && <p className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900" aria-live="polite">{notice}</p>}
        {pageError && <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{pageError}</p>}

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-slate-900">My reservations</h2>
            <span className="text-xs font-bold text-slate-400">{bookings.length} bookings</span>
          </div>
          {loading ? (
            <div className="text-center py-12 text-slate-400 bg-white rounded-3xl border border-slate-200">Loading your reservations…</div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-12 text-slate-500 bg-white rounded-3xl border border-slate-200 space-y-3">
              <p className="text-sm font-semibold">No registered-customer bookings found.</p>
              <button onClick={() => setIsModalOpen(true)} className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl">Create a booking</button>
            </div>
          ) : (
            <div className="space-y-4">
              {bookings.map((booking) => (
                <article key={booking.id} className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200 shadow-xs space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black text-slate-900">{booking.booking_ref}</span>
                      <span className="px-3 py-1 bg-blue-50 text-blue-700 font-bold text-xs rounded-xl">{booking.service_type.replaceAll('_', ' ')}</span>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-[10px] font-extrabold uppercase">{booking.booking_status.replaceAll('_', ' ')}</span>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {booking.legs.map((leg) => (
                      <div key={leg.id} className="rounded-2xl bg-slate-50 p-4 space-y-2">
                        <div className="text-[10px] uppercase font-bold text-slate-400">Leg {leg.sequence_no} · {leg.trip_status.replaceAll('_', ' ')}</div>
                        <div className="flex items-start gap-2 text-sm"><MapPin className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" /><span><b>Pickup:</b> {leg.pickup_location}</span></div>
                        <div className="flex items-start gap-2 text-sm"><MapPin className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" /><span><b>Drop-off:</b> {leg.dropoff_location}</span></div>
                        <div className="flex items-center gap-2 text-xs text-slate-500"><Calendar className="w-3.5 h-3.5" />{colomboDate(leg.pickup_at)}</div>
                        {leg.flight_number && <div className="text-xs text-slate-500">Flight {leg.flight_number}</div>}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">{booking.passenger_count} passenger(s) · {booking.luggage_count} bag(s){booking.customer_notes ? ` · ${booking.customer_notes}` : ''}</p>

                  {booking.quotes.map((quote) => {
                    const canAccept = quote.quote_status === 'sent' && quote.expires_at && new Date(quote.expires_at).getTime() > Date.now();
                    const input = claimInputs[quote.id] ?? { amount: String(quote.total), method: 'cash', reference: '' };
                    const claimExists = booking.payment_claims.some((claim) => claim.quote_id === quote.id && claim.claim_status === 'submitted');
                    return (
                      <section key={quote.id} className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="font-extrabold text-slate-900">Quote revision {quote.revision}</h3>
                          <span className="font-black text-blue-800">{quote.currency} {Number(quote.total).toFixed(2)} · {quote.quote_status}</span>
                        </div>
                        {quote.expires_at && <p className="text-xs text-slate-500">Expires {colomboDate(quote.expires_at)}</p>}
                        <ul className="space-y-1 text-xs text-slate-600">
                          {quote.lines.map((line) => <li key={line.id} className="flex justify-between gap-4"><span>{line.description} × {line.quantity}</span><span>{quote.currency} {Number(line.line_total).toFixed(2)}</span></li>)}
                        </ul>
                        {canAccept && (
                          <button disabled={savingAction === quote.id} onClick={() => void acceptQuote(quote.id)} className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">
                            {savingAction === quote.id ? 'Accepting…' : 'Accept quote and confirm booking'}
                          </button>
                        )}
                        {quote.quote_status === 'accepted' && !claimExists && (
                          <form onSubmit={(event) => { event.preventDefault(); void submitPaymentClaim(booking.id, quote.id); }} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                            <label className="sr-only" htmlFor={`payment-amount-${quote.id}`}>Payment amount</label>
                            <input id={`payment-amount-${quote.id}`} required inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" value={input.amount} onChange={(event) => setClaimInputs({ ...claimInputs, [quote.id]: { ...input, amount: event.target.value } })} className="rounded-xl border border-slate-200 p-2.5 text-sm" aria-label="Payment amount" />
                            <select value={input.method} onChange={(event) => setClaimInputs({ ...claimInputs, [quote.id]: { ...input, method: event.target.value } })} className="rounded-xl border border-slate-200 p-2.5 text-sm" aria-label="Payment method">
                              <option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option>
                            </select>
                            <input value={input.reference} onChange={(event) => setClaimInputs({ ...claimInputs, [quote.id]: { ...input, reference: event.target.value } })} maxLength={160} placeholder="Payment reference (optional)" className="rounded-xl border border-slate-200 p-2.5 text-sm" />
                            <button disabled={savingAction === quote.id} className="rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50"><Wallet className="inline h-4 w-4 mr-1" />Submit claim</button>
                          </form>
                        )}
                      </section>
                    );
                  })}

                  {(booking.payment_claims.length > 0 || booking.payments.length > 0) && (
                    <section className="border-t border-slate-100 pt-4 space-y-2">
                      <h3 className="text-xs font-bold uppercase text-slate-500">Payments and claims</h3>
                      {booking.payment_claims.map((claim) => (
                        <p key={claim.id} className="text-xs text-slate-600">Claim · {claim.currency} {Number(claim.amount).toFixed(2)} · {claim.method.replaceAll('_', ' ')} · {claim.claim_status}</p>
                      ))}
                      {booking.payments.map((payment) => (
                        <p key={payment.id} className="text-xs text-slate-600 inline-flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5 text-emerald-600" />{payment.entry_type} · {payment.currency} {Number(payment.amount).toFixed(2)} · verified {colomboDate(payment.verified_at)}</p>
                      ))}
                    </section>
                  )}

                  {booking.events.length > 0 && (
                    <details className="border-t border-slate-100 pt-3">
                      <summary className="cursor-pointer text-xs font-bold text-slate-600">Booking history</summary>
                      <ul className="mt-2 space-y-1">
                        {booking.events.map((event) => (
                          <li key={event.id} className="text-xs text-slate-500 inline-flex items-center gap-2">
                            <Clock className="h-3 w-3" />{event.event_type.replaceAll('_', ' ')}
                            {event.from_status && event.to_status ? `: ${event.from_status} → ${event.to_status}` : ''}
                            · {colomboDate(event.created_at)}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
      {isModalOpen && (
        <BookingForm
          isOpen
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => { setIsModalOpen(false); void loadBookings(); }}
        />
      )}
    </div>
  );
}
