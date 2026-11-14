'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import GuestDocuments from '@/components/GuestDocuments';

type Invitation = {
  assignment: { id: string; status: string };
  invitation: { expires_at: string };
  booking: {
    booking_ref: string;
    service_type: string;
    journey_type: string;
    passenger_count: number;
    luggage_count: number;
    customer_name: string | null;
    customer_phone: string | null;
  };
  legs: Array<{ sequence_no: number; pickup_location: string; dropoff_location: string; pickup_at: string; flight_number: string | null }>;
  vehicle: { name: string; registration_number: string | null } | null;
  hire_offer: { id: string; amount: number; currency: string; status: string } | null;
};

function tokenFromHash() {
  const value = window.location.hash.replace(/^#(token=)?/, '');
  return /^[0-9a-f]{64}$/i.test(value) ? value : '';
}

function titleCase(value: string) {
  return value.replaceAll('_', ' ');
}

export default function DriverInvitation() {
  const [data, setData] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [token, setToken] = useState('');

  const call = useCallback(async (body: Record<string, unknown>) => {
    const response = await fetch('/api/guest/driver-invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify(body),
    });
    const result = await response.json() as { success?: boolean; error?: string; data?: Invitation; redirect?: string };
    if (!response.ok || !result.success) throw new Error(result.error || 'The request could not be completed.');
    return result;
  }, []);

  const load = useCallback(async (value: string) => {
    try {
      const result = await call({ action: 'view', token: value });
      setData(result.data ?? null);
    } catch (loadError) {
      setData(null);
      setError(loadError instanceof Error ? loadError.message : 'This invitation is unavailable.');
    } finally {
      setLoading(false);
    }
  }, [call]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      const value = tokenFromHash();
      setToken(value);
      if (!value) {
        setError('This invitation link is invalid.');
        setLoading(false);
        return;
      }
      return load(value);
    });
  }, [load]);

  async function run(body: Record<string, unknown>, success: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await call({ ...body, token });
      if (result.redirect) {
        window.location.assign(result.redirect);
        return;
      }
      setNotice(success);
      await load(token);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'The request could not be completed.');
    } finally {
      setBusy(false);
    }
  }

  const accepted = data && ['accepted', 'in_progress', 'completed'].includes(data.assignment.status);

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="rounded-3xl bg-slate-900 p-6 text-white sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-300">Chama Travels</p>
          <h1 className="mt-2 text-2xl font-black">Driver trip invitation</h1>
          <p className="mt-2 text-sm text-slate-300">This private link shows one assigned trip. Keep it secure.</p>
        </header>

        {loading && <p className="rounded-2xl bg-white p-6 text-sm text-slate-600">Loading invitationÃ¢â‚¬Â¦</p>}
        {error && <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        {notice && <p role="status" className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}

        {data && (
          <>
            <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-black text-slate-950">{data.booking.booking_ref}</h2>
                <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold uppercase text-blue-800">{titleCase(data.assignment.status)}</span>
              </div>
              <p className="text-sm text-slate-700">
                {titleCase(data.booking.service_type)} Ã‚Â· {titleCase(data.booking.journey_type)} Ã‚Â· {data.booking.passenger_count} passenger(s) Ã‚Â· {data.booking.luggage_count} bag(s)
              </p>
              {data.vehicle && <p className="text-sm text-slate-700">Vehicle: {data.vehicle.name}{data.vehicle.registration_number ? ` (${data.vehicle.registration_number})` : ''}</p>}
              {data.legs.map((leg) => (
                <article key={leg.sequence_no} className="rounded-2xl bg-slate-50 p-4 text-sm">
                  <p className="font-bold">Leg {leg.sequence_no} Ã‚Â· {new Date(leg.pickup_at).toLocaleString('en-GB', { timeZone: 'Asia/Colombo', dateStyle: 'medium', timeStyle: 'short' })}</p>
                  <p><b>Pickup:</b> {leg.pickup_location}</p>
                  <p><b>Drop-off:</b> {leg.dropoff_location}</p>
                  {leg.flight_number && <p className="text-xs text-slate-600">Flight {leg.flight_number}</p>}
                </article>
              ))}
              {accepted && data.booking.customer_name && (
                <p className="text-sm text-slate-700">Customer: {data.booking.customer_name}{data.booking.customer_phone ? ` Ã‚Â· ${data.booking.customer_phone}` : ''}</p>
              )}
              {!accepted && <p className="text-xs text-slate-500">Customer contact details are shown after you accept the trip.</p>}
            </section>

            {data.assignment.status === 'offered' && (
              <section className="flex flex-wrap gap-3 rounded-3xl border border-slate-200 bg-white p-5">
                <button type="button" disabled={busy} onClick={() => void run({ action: 'accept' }, 'Trip accepted.')} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Accept trip</button>
                <button type="button" disabled={busy} onClick={() => window.confirm('Decline this trip?') && void run({ action: 'decline' }, 'Trip declined.')} className="rounded-xl bg-red-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Decline trip</button>
              </section>
            )}

            {data.hire_offer && (
              <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5">
                <h3 className="font-extrabold text-slate-900">Hire offer</h3>
                <p className="text-sm text-slate-700">{data.hire_offer.currency} {Number(data.hire_offer.amount).toFixed(2)} Ã‚Â· {titleCase(data.hire_offer.status)}</p>
                {data.hire_offer.status === 'offered' && (
                  <div className="flex flex-wrap gap-3">
                    <button type="button" disabled={busy} onClick={() => void run({ action: 'offer', offer_id: data.hire_offer?.id, accept: true }, 'Offer accepted.')} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Accept offer</button>
                    <button type="button" disabled={busy} onClick={() => void run({ action: 'offer', offer_id: data.hire_offer?.id, accept: false }, 'Offer declined.')} className="rounded-xl bg-slate-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Decline offer</button>
                  </div>
                )}
              </section>
            )}

            <section className="rounded-3xl border border-slate-200 bg-white p-5">
              <GuestDocuments token={token} audience="driver" />
            </section>

            <section className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-blue-200 bg-blue-50 p-5">
              <p className="text-sm text-blue-950">Have a driver account? Sign in, then link this invitation to move it to your dashboard. Only the invited driver account can link it.</p>
              <div className="flex gap-3">
                <Link href="/login" className="rounded-xl border border-blue-300 px-4 py-2.5 text-sm font-bold text-blue-800">Sign in</Link>
                <button type="button" disabled={busy} onClick={() => void run({ action: 'link' }, 'Linked.')} className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Link to my account</button>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
