'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import BookingOperations from './BookingOperations';
import BookingActivity from './BookingActivity';
import BookingBillingPanel from './BookingBillingPanel';
import { whatsAppLink } from '@/lib/whatsapp';
import { getGuestQuoteLinkState } from '@/lib/guest-quote-link';
import {
  Calendar,
  Car,
  CheckCircle,
  ChevronDown,
  Clipboard,
  MapPin,
  RefreshCw,
  Search,
  User,
} from 'lucide-react';

type BookingLeg = {
  sequence_no: number;
  pickup_location: string;
  dropoff_location: string;
  pickup_at: string;
  planned_end_at: string | null;
  trip_status: string;
};

type BookingQuote = {
  id: string;
  revision: number;
  currency: string;
  total: number;
  quote_status: string;
  expires_at: string;
  has_guest_acceptance_link: boolean;
  token_expires_at: string | null;
  token_consumed_at: string | null;
  token_revoked_at: string | null;
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
  legs: BookingLeg[];
  assignment: {
    id: string;
    driver_user_id: string;
    vehicle_id: string;
    assignment_status: string;
  } | null;
  quotes: BookingQuote[];
};

type Driver = { id: string; full_name: string; phone: string | null };
type Vehicle = { id: string; display_name: string; category_name: string };
type GuestTrackerState = {
  booking_id: string;
  expires_at: string | null;
  revoked_at: string | null;
  active: boolean;
};
type OperationsResponse = {
  success?: boolean;
  error?: string;
  data?: {
    bookings: Booking[];
    resources: { drivers: Driver[]; vehicles: Vehicle[] };
    guest_tracker_states?: GuestTrackerState[];
  };
  roles?: string[];
};
type OperationResponse = { success?: boolean; error?: string; data?: { acceptance_url?: string | null } };

const PAGE_SIZE = 10;

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-GB', {
    timeZone: 'Asia/Colombo',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function colomboDateKey(value: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function bookingNoteField(notes: string | null, label: string) {
  const prefix = `${label}:`;
  const line = notes?.split('\n').find((item) => item.startsWith(prefix));
  return line?.slice(prefix.length).trim() || null;
}

function statusBadgeClasses(status: string) {
  if (['pending', 'reviewing', 'offered'].includes(status)) {
    return 'bg-amber-50 text-amber-800 ring-amber-600/15';
  }
  if (['confirmed', 'accepted', 'active', 'assigned', 'completed'].includes(status)) {
    return 'bg-emerald-50 text-emerald-800 ring-emerald-600/15';
  }
  if (['quoted', 'sent', 'issued', 'in_progress'].includes(status)) {
    return 'bg-blue-50 text-blue-800 ring-blue-600/15';
  }
  if (['cancelled', 'expired', 'rejected', 'declined'].includes(status)) {
    return 'bg-rose-50 text-rose-800 ring-rose-600/15';
  }
  return 'bg-slate-100 text-slate-700 ring-slate-600/10';
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [guestTrackerStates, setGuestTrackerStates] = useState<GuestTrackerState[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [journeyFilter, setJourneyFilter] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [expandedBookingId, setExpandedBookingId] = useState('');
  const [assignments, setAssignments] = useState<Record<string, { driver: string; vehicle: string }>>({});
  const [savingAction, setSavingAction] = useState('');
  const [acceptanceLink, setAcceptanceLink] = useState<{ bookingId: string; url: string } | null>(null);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/operations/bookings', { cache: 'no-store' });
      const result = await response.json() as OperationsResponse;
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || 'Bookings could not be loaded.');
      }
      setBookings(result.data.bookings);
      setDrivers(result.data.resources.drivers);
      setVehicles(result.data.resources.vehicles);
      setGuestTrackerStates(result.data.guest_tracker_states ?? []);
      setRoles(result.roles ?? []);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Bookings could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(loadBookings); }, [loadBookings]);

  const serviceTypes = useMemo(
    () => [...new Set(bookings.map((booking) => booking.service_type))].sort(),
    [bookings]
  );
  const journeyTypes = useMemo(
    () => [...new Set(bookings.map((booking) => booking.journey_type))].sort(),
    [bookings]
  );
  const bookingStatuses = useMemo(
    () => [...new Set(bookings.map((booking) => booking.booking_status))].sort(),
    [bookings]
  );

  const filteredBookings = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return bookings.filter((booking) => {
      const matchesSearch = !needle || [
        booking.booking_ref,
        booking.customer_name,
        booking.customer_email,
        booking.customer_phone,
        ...booking.legs.flatMap((leg) => [leg.pickup_location, leg.dropoff_location]),
      ].some((value) => value.toLowerCase().includes(needle));
      const matchesDates = (!dateFrom && !dateTo) || booking.legs.some((leg) => {
        const pickupDate = colomboDateKey(leg.pickup_at);
        return (!dateFrom || pickupDate >= dateFrom) && (!dateTo || pickupDate <= dateTo);
      });
      return matchesSearch &&
        (!statusFilter || booking.booking_status === statusFilter) &&
        (!serviceFilter || booking.service_type === serviceFilter) &&
        (!journeyFilter || booking.journey_type === journeyFilter) &&
        (!driverFilter || booking.assignment?.driver_user_id === driverFilter) &&
        (!vehicleFilter || booking.assignment?.vehicle_id === vehicleFilter) &&
        matchesDates;
    });
  }, [bookings, dateFrom, dateTo, driverFilter, journeyFilter, search, serviceFilter, statusFilter, vehicleFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredBookings.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleBookings = filteredBookings.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const canOperate = roles.some((role) => ['admin', 'super_admin', 'operator'].includes(role));

  async function postOperation(body: Record<string, unknown>) {
    const response = await fetch('/api/operations/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = await response.json() as OperationResponse;
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'The booking operation could not be completed.');
    }
    return result;
  }

  async function assignBooking(booking: Booking) {
    const selection = assignments[booking.id];
    if (!selection?.driver || !selection.vehicle) {
      setNotice('Choose both a driver and vehicle.');
      return;
    }
    setSavingAction(booking.id);
    setNotice('');
    setError('');
    try {
      await postOperation({
        action: 'assign',
        booking_id: booking.id,
        driver_user_id: selection.driver,
        vehicle_id: selection.vehicle,
      });
      setNotice('Driver and vehicle assigned.');
      await loadBookings();
    } catch (operationError) {
      setError(operationError instanceof Error ? operationError.message : 'Assignment failed.');
    } finally {
      setSavingAction('');
    }
  }

  async function revokeGuestTracker(booking: Booking) {
    if (!window.confirm(`Revoke the private guest tracker link for ${booking.booking_ref}?`)) return;
    setSavingAction(booking.id);
    setError('');
    setNotice('');
    try {
      await postOperation({
        action: 'revoke_guest_booking_tracker',
        booking_id: booking.id,
      });
      setNotice(`Guest tracker access revoked for ${booking.booking_ref}.`);
      await loadBookings();
    } catch (operationError) {
      setError(operationError instanceof Error ? operationError.message : 'Guest tracker link could not be revoked.');
    } finally {
      setSavingAction('');
    }
  }

  async function recordWhatsAppConfirmation(quoteId: string) {
    if (!window.confirm('Record that the customer accepted this quote through WhatsApp?')) return;
    setSavingAction(quoteId);
    setNotice('');
    setError('');
    try {
      await postOperation({ action: 'record_whatsapp_confirmation', quote_id: quoteId });
      setNotice('WhatsApp confirmation recorded and the booking is confirmed.');
      await loadBookings();
    } catch (operationError) {
      setError(operationError instanceof Error ? operationError.message : 'WhatsApp confirmation could not be recorded.');
    } finally {
      setSavingAction('');
    }
  }

  async function revokeGuestQuoteLink(bookingId: string, quoteId: string) {
    if (!window.confirm(
      'Revoke this guest acceptance link now? This cannot be undone. The quote amount, booking status and payment records will not change.'
    )) return;
    setSavingAction(quoteId);
    setNotice('');
    setError('');
    try {
      await postOperation({ action: 'revoke_guest_quote_link', quote_id: quoteId });
      setAcceptanceLink((current) => current?.bookingId === bookingId ? null : current);
      setNotice('Guest acceptance link revoked. The quote, booking status and payment records are unchanged.');
      await loadBookings();
    } catch (operationError) {
      setError(operationError instanceof Error ? operationError.message : 'Guest quote link could not be revoked.');
    } finally {
      setSavingAction('');
    }
  }

  function updateFilter(update: () => void) {
    update();
    setPage(1);
  }

  const driverById = new Map(drivers.map((driver) => [driver.id, driver]));
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header className="flex flex-col justify-between gap-5 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7 lg:flex-row lg:items-center">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-800">
            <Clipboard className="h-4 w-4" /> Booking operations
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Bookings</h1>
          <p className="mt-2 text-sm text-slate-600">Search, review trip details and manage existing booking workflows.</p>
        </div>
        <button type="button" onClick={() => void loadBookings()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 disabled:opacity-50">
          <RefreshCw className="h-4 w-4" /> Refresh bookings
        </button>
      </header>

      {notice && (
        <div role="status" className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          {notice}
          {acceptanceLink && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <a className="break-all font-semibold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" href={acceptanceLink.url} target="_blank" rel="noreferrer">Guest acceptance link</a>
              <button type="button" className="inline-flex items-center gap-1 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" onClick={() => void navigator.clipboard.writeText(acceptanceLink.url)}>
                <Clipboard className="h-4 w-4" /> Copy link
              </button>
            </div>
          )}
        </div>
      )}
      {error && <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{error}</p>}

      {!loading && !error && <section aria-label="Booking overview" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Pending review', count: bookings.filter((b) => ['pending', 'reviewing'].includes(b.booking_status)).length },
          { label: 'Awaiting customer', count: bookings.filter((b) => b.booking_status === 'quoted').length },
          { label: 'Confirmed', count: bookings.filter((b) => b.booking_status === 'confirmed').length },
          { label: 'Awaiting driver', count: bookings.filter((b) => b.assignment?.assignment_status === 'offered').length },
          { label: 'Driver accepted', count: bookings.filter((b) => b.assignment?.assignment_status === 'accepted').length },
          { label: 'Active trips', count: bookings.filter((b) => b.booking_status === 'in_progress').length },
          { label: 'Completed', count: bookings.filter((b) => b.booking_status === 'completed').length },
          { label: 'Cancelled or rejected', count: bookings.filter((b) => ['cancelled', 'rejected'].includes(b.booking_status)).length },
        ].map((item) => <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold text-slate-600">{item.label}</p><p className="mt-1 text-xl font-black text-slate-900">{item.count}</p></div>)}
      </section>}

      <section aria-label="Booking filters" className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <label className="relative block min-w-0 xl:col-span-2">
            <span className="sr-only">Search bookings</span>
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input value={search} onChange={(event) => updateFilter(() => setSearch(event.target.value))} placeholder="Search reference, customer or route" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </label>
          <label className="min-w-0">
            <span className="sr-only">Filter by booking status</span>
            <select value={statusFilter} onChange={(event) => updateFilter(() => setStatusFilter(event.target.value))} className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100">
              <option value="">All statuses</option>
              {bookingStatuses.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
            </select>
          </label>
          <label className="min-w-0">
            <span className="sr-only">Filter by service type</span>
            <select value={serviceFilter} onChange={(event) => updateFilter(() => setServiceFilter(event.target.value))} className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100">
              <option value="">All services</option>
              {serviceTypes.map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}
            </select>
          </label>
          <label className="min-w-0">
            <span className="sr-only">Filter by journey type</span>
            <select value={journeyFilter} onChange={(event) => updateFilter(() => setJourneyFilter(event.target.value))} className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100">
              <option value="">All journey types</option>
              {journeyTypes.map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}
            </select>
          </label>
          <label className="min-w-0">
            <span className="sr-only">Filter by assigned driver</span>
            <select value={driverFilter} onChange={(event) => updateFilter(() => setDriverFilter(event.target.value))} className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm text-slate-700">
              <option value="">All drivers</option>
              {drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.full_name}</option>)}
            </select>
          </label>
          <label className="min-w-0">
            <span className="sr-only">Filter by assigned vehicle</span>
            <select value={vehicleFilter} onChange={(event) => updateFilter(() => setVehicleFilter(event.target.value))} className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm text-slate-700">
              <option value="">All vehicles</option>
              {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.display_name}</option>)}
            </select>
          </label>
          <label className="min-w-0">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Pickup from</span>
            <input type="date" value={dateFrom} onChange={(event) => updateFilter(() => setDateFrom(event.target.value))} className="w-full min-w-0 rounded-xl border border-slate-200 bg-white p-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </label>
          <label className="min-w-0">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Pickup to</span>
            <input type="date" value={dateTo} onChange={(event) => updateFilter(() => setDateTo(event.target.value))} className="w-full min-w-0 rounded-xl border border-slate-200 bg-white p-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <span>{filteredBookings.length} booking(s)</span>
          <button type="button" onClick={() => { setSearch(''); setStatusFilter(''); setServiceFilter(''); setJourneyFilter(''); setDriverFilter(''); setVehicleFilter(''); setDateFrom(''); setDateTo(''); setPage(1); }} className="rounded-lg px-2 py-1 font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">Clear filters</button>
        </div>
      </section>

      <section aria-label="Bookings list" className="space-y-4">
        {loading ? (
          <div className="rounded-3xl border border-slate-200/80 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">Loading bookings…</div>
        ) : filteredBookings.length === 0 ? (
          <div className="rounded-3xl border border-slate-200/80 bg-white p-10 text-center text-sm text-slate-600 shadow-sm">No bookings match these filters.</div>
        ) : visibleBookings.map((booking) => {
          const firstLeg = booking.legs[0];
          const bookingTitle = bookingNoteField(booking.customer_notes, 'Booking title');
          const requestedVehicle = bookingNoteField(booking.customer_notes, 'Vehicle preference');
          const latestQuote = booking.quotes[0];
          const assignment = booking.assignment;
          const assignedDriver = assignment ? driverById.get(assignment.driver_user_id) : undefined;
          const assignedVehicle = assignment ? vehicleById.get(assignment.vehicle_id) : undefined;
          const guestTrackerState = guestTrackerStates.find((item) => item.booking_id === booking.id);
          const selection = assignments[booking.id] ?? { driver: '', vehicle: '' };
          const expanded = expandedBookingId === booking.id;
          const canAssign = booking.booking_status === 'confirmed' && !assignment;
          const bookingAcceptanceUrl = acceptanceLink?.bookingId === booking.id ? acceptanceLink.url : null;
          const customerMessage = latestQuote?.quote_status === 'sent'
            ? `Hello from Chama Travels. Your quote for booking ${booking.booking_ref} is ${latestQuote.currency} ${Number(latestQuote.total).toFixed(2)}.${bookingAcceptanceUrl ? ` Review and accept it securely here: ${bookingAcceptanceUrl}` : ' Please contact us or check your customer dashboard.'}`
            : `Hello from Chama Travels. Please contact us about your booking ${booking.booking_ref}.`;
          const customerWhatsApp = whatsAppLink(booking.customer_phone, customerMessage);
          const driverWhatsApp = whatsAppLink(assignedDriver?.phone ?? null, `Hello from Chama Travels. Please check your driver dashboard for booking ${booking.booking_ref}.`);

          return (
            <article key={booking.id} className="min-w-0 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
              <div className="space-y-4 p-4 sm:p-5">
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="break-all font-black text-slate-950">{booking.booking_ref}</span>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ring-1 ring-inset ${statusBadgeClasses(booking.booking_status)}`}>{booking.booking_status.replaceAll('_', ' ')}</span>
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase text-blue-800 ring-1 ring-inset ring-blue-600/15">{booking.service_type.replaceAll('_', ' ')} · {booking.journey_type.replaceAll('_', ' ')}</span>
                    </div>
                    {bookingTitle && <p className="break-words text-sm font-bold text-slate-800">{bookingTitle}</p>}
                    <div className="flex min-w-0 items-start gap-2 text-sm text-slate-800">
                      <User className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      <div className="min-w-0">
                        <p className="break-words font-bold">{booking.customer_name}</p>
                        <p className="break-all text-xs text-slate-600">{booking.customer_email} · <a href={`tel:${booking.customer_phone}`} className="text-blue-700 hover:underline">{booking.customer_phone}</a></p>
                      </div>
                    </div>
                    {firstLeg && (
                      <div className="grid min-w-0 gap-2 text-sm sm:grid-cols-2">
                        <p className="flex min-w-0 items-start gap-2 text-slate-700"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" /><span className="break-words"><b>Pickup:</b> {firstLeg.pickup_location}</span></p>
                        <p className="flex min-w-0 items-start gap-2 text-slate-700"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" /><span className="break-words"><b>Drop-off:</b> {firstLeg.dropoff_location}</span></p>
                      </div>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-col items-start gap-2 lg:items-end">
                    {firstLeg && <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600"><Calendar className="h-4 w-4 text-slate-400" />{formatDate(firstLeg.pickup_at)}</span>}
                    {latestQuote && <span className="font-bold text-slate-900">{latestQuote.currency} {Number(latestQuote.total).toFixed(2)} <span className={`ml-1 inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase ring-1 ring-inset ${statusBadgeClasses(latestQuote.quote_status)}`}>{latestQuote.quote_status}</span></span>}
                    {assignment && <span className="inline-flex items-center gap-1.5 text-xs text-emerald-800"><Car className="h-4 w-4" />{assignedVehicle?.display_name ?? 'Assigned vehicle'} · {assignedDriver?.full_name ?? 'Assigned driver'}</span>}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <button type="button" aria-expanded={expanded} onClick={() => setExpandedBookingId(expanded ? '' : booking.id)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
                    <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} /> {expanded ? 'Hide details' : 'View booking details'}
                  </button>
                </div>

                {canOperate && canAssign && (
                  <div className="grid min-w-0 gap-2 border-t border-slate-100 pt-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                    <label className="min-w-0">
                      <span className="sr-only">Select driver</span>
                      <select value={selection.driver} onChange={(event) => setAssignments({ ...assignments, [booking.id]: { ...selection, driver: event.target.value } })} className="w-full min-w-0 rounded-xl border border-slate-200 bg-white p-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100">
                        <option value="">Select driver</option>
                        {drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.full_name}{driver.phone ? ` · ${driver.phone}` : ''}</option>)}
                      </select>
                    </label>
                    <label className="min-w-0">
                      <span className="sr-only">Select vehicle</span>
                      <select value={selection.vehicle} onChange={(event) => setAssignments({ ...assignments, [booking.id]: { ...selection, vehicle: event.target.value } })} className="w-full min-w-0 rounded-xl border border-slate-200 bg-white p-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100">
                        <option value="">Select vehicle</option>
                        {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.display_name} · {vehicle.category_name}</option>)}
                      </select>
                    </label>
                    <button type="button" disabled={savingAction === booking.id} onClick={() => void assignBooking(booking)} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:opacity-50">{savingAction === booking.id ? 'Assigning…' : 'Assign'}</button>
                  </div>
                )}

                {expanded && (
                  <div className="space-y-4 border-t border-slate-100 pt-4">
                    {guestTrackerState && (
                      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div>
                          <h3 className="text-xs font-bold text-slate-800">Guest tracker access</h3>
                          <p className="mt-1 text-xs text-slate-600">
                            {guestTrackerState.active && guestTrackerState.expires_at
                              ? `Active until ${formatDate(guestTrackerState.expires_at)}`
                              : guestTrackerState.revoked_at
                                ? `Revoked ${formatDate(guestTrackerState.revoked_at)}`
                                : 'Unavailable or expired'}
                          </p>
                        </div>
                        {guestTrackerState.active && roles.some((role) => ['admin', 'super_admin'].includes(role)) && (
                          <button
                            type="button"
                            disabled={savingAction === booking.id}
                            onClick={() => void revokeGuestTracker(booking)}
                            className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50"
                          >
                            Revoke guest link
                          </button>
                        )}
                      </section>
                    )}
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Booking created</p><p className="mt-1 text-xs font-semibold text-slate-800">{formatDate(booking.created_at)}</p></div>
                      <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Passengers / luggage</p><p className="mt-1 text-xs font-semibold text-slate-800">{booking.passenger_count} passenger(s) · {booking.luggage_count} bag(s)</p></div>
                      <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Vehicle</p><p className="mt-1 break-words text-xs font-semibold text-slate-800">{requestedVehicle ? `Requested: ${requestedVehicle}` : 'No preference'}{assignedVehicle ? ` · Assigned: ${assignedVehicle.display_name} · ${assignedVehicle.category_name}` : ''}</p></div>
                      <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Driver</p><p className="mt-1 break-words text-xs font-semibold text-slate-800">{assignedDriver?.full_name ?? 'Not assigned'}</p></div>
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-sm font-extrabold text-slate-900">Trip details</h3>
                      {booking.legs.map((leg) => (
                        <div key={`${booking.id}-${leg.sequence_no}`} className="grid min-w-0 gap-3 rounded-2xl border border-slate-200/70 bg-slate-50 p-4 sm:grid-cols-2">
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Leg {leg.sequence_no} · {leg.trip_status.replaceAll('_', ' ')}</p>
                          <p className="text-xs text-slate-600 sm:text-right">{formatDate(leg.pickup_at)}{leg.planned_end_at ? ` · Expected end ${formatDate(leg.planned_end_at)}` : ''}</p>
                          <p className="break-words text-sm text-slate-700"><b>Pickup:</b> {leg.pickup_location}</p>
                          <p className="break-words text-sm text-slate-700"><b>Drop-off:</b> {leg.dropoff_location}</p>
                        </div>
                      ))}
                    </div>
                    {booking.customer_notes && <p className="break-words rounded-2xl bg-slate-50 p-3 text-xs leading-5 text-slate-700"><b>Customer notes:</b> {booking.customer_notes}</p>}
                    {canOperate && (customerWhatsApp || driverWhatsApp) && <div className="flex flex-wrap gap-3 text-xs font-bold text-emerald-700">
                      {customerWhatsApp && <a href={customerWhatsApp} target="_blank" rel="noopener noreferrer" className="underline">Contact customer on WhatsApp</a>}
                      {driverWhatsApp && <a href={driverWhatsApp} target="_blank" rel="noopener noreferrer" className="underline">Contact driver on WhatsApp</a>}
                    </div>}
                    {canOperate && <BookingOperations bookingId={booking.id} status={booking.booking_status} currency={booking.currency} legs={booking.legs} onUpdated={async (url) => {
                      if (url) {
                        setAcceptanceLink({ bookingId: booking.id, url });
                        setNotice('Quote issued. Share the one-time acceptance link with the guest privately.');
                      } else {
                        setAcceptanceLink((current) => current?.bookingId === booking.id ? null : current);
                        setNotice('Booking updated.');
                      }
                      await loadBookings();
                    }} />}
                    {booking.quotes.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-extrabold text-slate-900">Quotes</h3>
                        {booking.quotes.map((quote) => (
                          <div key={quote.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/70 bg-white p-3">
                            <span className="text-xs font-semibold text-slate-700">Revision {quote.revision} · {quote.currency} {Number(quote.total).toFixed(2)}</span>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ring-1 ring-inset ${statusBadgeClasses(quote.quote_status)}`}>{quote.quote_status}</span>
                              {quote.has_guest_acceptance_link && (() => {
                                const linkState = getGuestQuoteLinkState(quote);
                                const linkLabels = {
                                  active: 'Guest link active',
                                  expired: 'Guest link expired',
                                  revoked: 'Guest link revoked',
                                  accepted: 'Guest link used',
                                  unavailable: 'Guest link unavailable',
                                };
                                return (
                                  <>
                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-700">
                                      {linkLabels[linkState]}
                                    </span>
                                    {roles.some((role) => ['admin', 'super_admin'].includes(role)) &&
                                      booking.booking_status === 'quoted' &&
                                      linkState === 'active' && (
                                        <button
                                          type="button"
                                          disabled={savingAction === quote.id}
                                          onClick={() => void revokeGuestQuoteLink(booking.id, quote.id)}
                                          className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-bold text-rose-700 disabled:opacity-50"
                                        >
                                          {savingAction === quote.id ? 'Revoking…' : 'Revoke guest link'}
                                        </button>
                                      )}
                                  </>
                                );
                              })()}
                              {roles.some((role) => ['admin', 'super_admin'].includes(role)) &&
                                booking.booking_status === 'quoted' &&
                                quote.quote_status === 'sent' &&
                                Date.parse(quote.expires_at) > Date.now() && (
                                  <button
                                    type="button"
                                    disabled={savingAction === quote.id}
                                    onClick={() => void recordWhatsAppConfirmation(quote.id)}
                                    className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-bold text-emerald-800 disabled:opacity-50"
                                  >
                                    {savingAction === quote.id ? 'Recording…' : 'Record WhatsApp acceptance'}
                                  </button>
                                )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {roles.some((role) => ['admin', 'super_admin'].includes(role)) && (
                      <BookingBillingPanel
                        bookingId={booking.id}
                        bookingRef={booking.booking_ref}
                        acceptedQuoteId={booking.quotes.find((quote) => quote.quote_status === 'accepted')?.id ?? null}
                        assignmentId={assignment && ['offered', 'accepted'].includes(assignment.assignment_status) ? assignment.id : null}
                      />
                    )}
                    {roles.some((role) => ['admin', 'super_admin'].includes(role)) && (
                      <BookingActivity bookingId={booking.id} />
                    )}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </section>

      {!loading && filteredBookings.length > 0 && (
        <footer className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
          <span className="text-xs text-slate-600">Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredBookings.length)} of {filteredBookings.length}</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-40">Previous</button>
            <span className="px-2 text-xs text-slate-500">Page {currentPage} of {pageCount}</span>
            <button type="button" disabled={currentPage >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-40">Next</button>
          </div>
        </footer>
      )}

      <div className="flex items-start gap-2 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-xs leading-5 text-slate-600">
        <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
        Booking status transitions remain managed by the existing quote and dispatch workflows.
      </div>
    </main>
  );
}
