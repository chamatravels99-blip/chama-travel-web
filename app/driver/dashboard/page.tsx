'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/shared/Navbar';
import { Calendar, Car, CheckCircle, Clock, MapPin, Phone, User, Wallet } from 'lucide-react';

type Assignment = {
  id: string;
  assignment_status: string;
  booking: {
    id: string;
    booking_ref: string;
    service_type: string;
    booking_status: string;
    customer_name: string;
    customer_phone: string;
    passenger_count: number;
    luggage_count: number;
  };
  vehicle: { display_name: string; category_name: string };
  legs: {
    sequence_no: number;
    pickup_location: string;
    dropoff_location: string;
    pickup_at: string;
    planned_end_at: string | null;
    flight_number: string | null;
    trip_notes: string | null;
    trip_status: string;
  }[];
};

type Settlement = {
  id: string;
  booking_ref: string;
  currency: string;
  amount: number;
  settlement_status: 'pending' | 'paid';
  payout_method: string | null;
  payout_reference: string | null;
  created_at: string;
  paid_at: string | null;
};
type DriverHireOffer = {
  id: string;
  assignment_id: string;
  booking_ref: string;
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
  amount: number;
  currency: string;
  payment_date: string;
  payment_method: string;
  payment_reference: string | null;
  recorded_at: string;
};

function colomboDate(value: string) {
  return new Date(value).toLocaleString('en-GB', {
    timeZone: 'Asia/Colombo',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function statusBadgeClasses(status: string) {
  if (['offered', 'pending'].includes(status)) {
    return 'bg-amber-50 text-amber-800 ring-amber-600/15';
  }
  if (['in_progress', 'accepted'].includes(status)) {
    return 'bg-blue-50 text-blue-800 ring-blue-600/15';
  }
  if (['completed', 'paid', 'active'].includes(status)) {
    return 'bg-emerald-50 text-emerald-800 ring-emerald-600/15';
  }
  if (['declined', 'cancelled', 'expired'].includes(status)) {
    return 'bg-rose-50 text-rose-800 ring-rose-600/15';
  }
  return 'bg-slate-100 text-slate-700 ring-slate-600/10';
}

export default function DriverDashboard() {
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [hireOffers, setHireOffers] = useState<DriverHireOffer[]>([]);
  const [hirePayouts, setHirePayouts] = useState<DriverHirePayout[]>([]);
  const [onTheWay, setOnTheWay] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [savingId, setSavingId] = useState('');

  const loadAssignments = useCallback(async () => {
    try {
      const response = await fetch('/api/driver/assignments', { cache: 'no-store' });
      const result = await response.json() as {
        success?: boolean;
        error?: string;
        data?: Assignment[];
        settlements?: Settlement[];
        on_the_way?: string[];
        compensation?: { offers: DriverHireOffer[]; payouts: DriverHirePayout[] };
      };
      if (!response.ok || !result.success || !result.data || !result.settlements || !result.on_the_way ||
          !result.compensation || !result.compensation.offers || !result.compensation.payouts) {
        throw new Error(result.error || 'Assignments could not be loaded.');
      }
      setAssignments(result.data);
      setSettlements(result.settlements);
      setOnTheWay(result.on_the_way);
      setHireOffers(result.compensation.offers);
      setHirePayouts(result.compensation.payouts);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Assignments could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(loadAssignments); }, [loadAssignments]);

  async function updateAssignment(assignmentId: string, action: string) {
    setSavingId(assignmentId);
    setNotice('');
    try {
      const response = await fetch('/api/driver/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignment_id: assignmentId, action }),
      });
      const result = await response.json() as { success?: boolean; error?: string };
      if (!response.ok || !result.success) throw new Error(result.error || 'Assignment update failed.');
      const notice = action === 'complete'
        ? 'Trip completed.'
        : action === 'decline'
          ? 'Assignment declined.'
          : action === 'accept'
            ? 'Assignment accepted.'
            : action === 'on_the_way' ? 'On the way recorded.' : 'Trip started.';
      setNotice(notice);
      await loadAssignments();
    } catch (actionError) {
      setNotice(actionError instanceof Error ? actionError.message : 'Assignment update failed.');
    } finally {
      setSavingId('');
    }
  }

  async function respondHireOffer(offer: DriverHireOffer, accept: boolean) {
    setSavingId(offer.id);
    setNotice('');
    try {
      const response = await fetch('/api/driver/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'respond_hire_offer', offer_id: offer.id, accept }),
      });
      const result = await response.json() as { success?: boolean; error?: string };
      if (!response.ok || !result.success) throw new Error(result.error || 'Hire offer response failed.');
      setNotice(accept ? 'Driver hire amount accepted.' : 'Driver hire offer declined.');
      await loadAssignments();
    } catch (actionError) {
      setNotice(actionError instanceof Error ? actionError.message : 'Hire offer response failed.');
    } finally {
      setSavingId('');
    }
  }

  function changeRole(role: 'Admin' | 'Driver' | 'Customer') {
    if (role === 'Admin') router.push('/admin/dashboard');
    if (role === 'Customer') router.push('/customer/dashboard');
  }

  const currentTrips = assignments.filter((assignment) => assignment.assignment_status === 'in_progress').length;
  const upcomingTrips = assignments.filter((assignment) =>
    ['offered', 'accepted'].includes(assignment.assignment_status)
  ).length;
  const pendingSettlements = settlements.filter((settlement) => settlement.settlement_status === 'pending').length;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 font-sans text-slate-800">
      <Navbar currentRole="Driver" onRoleChange={changeRole} />
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <header className="flex flex-col justify-between gap-5 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7 md:flex-row md:items-center">
          <div className="min-w-0">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-800"><Car className="h-4 w-4" /> Driver portal</div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Welcome to your driver dashboard</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">Your current and upcoming transfers, trip progress, agreed hire amounts and payout history.</p>
          </div>
          <button type="button" onClick={() => void loadAssignments()} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"><Clock className="h-4 w-4" /> Refresh assignments</button>
        </header>

        {!loading && !error && (
          <section aria-label="Driver overview" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Assigned jobs', count: assignments.length, icon: Car, color: 'bg-blue-50 text-blue-700' },
              { label: 'Current trips', count: currentTrips, icon: MapPin, color: 'bg-emerald-50 text-emerald-700' },
              { label: 'Upcoming jobs', count: upcomingTrips, icon: Calendar, color: 'bg-amber-50 text-amber-700' },
              { label: 'Pending settlements', count: pendingSettlements, icon: Wallet, color: 'bg-slate-100 text-slate-700' },
            ].map(({ label, count, icon: Icon, color }) => (
              <div key={label} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color}`}><Icon className="h-5 w-5" /></span>
                </div>
                <p className="mt-3 text-3xl font-black tracking-tight text-slate-950">{count}</p>
              </div>
            ))}
          </section>
        )}

        {notice && <p className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900" aria-live="polite">{notice}</p>}
        {error && <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900" role="alert">{error}</p>}

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight text-slate-900">Current and upcoming jobs</h2>
            <p className="mt-1 text-xs text-slate-500">Review your assignment details and update each trip as it progresses.</p>
          </div>
          {loading ? (
            <div className="rounded-3xl border border-slate-200/80 bg-white px-5 py-12 text-center text-sm text-slate-500 shadow-sm">Loading assignments…</div>
          ) : assignments.length === 0 ? (
            <div className="rounded-3xl border border-slate-200/80 bg-white px-5 py-12 text-center text-sm text-slate-600 shadow-sm">No assignments are available right now.</div>
          ) : assignments.map((assignment) => (
            <article key={assignment.id} className={`min-w-0 space-y-4 rounded-3xl border bg-white p-4 shadow-sm sm:p-6 ${assignment.assignment_status === 'in_progress' ? 'border-emerald-300 ring-1 ring-emerald-100' : 'border-slate-200/80'}`}>
              <div className="flex min-w-0 flex-col justify-between gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="break-all rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800 ring-1 ring-inset ring-blue-600/15">{assignment.booking.booking_ref}</span>
                    {assignment.assignment_status === 'in_progress' && <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-extrabold uppercase text-emerald-800 ring-1 ring-inset ring-emerald-600/15">Current trip</span>}
                    <span className={`rounded-full px-3 py-1 text-[10px] font-extrabold uppercase ring-1 ring-inset ${statusBadgeClasses(assignment.assignment_status)}`}>{assignment.assignment_status.replaceAll('_', ' ')}</span>
                  </div>
                  <h3 className="mt-2 break-words text-base font-black text-slate-950">{assignment.booking.service_type.replaceAll('_', ' ')}</h3>
                  <p className="mt-1 break-words text-xs text-slate-600">{assignment.vehicle.display_name} · {assignment.vehicle.category_name}</p>
                </div>
                <span className="text-xs font-semibold text-slate-600">{assignment.booking.passenger_count} passenger(s) · {assignment.booking.luggage_count} bag(s)</span>
              </div>

              {assignment.legs.map((leg) => (
                <div key={`${assignment.id}-${leg.sequence_no}`} className="min-w-0 space-y-3 rounded-2xl border border-slate-200/70 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase text-slate-500">
                    <span>Leg {leg.sequence_no}</span>
                    <span className={`rounded-full px-2 py-1 ring-1 ring-inset ${statusBadgeClasses(leg.trip_status)}`}>{leg.trip_status.replaceAll('_', ' ')}</span>
                  </div>
                  <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                    <div className="flex min-w-0 items-start gap-2 text-sm"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" /><span className="break-words"><b>Pickup:</b> {leg.pickup_location}</span></div>
                    <div className="flex min-w-0 items-start gap-2 text-sm"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" /><span className="break-words"><b>Drop-off:</b> {leg.dropoff_location}</span></div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{colomboDate(leg.pickup_at)}</span>
                    {leg.planned_end_at && <span>Expected end {colomboDate(leg.planned_end_at)}</span>}
                    {leg.flight_number && <span className="break-words">Flight {leg.flight_number}</span>}
                    {leg.trip_notes && <span className="break-words">Trip note: {leg.trip_notes}</span>}
                  </div>
                </div>
              ))}

              <div className="space-y-2 rounded-2xl border border-slate-200/80 bg-white p-4">
                <div className="flex items-center gap-2 text-sm text-slate-700"><User className="h-4 w-4 text-slate-400" />{assignment.booking.customer_name}</div>
                <div className="flex min-w-0 items-center gap-2 text-sm text-slate-700"><Phone className="h-4 w-4 shrink-0 text-slate-400" /><a href={`tel:${assignment.booking.customer_phone}`} className="break-all font-bold text-blue-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">{assignment.booking.customer_phone}</a></div>
              </div>

              <div className="flex flex-wrap justify-start gap-2 border-t border-slate-100 pt-4 sm:justify-end">
                {assignment.assignment_status === 'offered' && <>
                  <button type="button" disabled={savingId === assignment.id} onClick={() => void updateAssignment(assignment.id, 'decline')} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50">Decline</button>
                  <button type="button" disabled={savingId === assignment.id} onClick={() => void updateAssignment(assignment.id, 'accept')} className="rounded-xl bg-blue-700 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-50">Accept assignment</button>
                </>}
                {assignment.assignment_status === 'accepted' && !onTheWay.includes(assignment.id) && (
                  <button type="button" disabled={savingId === assignment.id} onClick={() => void updateAssignment(assignment.id, 'on_the_way')} className="rounded-xl border border-blue-700 px-4 py-2.5 text-xs font-bold text-blue-700 disabled:opacity-50">On the way</button>
                )}
                {assignment.assignment_status === 'accepted' && onTheWay.includes(assignment.id) && <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-800">On the way</span>}
                {assignment.assignment_status === 'accepted' && (
                  <button type="button" disabled={savingId === assignment.id} onClick={() => void updateAssignment(assignment.id, 'start')} className="rounded-xl bg-blue-700 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-50">Start trip</button>
                )}
                {assignment.assignment_status === 'in_progress' && (
                  <button type="button" disabled={savingId === assignment.id} onClick={() => void updateAssignment(assignment.id, 'complete')} className="inline-flex items-center gap-1 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:opacity-50"><CheckCircle className="h-4 w-4" />Complete trip</button>
                )}
                {assignment.assignment_status === 'completed' && <span className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 ring-inset ${statusBadgeClasses('completed')}`}>Trip completed</span>}
              </div>
            </article>
          ))}
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight text-slate-900">Agreed hire and payout history</h2>
            <p className="mt-1 text-xs text-slate-500">Review and respond to current hire offers. Revised offers require a new response; each partial payout is listed separately.</p>
          </div>
          {loading ? (
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 text-sm text-slate-500 shadow-sm">Loading hire offers…</div>
          ) : hireOffers.length === 0 ? (
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 text-sm text-slate-600 shadow-sm">No driver hire offers have been issued.</div>
          ) : hireOffers.map((offer) => (
            <article key={offer.id} className="space-y-3 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <b className="break-all text-slate-900">{offer.booking_ref}</b>
                  <p className="mt-1 text-xs text-slate-500">
                    Revision {offer.revision}{offer.is_current ? ' · current offer' : ' · prior offer'}
                    {offer.responded_at && ` · answered ${colomboDate(offer.responded_at)}`}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ring-1 ring-inset ${statusBadgeClasses(offer.offer_status)}`}>{offer.offer_status}</span>
                  <p className="mt-2 font-bold text-slate-900">{offer.currency} {Number(offer.amount).toFixed(2)}</p>
                </div>
              </div>
              {offer.is_current && offer.offer_status === 'offered' && (
                <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    disabled={savingId === offer.id}
                    onClick={() => void respondHireOffer(offer, false)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 disabled:opacity-50"
                  >
                    Decline amount
                  </button>
                  <button
                    type="button"
                    disabled={savingId === offer.id}
                    onClick={() => void respondHireOffer(offer, true)}
                    className="rounded-xl bg-blue-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                  >
                    Accept amount
                  </button>
                </div>
              )}
              {offer.is_current && offer.offer_status === 'accepted' && (
                <p className="border-t border-slate-100 pt-3 text-xs text-slate-600">
                  {offer.currency} {Number(offer.paid_total).toFixed(2)} paid ·
                  {' '}{offer.currency} {Number(offer.outstanding ?? 0).toFixed(2)} outstanding
                </p>
              )}
            </article>
          ))}
          {hirePayouts.length > 0 && (
            <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
              <h3 className="border-b border-slate-100 p-4 text-sm font-extrabold text-slate-900">Partial payout history</h3>
              {hirePayouts.map((payout) => (
                <article key={payout.id} className="flex flex-wrap justify-between gap-2 border-b border-slate-100 p-4 text-sm">
                  <div>
                    <b>{payout.booking_ref}</b>
                    <p className="text-xs text-slate-500">
                      {colomboDate(`${payout.payment_date}T12:00:00+05:30`)} · {payout.payment_method.replaceAll('_', ' ')}
                      {payout.payment_reference && ` · ${payout.payment_reference}`}
                    </p>
                  </div>
                  <span className="font-bold text-slate-900">{payout.currency} {Number(payout.amount).toFixed(2)}</span>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight text-slate-900">Legacy one-time settlements</h2>
            <p className="mt-1 text-xs text-slate-500">Historical settlement records created before the hire-offer and partial-payout ledger.</p>
          </div>
          {loading ? (
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 text-sm text-slate-500 shadow-sm">Loading settlement history…</div>
          ) : settlements.length === 0 ? (
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 text-sm text-slate-600 shadow-sm">No settlements have been recorded.</div>
          ) : settlements.map((settlement) => (
            <article key={settlement.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
              <div>
                <b className="break-all text-slate-900">{settlement.booking_ref}</b>
                <p className="mt-2 text-xs text-slate-600">
                  {settlement.settlement_status === 'paid' && settlement.payout_method
                    ? `${settlement.payout_method.replaceAll('_', ' ')} payout · ${settlement.payout_reference || 'no reference'}`
                    : 'Pending payout'}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ring-1 ring-inset ${statusBadgeClasses(settlement.settlement_status)}`}>{settlement.settlement_status}</span>
                <p className="mt-2 font-bold text-slate-900">{settlement.currency} {Number(settlement.amount).toFixed(2)}</p>
                <p className="text-xs text-slate-500">
                  {settlement.paid_at ? `Paid ${colomboDate(settlement.paid_at)}` : `Created ${colomboDate(settlement.created_at)}`}
                </p>
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
