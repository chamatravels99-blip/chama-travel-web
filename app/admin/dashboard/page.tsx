'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Car,
  Clipboard,
  DollarSign,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';

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
    driver_name?: string;
    driver_phone?: string | null;
    vehicle_name?: string;
    vehicle_registration?: string | null;
  } | null;
  quotes: Quote[];
  financials?: {
    quote_id?: string;
    quote_total: number;
    currency: string;
    total_paid: number;
    net_paid: number;
    outstanding_balance: number;
    payment_status: 'paid' | 'partially_paid' | 'unpaid' | 'no_quote';
  } | null;
};

type Driver = { id: string; full_name: string; phone: string | null };
type Vehicle = {
  id: string;
  display_name: string;
  registration_number?: string | null;
  category_name?: string;
  max_passengers?: number;
};

function formatColomboDateTime(value: string) {
  return new Date(value).toLocaleString('en-GB', {
    timeZone: 'Asia/Colombo',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function statusBadgeClasses(status: string) {
  if (['pending', 'reviewing'].includes(status)) {
    return 'bg-amber-50 text-amber-800 ring-amber-600/20';
  }
  if (['confirmed', 'accepted', 'active', 'completed'].includes(status)) {
    return 'bg-emerald-50 text-emerald-800 ring-emerald-600/20';
  }
  if (['quoted', 'issued', 'assigned', 'in_progress'].includes(status)) {
    return 'bg-blue-50 text-blue-800 ring-blue-600/20';
  }
  if (['cancelled', 'expired', 'rejected'].includes(status)) {
    return 'bg-rose-50 text-rose-800 ring-rose-600/20';
  }
  return 'bg-slate-100 text-slate-700 ring-slate-600/10';
}

function paymentBadgeClasses(status: string | undefined) {
  if (status === 'paid') return 'bg-emerald-50 text-emerald-800 ring-emerald-600/20';
  if (status === 'partially_paid') return 'bg-amber-50 text-amber-800 ring-amber-600/20';
  if (status === 'unpaid') return 'bg-rose-50 text-rose-800 ring-rose-600/20';
  return 'bg-slate-100 text-slate-500 ring-slate-300';
}

export default function AdminDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/operations/bookings', { cache: 'no-store' });
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        data?: {
          bookings: Booking[];
          resources: { drivers: Driver[]; vehicles: Vehicle[] };
        };
      };
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || 'Operations data could not be loaded.');
      }
      setBookings(result.data.bookings);
      setDrivers(result.data.resources.drivers);
      setVehicles(result.data.resources.vehicles);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Operations data could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const kpis = useMemo(() => {
    const totalBookings = bookings.length;
    const pendingReview = bookings.filter((b) => ['pending', 'reviewing'].includes(b.booking_status)).length;
    const awaitingGuestQuote = bookings.filter((b) => b.booking_status === 'quoted').length;
    const awaitingDriver = bookings.filter((b) => b.booking_status === 'confirmed' && !b.assignment).length;
    const needsAttention = pendingReview + awaitingGuestQuote + awaitingDriver;

    const activeAndUpcoming = bookings.filter((b) =>
      ['confirmed', 'assigned', 'in_progress'].includes(b.booking_status)
    ).length;
    const inProgressCount = bookings.filter((b) => b.booking_status === 'in_progress').length;
    const completedCount = bookings.filter((b) => b.booking_status === 'completed').length;

    const financialBookings = bookings.filter((b) =>
      ['confirmed', 'assigned', 'in_progress', 'completed'].includes(b.booking_status)
    );
    const totalQuoted = financialBookings.reduce(
      (sum, b) => sum + Number(b.financials?.quote_total ?? 0),
      0
    );
    const totalCollected = financialBookings.reduce(
      (sum, b) => sum + Number(b.financials?.net_paid ?? b.financials?.total_paid ?? 0),
      0
    );
    const totalOutstanding = financialBookings.reduce(
      (sum, b) => sum + Number(b.financials?.outstanding_balance ?? 0),
      0
    );

    return {
      totalBookings,
      needsAttention,
      pendingReview,
      awaitingGuestQuote,
      awaitingDriver,
      activeAndUpcoming,
      inProgressCount,
      completedCount,
      totalQuoted,
      totalCollected,
      totalOutstanding,
    };
  }, [bookings]);

  const fleetStatus = useMemo(() => {
    const driverBookingMap = new Map<string, string>();
    const vehicleBookingMap = new Map<string, string>();

    for (const b of bookings) {
      if (['assigned', 'in_progress'].includes(b.booking_status) && b.assignment) {
        if (!driverBookingMap.has(b.assignment.driver_user_id)) {
          driverBookingMap.set(b.assignment.driver_user_id, b.booking_ref);
        }
        if (!vehicleBookingMap.has(b.assignment.vehicle_id)) {
          vehicleBookingMap.set(b.assignment.vehicle_id, b.booking_ref);
        }
      }
    }

    const assignedDriversCount = drivers.filter((d) => driverBookingMap.has(d.id)).length;
    const availableDriversCount = Math.max(0, drivers.length - assignedDriversCount);
    const assignedVehiclesCount = vehicles.filter((v) => vehicleBookingMap.has(v.id)).length;
    const availableVehiclesCount = Math.max(0, vehicles.length - assignedVehiclesCount);

    return {
      driverBookingMap,
      vehicleBookingMap,
      assignedDriversCount,
      availableDriversCount,
      assignedVehiclesCount,
      availableVehiclesCount,
    };
  }, [bookings, drivers, vehicles]);

  const recentBookings = useMemo(() => {
    const search = query.trim().toLowerCase();
    const list = bookings.filter((booking) => {
      if (!search) return true;
      return [
        booking.booking_ref,
        booking.customer_name,
        booking.customer_email,
        booking.customer_phone,
        ...booking.legs.flatMap((leg) => [leg.pickup_location, leg.dropoff_location]),
      ].some((value) => value.toLowerCase().includes(search));
    });
    return list.slice(0, 12);
  }, [bookings, query]);

  return (
    <div className="bg-slate-50 font-sans text-slate-800">
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Header */}
        <header className="flex flex-col gap-5 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-800">
              <ShieldCheck className="h-4 w-4" /> Real-Time Executive Overview
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                Admin Operations Dashboard
              </h1>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
                <span aria-hidden="true" className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Live Connected
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Unified summary of incoming bookings, active trips, fleet availability, and verified payments.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/bookings"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-blue-800 shadow-sm"
            >
              <Clipboard className="h-4 w-4" /> Open Bookings Center
            </Link>
            <Link
              href="/admin/fleet"
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Fleet &amp; Drivers
            </Link>
            <Link
              href="/admin/payments"
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Payments &amp; Ledger
            </Link>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2.5 text-xs font-bold text-white transition hover:bg-slate-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </header>

        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-700" />
            <span>{error}</span>
          </div>
        )}

        {/* Top KPI Cards */}
        <section aria-label="Key operational metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* KPI 1: Total Bookings */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Bookings</span>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <Clipboard className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-black text-slate-950">{kpis.totalBookings}</p>
            <p className="mt-2 text-xs text-slate-500">
              <b>{kpis.completedCount}</b> completed trips in ledger
            </p>
          </div>

          {/* KPI 2: Needs Attention */}
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/40 p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-900">Needs Attention</span>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                <AlertCircle className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-black text-amber-950">{kpis.needsAttention}</p>
            <p className="mt-2 text-xs text-amber-800">
              <b>{kpis.pendingReview}</b> review · <b>{kpis.awaitingGuestQuote}</b> quoted · <b>{kpis.awaitingDriver}</b> need driver
            </p>
          </div>

          {/* KPI 3: Active & Upcoming Trips */}
          <div className="rounded-2xl border border-blue-200/80 bg-blue-50/40 p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-900">Active &amp; Upcoming Trips</span>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-800">
                <Activity className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-black text-blue-950">{kpis.activeAndUpcoming}</p>
            <p className="mt-2 text-xs text-blue-800">
              <b>{kpis.inProgressCount}</b> currently in progress on the road
            </p>
          </div>

          {/* KPI 4: Financial Snapshot */}
          <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-slate-900 to-blue-950 p-5 text-white shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-200">Financial Snapshot</span>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-emerald-300">
                <DollarSign className="h-5 w-5" />
              </span>
            </div>
            <div className="mt-3 space-y-1">
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-slate-300">Collected:</span>
                <span className="text-base font-black text-emerald-400">
                  LKR {kpis.totalCollected.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-slate-300">Outstanding:</span>
                <span className="font-extrabold text-amber-300">
                  LKR {kpis.totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
            <p className="mt-2 border-t border-white/10 pt-1.5 text-[11px] text-slate-300">
              Total Quoted: LKR {kpis.totalQuoted.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </section>

        {/* Recent Bookings Table */}
        <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-200/80 p-5 sm:flex-row sm:items-center sm:p-6">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-slate-900">Recent Bookings</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Latest customer booking requests and their live operational and payment status.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="relative block w-full sm:w-72">
                <span className="sr-only">Search recent bookings</span>
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search reference, customer, route..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
                />
              </label>
              <Link
                href="/admin/bookings"
                className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-900"
              >
                View All Bookings <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500">Loading live bookings…</div>
          ) : recentBookings.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">No bookings match your search.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3.5">Reference</th>
                    <th className="px-4 py-3.5">Customer &amp; Phone</th>
                    <th className="px-4 py-3.5">Pickup → Drop-off Route</th>
                    <th className="px-4 py-3.5">Pickup Date &amp; Time</th>
                    <th className="px-4 py-3.5">Booking Status</th>
                    <th className="px-4 py-3.5">Payment Status</th>
                    <th className="px-4 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentBookings.map((booking) => {
                    const firstLeg = booking.legs[0];
                    const paymentStatus = booking.financials?.payment_status ?? 'no_quote';
                    const latestQuote = booking.quotes[0];
                    const quoteTotal = booking.financials?.quote_total ?? latestQuote?.total;
                    const quoteCurrency = booking.financials?.currency ?? latestQuote?.currency ?? booking.currency;

                    return (
                      <tr key={booking.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-slate-950 whitespace-nowrap">
                          {booking.booking_ref}
                          <span className="block font-sans text-[10px] font-normal text-slate-400">
                            {new Date(booking.created_at).toLocaleDateString('en-GB')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{booking.customer_name}</div>
                          <a
                            href={`tel:${booking.customer_phone}`}
                            className="text-[11px] font-medium text-blue-700 hover:underline"
                          >
                            {booking.customer_phone}
                          </a>
                        </td>
                        <td className="px-4 py-3 max-w-xs">
                          {firstLeg ? (
                            <div className="truncate font-semibold text-slate-800">
                              {firstLeg.pickup_location} → {firstLeg.dropoff_location}
                            </div>
                          ) : (
                            <span className="text-slate-400">Route not specified</span>
                          )}
                          <span className="text-[11px] text-slate-500 capitalize">
                            {booking.service_type.replaceAll('_', ' ')} · {booking.passenger_count} pax
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-800">
                          {firstLeg ? formatColomboDateTime(firstLeg.pickup_at) : '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ring-1 ring-inset ${statusBadgeClasses(
                              booking.booking_status
                            )}`}
                          >
                            {booking.booking_status.replaceAll('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex flex-col items-start gap-1">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset ${paymentBadgeClasses(
                                paymentStatus
                              )}`}
                            >
                              {paymentStatus === 'no_quote' ? 'No Quote' : paymentStatus.replaceAll('_', ' ')}
                            </span>
                            {quoteTotal !== undefined && (
                              <span className="font-mono text-[11px] font-semibold text-slate-700">
                                {quoteCurrency} {Number(quoteTotal).toFixed(2)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <Link
                            href={`/admin/bookings?booking_id=${encodeURIComponent(booking.id)}`}
                            className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition"
                          >
                            Manage
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Live Fleet & Driver Summary */}
        <section aria-label="Live fleet and driver availability" className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Drivers Summary Card */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <Users className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Drivers Roster</h3>
                  <p className="text-xs text-slate-500">
                    <b>{fleetStatus.availableDriversCount}</b> available · <b>{fleetStatus.assignedDriversCount}</b> on active/assigned trips
                  </p>
                </div>
              </div>
              <Link
                href="/admin/fleet"
                className="text-xs font-bold text-blue-700 hover:underline inline-flex items-center gap-1"
              >
                Manage Fleet <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {drivers.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No active drivers registered in fleet.</p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                {drivers.map((driver) => {
                  const assignedRef = fleetStatus.driverBookingMap.get(driver.id);
                  return (
                    <div key={driver.id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                      <div>
                        <p className="font-bold text-slate-900">{driver.full_name}</p>
                        <p className="text-slate-500">{driver.phone || 'No phone listed'}</p>
                      </div>
                      {assignedRef ? (
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-800 ring-1 ring-inset ring-blue-600/20">
                          Assigned · {assignedRef}
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-800 ring-1 ring-inset ring-emerald-600/20">
                          Available
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Vehicles Summary Card */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <Car className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Active Vehicles</h3>
                  <p className="text-xs text-slate-500">
                    <b>{fleetStatus.availableVehiclesCount}</b> available · <b>{fleetStatus.assignedVehiclesCount}</b> on active/assigned trips
                  </p>
                </div>
              </div>
              <Link
                href="/admin/fleet"
                className="text-xs font-bold text-blue-700 hover:underline inline-flex items-center gap-1"
              >
                Manage Vehicles <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {vehicles.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No active vehicles registered in fleet.</p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                {vehicles.map((vehicle) => {
                  const assignedRef = fleetStatus.vehicleBookingMap.get(vehicle.id);
                  return (
                    <div key={vehicle.id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                      <div>
                        <p className="font-bold text-slate-900">
                          {vehicle.display_name}{' '}
                          {vehicle.registration_number && (
                            <span className="font-mono text-slate-500">({vehicle.registration_number})</span>
                          )}
                        </p>
                        <p className="text-slate-500">
                          {vehicle.category_name || 'Standard'}{' '}
                          {vehicle.max_passengers ? `· Up to ${vehicle.max_passengers} pax` : ''}
                        </p>
                      </div>
                      {assignedRef ? (
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-800 ring-1 ring-inset ring-blue-600/20">
                          Assigned · {assignedRef}
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-800 ring-1 ring-inset ring-emerald-600/20">
                          Available
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
