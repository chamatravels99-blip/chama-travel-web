'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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

function statusBadgeClasses(status: string) {
  if (['pending', 'reviewing'].includes(status)) {
    return 'bg-amber-50 text-amber-800 ring-amber-600/15';
  }
  if (['confirmed', 'accepted', 'active', 'assigned', 'completed'].includes(status)) {
    return 'bg-emerald-50 text-emerald-800 ring-emerald-600/15';
  }
  if (['quoted', 'issued'].includes(status)) {
    return 'bg-blue-50 text-blue-800 ring-blue-600/15';
  }
  if (['cancelled', 'expired', 'rejected'].includes(status)) {
    return 'bg-rose-50 text-rose-800 ring-rose-600/15';
  }
  return 'bg-slate-100 text-slate-700 ring-slate-600/10';
}

export default function AdminDashboard() {
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

  return (
    <div className="bg-slate-50 font-sans text-slate-800">
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <header className="flex flex-col gap-5 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-800">
              <ShieldCheck className="h-4 w-4" /> Booking operations
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Admin Operations Console</h1>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">
                <span aria-hidden="true" className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                System Live
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">Real-time driver assignment and tourist transfers</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && <>
              <Link href="/admin/payments" className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">Payments</Link>
              <Link href="/admin/fleet" className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">Fleet</Link>
              <Link href="/admin/pricing" className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">Pricing</Link>
              <button type="button" onClick={() => setShowDriverForm((value) => !value)} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-3.5 py-2.5 text-xs font-bold text-white transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
                <UserPlus className="w-4 h-4" /> Add driver
              </button>
            </>}
            <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2.5 text-xs font-bold text-white transition hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>
        </header>

        {showDriverForm && isAdmin && (
          <form onSubmit={createDriver} className="grid grid-cols-1 gap-3 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
            <input required minLength={2} maxLength={120} placeholder="Full name" value={driverForm.full_name} onChange={(event) => setDriverForm({ ...driverForm, full_name: event.target.value })} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
            <input required type="email" placeholder="Email" value={driverForm.email} onChange={(event) => setDriverForm({ ...driverForm, email: event.target.value })} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
            <input type="tel" placeholder="Phone (optional)" value={driverForm.phone} onChange={(event) => setDriverForm({ ...driverForm, phone: event.target.value })} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
            <input required type="password" minLength={12} maxLength={128} placeholder="Temporary password (12+ chars)" value={driverForm.password} onChange={(event) => setDriverForm({ ...driverForm, password: event.target.value })} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
            <button disabled={savingDriver} className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:opacity-50">{savingDriver ? 'Creating…' : 'Create driver'}</button>
          </form>
        )}

        {(error || notice) && (
          <div role={error ? 'alert' : 'status'} className={`rounded-2xl border p-4 text-sm ${error ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-blue-200 bg-blue-50 text-blue-900'}`}>
            {error || notice}
            {acceptanceUrl && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <a className="break-all font-semibold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" href={acceptanceUrl} target="_blank" rel="noreferrer">Guest acceptance link</a>
                <button type="button" className="inline-flex items-center gap-1 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" onClick={() => void navigator.clipboard.writeText(acceptanceUrl)}>
                  <Clipboard className="h-4 w-4" /> Copy link
                </button>
              </div>
            )}
          </div>
        )}

        <section aria-label="Booking summary" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'All bookings', count: bookings.length, icon: Clipboard, color: 'bg-blue-50 text-blue-700' },
            { label: 'Needs review', count: bookings.filter((booking) => ['pending', 'reviewing'].includes(booking.booking_status)).length, icon: Activity, color: 'bg-amber-50 text-amber-700' },
            { label: 'Awaiting acceptance', count: bookings.filter((booking) => booking.booking_status === 'quoted').length, icon: Search, color: 'bg-slate-100 text-slate-700' },
            { label: 'Confirmed / dispatch', count: bookings.filter((booking) => booking.booking_status === 'confirmed').length, icon: Car, color: 'bg-emerald-50 text-emerald-700' },
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

        <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-200/80 p-5 sm:flex-row sm:items-center sm:p-6">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-slate-900">Bookings</h2>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">Driver and vehicle assignments are checked for overlapping schedules in the database.</p>
            </div>
            <label className="relative block w-full sm:max-w-sm">
              <span className="sr-only">Search bookings by reference, customer or route</span>
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search reference, customer or route" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100" />
            </label>
          </div>
          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500">Loading operations data…</div>
          ) : error ? (
          <div role="alert" className="p-10 text-center text-sm text-rose-800">{error}</div>
          ) : filteredBookings.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">No bookings found.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredBookings.map((booking) => {
                const firstLeg = booking.legs[0];
                const latestQuote = booking.quotes[0];
                const selection = assignments[booking.id] ?? { driver: '', vehicle: '' };
                return (
                  <article key={booking.id} className="min-w-0 space-y-4 p-4 sm:p-5">
                    <div className="flex min-w-0 flex-col justify-between gap-4 lg:flex-row lg:items-start">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="break-all font-black text-slate-950">{booking.booking_ref}</span>
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ring-1 ring-inset ${statusBadgeClasses(booking.booking_status)}`}>{booking.booking_status.replaceAll('_', ' ')}</span>
                          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase text-blue-800 ring-1 ring-inset ring-blue-600/15">{booking.service_type.replaceAll('_', ' ')} · {booking.journey_type.replaceAll('_', ' ')}</span>
                        </div>
                        <div className="break-words text-sm font-bold text-slate-900">{booking.customer_name} · <a href={`tel:${booking.customer_phone}`} className="text-blue-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">{booking.customer_phone}</a></div>
                        <p className="break-words text-xs leading-5 text-slate-600">{booking.customer_email} · {booking.passenger_count} passenger(s) · {booking.luggage_count} bag(s)</p>
                        {firstLeg && (
                          <div className="break-words text-sm text-slate-700">
                            <span className="font-semibold">{firstLeg.pickup_location}</span> → <span className="font-semibold">{firstLeg.dropoff_location}</span>
                            <p className="mt-1 break-words text-xs leading-5 text-slate-500">{new Date(firstLeg.pickup_at).toLocaleString()} · expected end {firstLeg.planned_end_at ? new Date(firstLeg.planned_end_at).toLocaleString() : 'not set'}</p>
                          </div>
                        )}
                        {booking.customer_notes && <p className="break-words text-xs leading-5 text-slate-600">Note: {booking.customer_notes}</p>}
                      </div>
                      <div className="flex min-w-0 flex-col items-start gap-2 lg:items-end">
                        {latestQuote && <span className="break-words text-sm font-bold text-slate-800">{latestQuote.currency} {Number(latestQuote.total).toFixed(2)} · quote #{latestQuote.revision} <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset ${statusBadgeClasses(latestQuote.quote_status)}`}>{latestQuote.quote_status}</span></span>}
                        {booking.assignment && <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusBadgeClasses(booking.assignment.assignment_status)}`}><Car className="h-4 w-4" /> {booking.assignment.assignment_status}</span>}
                        {(booking.booking_status === 'pending' || booking.booking_status === 'reviewing' || booking.booking_status === 'quoted') && (
                          <button type="button" onClick={() => void issueQuote(booking)} className="rounded-xl bg-blue-700 px-3.5 py-2.5 text-xs font-bold text-white transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
                            {booking.booking_status === 'quoted' ? 'Reissue quote' : 'Issue quote'}
                          </button>
                        )}
                      </div>
                    </div>

                    {booking.booking_status === 'confirmed' && !booking.assignment && (
                      <div className="flex min-w-0 flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row">
                        <select aria-label="Select driver" value={selection.driver} onChange={(event) => setAssignments({ ...assignments, [booking.id]: { ...selection, driver: event.target.value } })} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white p-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100">
                          <option value="">Select driver</option>
                          {drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.full_name}{driver.phone ? ` · ${driver.phone}` : ''}</option>)}
                        </select>
                        <select aria-label="Select vehicle" value={selection.vehicle} onChange={(event) => setAssignments({ ...assignments, [booking.id]: { ...selection, vehicle: event.target.value } })} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white p-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100">
                          <option value="">Select vehicle</option>
                          {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.display_name} · {vehicle.category_name}</option>)}
                        </select>
                        <button type="button" onClick={() => void assignBooking(booking)} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2">Assign</button>
                      </div>
                    )}
                    {booking.quotes.map((quote) => (
                      <div key={quote.id} className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        <span>Quote revision {quote.revision}: {quote.currency} {Number(quote.total).toFixed(2)}</span>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ring-1 ring-inset ${statusBadgeClasses(quote.quote_status)}`}>{quote.quote_status}</span>
                      </div>
                    ))}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <div className="flex items-start gap-2 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-xs leading-5 text-slate-600">
          <Activity className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
          Quotes are calculated from active server-side pricing rules. Customer acceptance confirms the booking automatically.
        </div>
      </main>
    </div>
  );
}
