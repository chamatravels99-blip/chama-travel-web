'use client';

import { useEffect, useState } from 'react';
import GuestDocuments from '@/components/GuestDocuments';

type TrackerData = {
  booking: {
    booking_ref: string;
    service_type: string;
    journey_type: string;
    booking_status: string;
    passenger_count: number;
    luggage_count: number;
    created_at: string;
  };
  legs: Array<{
    sequence_no: number;
    pickup_location: string;
    dropoff_location: string;
    pickup_at: string;
    planned_end_at: string | null;
    trip_status: string;
  }>;
  quotes: Array<{
    revision: number;
    currency: string;
    total: number;
    quote_status: string;
    issued_at: string | null;
    expires_at: string | null;
    accepted_at: string | null;
    lines: Array<{
      description: string;
      quantity: number;
      unit_amount: number;
      line_total: number;
    }>;
  }>;
  payments: Array<{
    entry_type: string;
    amount: number;
    currency: string;
    method: string;
    receipt_number: string | null;
    payment_date: string | null;
    recorded_at: string;
  }>;
  payment_summary: {
    currency: string;
    total: number;
    paid: number;
    balance: number;
  } | null;
  progress: Array<{
    event_type: string;
    from_status: string | null;
    to_status: string | null;
    created_at: string;
  }>;
  driver: {
    name: string;
    phone: string | null;
    vehicle_name: string;
    vehicle_type: string;
    registration_number: string;
  } | null;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-GB', {
    timeZone: 'Asia/Colombo',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function titleCase(value: string) {
  return value.replaceAll('_', ' ');
}

export default function GuestBookingTracker() {
  const [tracker, setTracker] = useState<TrackerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const value = window.location.hash.slice(1);
    void fetch('/api/guest/bookings/access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ action: 'view', token: value }),
    }).then(async (response) => {
      const result = await response.json() as {
        success?: boolean;
        error?: string;
        data?: TrackerData;
      };
      if (!response.ok || !result.success || !result.data) {
        setError(result.error || 'This booking link is invalid, expired, revoked, or unavailable.');
        return;
      }
      setTracker(result.data);
    }).catch(() => {
      setError('Booking details could not be loaded. Please try again.');
    }).finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="rounded-3xl bg-slate-900 p-6 text-white sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-300">Chama Travels</p>
          <h1 className="mt-2 text-2xl font-black">Your booking tracker</h1>
          <p className="mt-2 text-sm text-slate-300">This private link provides access to one booking. Keep it secure.</p>
        </header>

        {loading && <p className="rounded-2xl bg-white p-6 text-sm text-slate-600">Loading booking details…</p>}
        {error && <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        {tracker && (
          <>
            <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Booking reference</p>
                  <h2 className="mt-1 text-xl font-black text-slate-950">{tracker.booking.booking_ref}</h2>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold uppercase text-blue-800">{titleCase(tracker.booking.booking_status)}</span>
              </div>
              <p className="text-sm text-slate-700">
                {titleCase(tracker.booking.service_type)} · {titleCase(tracker.booking.journey_type)} ·
                {' '}{tracker.booking.passenger_count} passenger(s) · {tracker.booking.luggage_count} bag(s)
              </p>
              <div className="space-y-3 border-t border-slate-100 pt-4">
                <h3 className="font-extrabold text-slate-900">Journey</h3>
                {tracker.legs.map((leg) => (
                  <article key={leg.sequence_no} className="grid gap-2 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
                    <p className="font-bold">Leg {leg.sequence_no} · {titleCase(leg.trip_status)}</p>
                    <p className="text-slate-600 sm:text-right">{formatDate(leg.pickup_at)}</p>
                    <p><b>Pickup:</b> {leg.pickup_location}</p>
                    <p><b>Drop-off:</b> {leg.dropoff_location}</p>
                    {leg.planned_end_at && <p className="text-xs text-slate-600">Expected end: {formatDate(leg.planned_end_at)}</p>}
                  </article>
                ))}
              </div>
              <div className="border-t border-slate-100 pt-4">
                <h3 className="font-extrabold text-slate-900">Trip progress</h3>
                {tracker.progress.length === 0
                  ? <p className="mt-2 text-sm text-slate-500">No progress updates have been recorded yet.</p>
                  : <ol className="mt-2 space-y-2">{tracker.progress.map((event, index) => (
                    <li key={`${event.event_type}-${event.created_at}-${index}`} className="flex flex-wrap justify-between gap-2 text-sm text-slate-700">
                      <span>{titleCase(event.to_status || event.event_type)}</span>
                      <time className="text-xs text-slate-500">{formatDate(event.created_at)}</time>
                    </li>
                  ))}</ol>}
              </div>
            </section>

            <section className="grid gap-5 md:grid-cols-2">
              <article className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-extrabold text-slate-900">Quotes</h3>
                {tracker.quotes.length === 0
                  ? <p className="text-sm text-slate-500">A quotation has not been issued yet.</p>
                  : tracker.quotes.map((quote) => (
                    <div key={quote.revision} className="rounded-2xl bg-slate-50 p-3">
                      <p className="font-bold">Revision {quote.revision} · {quote.currency} {Number(quote.total).toFixed(2)}</p>
                      <p className="mt-1 text-xs capitalize text-slate-600">{titleCase(quote.quote_status)}{quote.expires_at ? ` · Expires ${formatDate(quote.expires_at)}` : ''}</p>
                      {quote.lines.map((line, index) => (
                        <p key={`${quote.revision}-${index}`} className="mt-1 text-xs text-slate-600">
                          {line.description} · {line.quantity} × {quote.currency} {Number(line.unit_amount).toFixed(2)}
                        </p>
                      ))}
                    </div>
                  ))}
              </article>
              <article className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-extrabold text-slate-900">Payments</h3>
                {tracker.payment_summary && (
                  <p className="text-sm font-semibold text-slate-700">
                    Agreed {tracker.payment_summary.currency} {Number(tracker.payment_summary.total).toFixed(2)} ·
                    {' '}Paid {tracker.payment_summary.currency} {Number(tracker.payment_summary.paid).toFixed(2)} ·
                    {' '}Balance {tracker.payment_summary.currency} {Number(tracker.payment_summary.balance).toFixed(2)}
                  </p>
                )}
                {tracker.payments.length === 0
                  ? <p className="text-sm text-slate-500">No payment entries are recorded.</p>
                  : tracker.payments.map((payment, index) => (
                    <p key={`${payment.receipt_number || payment.entry_type}-${index}`} className="text-xs text-slate-700">
                      {titleCase(payment.entry_type)} · {payment.currency} {Number(payment.amount).toFixed(2)}
                      {payment.receipt_number ? ` · Receipt ${payment.receipt_number}` : ''}
                      {payment.payment_date ? ` · ${payment.payment_date}` : ''}
                    </p>
                  ))}
                <GuestDocuments token={window.location.hash.slice(1)} audience="customer" />
              </article>
            </section>

            {tracker.driver && (
              <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
                <h3 className="font-extrabold text-emerald-950">Accepted driver</h3>
                <p className="mt-2 text-sm text-emerald-900">
                  {tracker.driver.name} · {tracker.driver.vehicle_name} ({tracker.driver.vehicle_type})
                  {tracker.driver.registration_number ? ` · ${tracker.driver.registration_number}` : ''}
                </p>
                {tracker.driver.phone && <a className="mt-1 inline-block text-sm font-bold text-emerald-800 underline" href={`tel:${tracker.driver.phone}`}>{tracker.driver.phone}</a>}
              </section>
            )}

          </>
        )}
      </div>
    </main>
  );
}
