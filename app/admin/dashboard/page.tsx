'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/shared/Navbar';
import { Activity, Car, Clipboard, RefreshCw, Search, ShieldCheck, UserPlus } from 'lucide-react';

type Leg = {
  sequence_no: number;
  pickup_location: string;
  dropoff_location: string;
  pickup_at: string;
  planned_end_at: string | null;
  trip_status: string;
};

type Quote = {
  id: string;
  revision: number;
  currency: string;
  total: number;
  quote_status: string;
  expires_at: string;
};

type Booking = {
  id: string;
  booking_ref: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  service_type: string;
  journey_type: string;
  booking_status: string;
  currency: string;
  passenger_count: number;
  luggage_count: number;
  customer_notes: string | null;
  created_at: string;
  legs: Leg[];
  assignment: {
    id: string;
    driver_user_id: string;
    vehicle_id: string;
    assignment_status: string;
  } | null;
  quotes: Quote[];
};

type Driver = { id: string; full_name: string; phone: string | null };
type Vehicle = { id: string; display_name: string; category_name: string };
type ApiResult = { success?: boolean; error?: string; data?: Record<string, unknown> };

function quoteExpiryAfter48Hours() {
  return new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
}

export default function AdminDashboard() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [assignments, setAssignments] = useState<Record<string, { driver: string; vehicle: string }>>({});
  const [acceptanceUrl, setAcceptanceUrl] = useState('');
  const [showDriverForm, setShowDriverForm] = useState(false);
  const [driverForm, setDriverForm] = useState({ full_name: '', email: '', phone: '', password: '' });
  const [savingDriver, setSavingDriver] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/operations/bookings', { cache: 'no-store' });
      const result = await response.json() as ApiResult & {
        data?: { bookings: Booking[]; resources: { drivers: Driver[]; vehicles: Vehicle[] } };
        roles?: string[];
      };
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || 'Operations data could not be loaded.');
      }
      setBookings(result.data.bookings);
      setDrivers(result.data.resources.drivers);
      setVehicles(result.data.resources.vehicles);
      setRoles(result.roles ?? []);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Operations data could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const isAdmin = roles.includes('admin') || roles.includes('super_admin');
  const filteredBookings = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return bookings;
    return bookings.filter((booking) =>
      [
        booking.booking_ref,
        booking.customer_name,
        booking.customer_phone,
        ...booking.legs.flatMap((leg) => [leg.pickup_location, leg.dropoff_location]),
      ].some((value) => value.toLowerCase().includes(search))
    );
  }, [bookings, query]);

  async function postOperation(body: Record<string, unknown>) {
    const response = await fetch('/api/operations/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = await response.json() as ApiResult;
    if (!response.ok || !result.success) throw new Error(result.error || 'The operation failed.');
    return result;
  }

  async function issueQuote(booking: Booking) {
    setNotice('');
    setAcceptanceUrl('');
    try {
      const result = await postOperation({
        action: 'issue_quote',
        booking_id: booking.id,
        currency: booking.currency,
        expires_at: quoteExpiryAfter48Hours(),
      });
      const url = typeof result.data?.acceptance_url === 'string' ? result.data.acceptance_url : '';
      setAcceptanceUrl(url);
      setNotice(url
        ? 'Quote issued. This guest acceptance link is a one-time credential; share it with the guest privately.'
        : 'Quote issued. The customer can review and accept it in their dashboard.');
      await load();
    } catch (operationError) {
      setNotice(operationError instanceof Error ? operationError.message : 'The quote could not be issued.');
    }
  }

  async function assignBooking(booking: Booking) {
    const selection = assignments[booking.id];
    if (!selection?.driver || !selection.vehicle) {
      setNotice('Choose both a driver and vehicle.');
      return;
    }
    setNotice('');
    try {
      await postOperation({
        action: 'assign',
        booking_id: booking.id,
        driver_user_id: selection.driver,
        vehicle_id: selection.vehicle,
      });
      setNotice('Driver and vehicle assigned.');
      await load();
    } catch (operationError) {
      setNotice(operationError instanceof Error ? operationError.message : 'Assignment failed.');
    }
  }

  async function createDriver(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingDriver(true);
    setNotice('');
    try {
      const response = await fetch('/api/admin/create-driver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(driverForm),
      });
      const result = await response.json() as ApiResult;
      if (!response.ok || !result.success) throw new Error(result.error || 'Driver account creation failed.');
      setDriverForm({ full_name: '', email: '', phone: '', password: '' });
      setShowDriverForm(false);
      setNotice('Driver account created.');
      await load();
    } catch (operationError) {
      setNotice(operationError instanceof Error ? operationError.message : 'Driver account creation failed.');
    } finally {
      setSavingDriver(false);
    }
  }

  function changeRole(role: 'Admin' | 'Driver' | 'Customer') {
    if (role === 'Driver') router.push('/driver/dashboard');
    if (role === 'Customer') router.push('/customer/dashboard');
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans">
      <Navbar currentRole="Admin" onRoleChange={changeRole} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <header className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-widest">
              <ShieldCheck className="w-4 h-4" /> Booking operations
            </div>
            <h1 className="text-2xl font-black text-slate-900 mt-1">Operations Dashboard</h1>
            <p className="text-sm text-slate-500 mt-1">Review requests, issue server-calculated quotes and dispatch confirmed bookings.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isAdmin && <>
              <Link href="/admin/payments" className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold hover:bg-slate-200">Payments</Link>
              <Link href="/admin/fleet" className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold hover:bg-slate-200">Fleet</Link>
              <Link href="/admin/pricing" className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold hover:bg-slate-200">Pricing</Link>
              <button onClick={() => setShowDriverForm((value) => !value)} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700">
                <UserPlus className="w-4 h-4" /> Add driver
              </button>
            </>}
            <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>
        </header>

        {showDriverForm && isAdmin && (
          <form onSubmit={createDriver} className="bg-white rounded-2xl border border-slate-200 p-5 grid grid-cols-1 md:grid-cols-5 gap-3">
            <input required minLength={2} maxLength={120} placeholder="Full name" value={driverForm.full_name} onChange={(event) => setDriverForm({ ...driverForm, full_name: event.target.value })} className="rounded-xl border border-slate-200 p-3 text-sm" />
            <input required type="email" placeholder="Email" value={driverForm.email} onChange={(event) => setDriverForm({ ...driverForm, email: event.target.value })} className="rounded-xl border border-slate-200 p-3 text-sm" />
            <input type="tel" placeholder="Phone (optional)" value={driverForm.phone} onChange={(event) => setDriverForm({ ...driverForm, phone: event.target.value })} className="rounded-xl border border-slate-200 p-3 text-sm" />
            <input required type="password" minLength={12} maxLength={128} placeholder="Temporary password (12+ chars)" value={driverForm.password} onChange={(event) => setDriverForm({ ...driverForm, password: event.target.value })} className="rounded-xl border border-slate-200 p-3 text-sm" />
            <button disabled={savingDriver} className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{savingDriver ? 'Creating…' : 'Create driver'}</button>
          </form>
        )}

        {(error || notice) && (
          <div className={`rounded-2xl border p-4 text-sm ${error ? 'border-red-200 bg-red-50 text-red-800' : 'border-blue-200 bg-blue-50 text-blue-900'}`}>
            {error || notice}
            {acceptanceUrl && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <a className="break-all font-semibold underline" href={acceptanceUrl} target="_blank" rel="noreferrer">Guest acceptance link</a>
                <button className="inline-flex items-center gap-1 font-bold" onClick={() => void navigator.clipboard.writeText(acceptanceUrl)}>
                  <Clipboard className="h-4 w-4" /> Copy link
                </button>
              </div>
            )}
          </div>
        )}

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ['All bookings', bookings.length],
            ['Needs review', bookings.filter((booking) => ['pending', 'reviewing'].includes(booking.booking_status)).length],
            ['Awaiting acceptance', bookings.filter((booking) => booking.booking_status === 'quoted').length],
            ['Confirmed / dispatch', bookings.filter((booking) => booking.booking_status === 'confirmed').length],
          ].map(([label, count]) => (
            <div key={label} className="bg-white rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-bold uppercase text-slate-400">{label}</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{count}</p>
            </div>
          ))}
        </section>

        <section className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-extrabold text-slate-900">Bookings</h2>
              <p className="text-xs text-slate-500 mt-1">Driver and vehicle assignments are checked for overlapping schedules in the database.</p>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search reference, customer or route" className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2.5 text-sm" />
            </div>
          </div>
          {loading ? (
            <div className="p-10 text-center text-slate-500">Loading operations data…</div>
          ) : error ? (
            <div className="p-10 text-center text-red-700">{error}</div>
          ) : filteredBookings.length === 0 ? (
            <div className="p-10 text-center text-slate-500">No bookings found.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredBookings.map((booking) => {
                const firstLeg = booking.legs[0];
                const latestQuote = booking.quotes[0];
                const selection = assignments[booking.id] ?? { driver: '', vehicle: '' };
                return (
                  <article key={booking.id} className="p-5 space-y-4">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-black text-slate-900">{booking.booking_ref}</span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase">{booking.booking_status.replaceAll('_', ' ')}</span>
                          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase text-blue-700">{booking.service_type.replaceAll('_', ' ')} · {booking.journey_type.replaceAll('_', ' ')}</span>
                        </div>
                        <div className="text-sm font-bold">{booking.customer_name} · <a href={`tel:${booking.customer_phone}`} className="text-blue-700">{booking.customer_phone}</a></div>
                        <p className="text-xs text-slate-500">{booking.customer_email} · {booking.passenger_count} passenger(s) · {booking.luggage_count} bag(s)</p>
                        {firstLeg && (
                          <div className="text-sm text-slate-700">
                            <span className="font-semibold">{firstLeg.pickup_location}</span> → <span className="font-semibold">{firstLeg.dropoff_location}</span>
                            <p className="text-xs text-slate-500">{new Date(firstLeg.pickup_at).toLocaleString()} · expected end {firstLeg.planned_end_at ? new Date(firstLeg.planned_end_at).toLocaleString() : 'not set'}</p>
                          </div>
                        )}
                        {booking.customer_notes && <p className="text-xs text-slate-500">Note: {booking.customer_notes}</p>}
                      </div>
                      <div className="flex flex-col items-start lg:items-end gap-2">
                        {latestQuote && <span className="text-sm font-bold">{latestQuote.currency} {Number(latestQuote.total).toFixed(2)} · quote #{latestQuote.revision} ({latestQuote.quote_status})</span>}
                        {booking.assignment && <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><Car className="h-4 w-4" /> {booking.assignment.assignment_status}</span>}
                        {(booking.booking_status === 'pending' || booking.booking_status === 'reviewing' || booking.booking_status === 'quoted') && (
                          <button onClick={() => void issueQuote(booking)} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700">
                            {booking.booking_status === 'quoted' ? 'Reissue quote' : 'Issue quote'}
                          </button>
                        )}
                      </div>
                    </div>

                    {booking.booking_status === 'confirmed' && !booking.assignment && (
                      <div className="flex flex-col sm:flex-row gap-2 border-t border-slate-100 pt-3">
                        <select aria-label="Select driver" value={selection.driver} onChange={(event) => setAssignments({ ...assignments, [booking.id]: { ...selection, driver: event.target.value } })} className="flex-1 rounded-xl border border-slate-200 p-2.5 text-sm">
                          <option value="">Select driver</option>
                          {drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.full_name}{driver.phone ? ` · ${driver.phone}` : ''}</option>)}
                        </select>
                        <select aria-label="Select vehicle" value={selection.vehicle} onChange={(event) => setAssignments({ ...assignments, [booking.id]: { ...selection, vehicle: event.target.value } })} className="flex-1 rounded-xl border border-slate-200 p-2.5 text-sm">
                          <option value="">Select vehicle</option>
                          {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.display_name} · {vehicle.category_name}</option>)}
                        </select>
                        <button onClick={() => void assignBooking(booking)} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700">Assign</button>
                      </div>
                    )}
                    {booking.quotes.map((quote) => (
                      <div key={quote.id} className="text-xs text-slate-500">
                        Quote revision {quote.revision}: {quote.currency} {Number(quote.total).toFixed(2)} · {quote.quote_status}
                      </div>
                    ))}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Activity className="h-4 w-4" />
          Quotes are calculated from active server-side pricing rules. Customer acceptance confirms the booking automatically.
        </div>
      </main>
    </div>
  );
}
