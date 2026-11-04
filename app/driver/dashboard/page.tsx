'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/shared/Navbar';
import { Calendar, Car, CheckCircle, MapPin, Phone, User } from 'lucide-react';

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

function colomboDate(value: string) {
  return new Date(value).toLocaleString('en-GB', {
    timeZone: 'Asia/Colombo',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function DriverDashboard() {
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
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
      };
      if (!response.ok || !result.success || !result.data || !result.settlements) {
        throw new Error(result.error || 'Assignments could not be loaded.');
      }
      setAssignments(result.data);
      setSettlements(result.settlements);
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
            : 'Trip started.';
      setNotice(notice);
      await loadAssignments();
    } catch (actionError) {
      setNotice(actionError instanceof Error ? actionError.message : 'Assignment update failed.');
    } finally {
      setSavingId('');
    }
  }

  function changeRole(role: 'Admin' | 'Driver' | 'Customer') {
    if (role === 'Admin') router.push('/admin/dashboard');
    if (role === 'Customer') router.push('/customer/dashboard');
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans flex flex-col">
      <Navbar currentRole="Driver" onRoleChange={changeRole} />
      <main className="max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <header className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1"><Car className="w-4 h-4" /> Driver portal</div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Assigned trips</h1>
            <p className="text-sm text-slate-500 mt-1">Accept or decline dispatches, then update trip progress.</p>
          </div>
          <button onClick={() => void loadAssignments()} className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white">Refresh assignments</button>
        </header>

        {notice && <p className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900" aria-live="polite">{notice}</p>}
        {error && <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{error}</p>}

        <section className="space-y-4">
          <h2 className="text-base font-extrabold text-slate-900">Your dispatches ({assignments.length})</h2>
          {loading ? (
            <div className="text-center py-12 text-slate-400 bg-white rounded-3xl border border-slate-200">Loading assignments…</div>
          ) : assignments.length === 0 ? (
            <div className="text-center py-12 text-slate-500 bg-white rounded-3xl border border-slate-200">No assignments are available.</div>
          ) : assignments.map((assignment) => (
            <article key={assignment.id} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <span className="px-3 py-1 bg-blue-50 text-blue-700 font-bold text-xs rounded-xl">{assignment.booking.booking_ref}</span>
                  <h3 className="font-black text-slate-900 mt-2">{assignment.booking.service_type.replaceAll('_', ' ')}</h3>
                  <p className="text-xs text-slate-500 mt-1">{assignment.vehicle.display_name} · {assignment.vehicle.category_name} · {assignment.assignment_status.replaceAll('_', ' ')}</p>
                </div>
                <span className="text-xs font-bold text-slate-500">{assignment.booking.passenger_count} passenger(s) · {assignment.booking.luggage_count} bag(s)</span>
              </div>

              {assignment.legs.map((leg) => (
                <div key={`${assignment.id}-${leg.sequence_no}`} className="rounded-2xl bg-slate-50 p-4 space-y-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Leg {leg.sequence_no} · {leg.trip_status.replaceAll('_', ' ')}</span>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex items-start gap-2 text-sm"><MapPin className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" /><span><b>Pickup:</b> {leg.pickup_location}</span></div>
                    <div className="flex items-start gap-2 text-sm"><MapPin className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" /><span><b>Drop-off:</b> {leg.dropoff_location}</span></div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{colomboDate(leg.pickup_at)}</span>
                    {leg.flight_number && <span>Flight {leg.flight_number}</span>}
                    {leg.trip_notes && <span>Trip note: {leg.trip_notes}</span>}
                  </div>
                </div>
              ))}

              <div className="rounded-2xl border border-slate-100 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-slate-700"><User className="h-4 w-4 text-slate-400" />{assignment.booking.customer_name}</div>
                <div className="flex items-center gap-2 text-sm text-slate-700"><Phone className="h-4 w-4 text-slate-400" /><a href={`tel:${assignment.booking.customer_phone}`} className="font-bold text-blue-700">{assignment.booking.customer_phone}</a></div>
              </div>

              <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
                {assignment.assignment_status === 'offered' && <>
                  <button disabled={savingId === assignment.id} onClick={() => void updateAssignment(assignment.id, 'decline')} className="rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 disabled:opacity-50">Decline</button>
                  <button disabled={savingId === assignment.id} onClick={() => void updateAssignment(assignment.id, 'accept')} className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">Accept assignment</button>
                </>}
                {assignment.assignment_status === 'accepted' && (
                  <button disabled={savingId === assignment.id} onClick={() => void updateAssignment(assignment.id, 'start')} className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">Start trip</button>
                )}
                {assignment.assignment_status === 'in_progress' && (
                  <button disabled={savingId === assignment.id} onClick={() => void updateAssignment(assignment.id, 'complete')} className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"><CheckCircle className="h-4 w-4" />Complete trip</button>
                )}
                {assignment.assignment_status === 'completed' && <span className="text-xs font-bold text-emerald-700">Trip completed</span>}
              </div>
            </article>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-base font-extrabold text-slate-900">Earnings and settlements</h2>
          {loading ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading settlement history…</div>
          ) : settlements.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500">No settlements have been recorded.</div>
          ) : settlements.map((settlement) => (
            <article key={settlement.id} className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-5">
              <div>
                <b>{settlement.booking_ref}</b>
                <p className="mt-1 text-xs text-slate-500">
                  {settlement.settlement_status === 'paid' && settlement.payout_method
                    ? `${settlement.payout_method.replaceAll('_', ' ')} payout · ${settlement.payout_reference || 'no reference'}`
                    : 'Pending payout'}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold">{settlement.currency} {Number(settlement.amount).toFixed(2)}</p>
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
