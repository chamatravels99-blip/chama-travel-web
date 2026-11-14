'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Car,
  CheckCircle2,
  Edit3,
  MessageSquare,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Truck,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { whatsAppLink } from '@/lib/whatsapp';

type Category = {
  id: string;
  code: string;
  display_name: string;
  max_passengers: number;
  max_luggage: number;
  is_active: boolean;
};

type Vehicle = {
  id: string;
  category_id: string;
  category_name: string;
  max_passengers?: number;
  max_luggage?: number;
  display_name: string;
  registration_number: string | null;
  operational_status: string;
  is_currently_assigned?: boolean;
  active_booking_ref?: string | null;
};

type Driver = {
  id: string;
  full_name: string;
  phone: string | null;
  license_number: string | null;
  driver_notes: string | null;
  account_status: 'active' | 'inactive';
  default_vehicle_id: string | null;
  default_vehicle_name: string | null;
  default_vehicle_registration: string | null;
  default_vehicle_category: string | null;
  is_currently_assigned: boolean;
  active_booking_ref: string | null;
};

type DriverFormState = {
  driver_id: string;
  full_name: string;
  phone: string;
  license_number: string;
  driver_notes: string;
  account_status: 'active' | 'inactive';
  vehicle_mode: 'existing' | 'new' | 'none';
  default_vehicle_id: string;
  new_vehicle_category_id: string;
  new_vehicle_name: string;
  new_vehicle_registration: string;
};

const emptyDriverForm = (defaultCategoryId = ''): DriverFormState => ({
  driver_id: '',
  full_name: '',
  phone: '',
  license_number: '',
  driver_notes: '',
  account_status: 'active',
  vehicle_mode: 'existing',
  default_vehicle_id: '',
  new_vehicle_category_id: defaultCategoryId,
  new_vehicle_name: '',
  new_vehicle_registration: '',
});

export default function FleetPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driverSearch, setDriverSearch] = useState('');
  const [driverFilter, setDriverFilter] = useState<'all' | 'available' | 'assigned' | 'inactive'>('all');

  const [driverModalOpen, setDriverModalOpen] = useState(false);
  const [driverForm, setDriverForm] = useState<DriverFormState>(() => emptyDriverForm());

  const [categoryForm, setCategoryForm] = useState({
    category_id: '',
    code: '',
    display_name: '',
    max_passengers: '3',
    max_luggage: '2',
    is_active: true,
  });
  const [vehicleForm, setVehicleForm] = useState({
    vehicle_id: '',
    category_id: '',
    display_name: '',
    registration_number: '',
    operational_status: 'active',
  });

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/fleet', { cache: 'no-store' });
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        data?: { categories?: Category[]; vehicles?: Vehicle[]; drivers?: Driver[] };
      };
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || 'Fleet data could not be loaded.');
      }
      const loadedCategories = Array.isArray(result.data.categories) ? result.data.categories : [];
      const loadedVehicles = Array.isArray(result.data.vehicles) ? result.data.vehicles : [];
      const loadedDrivers = Array.isArray(result.data.drivers) ? result.data.drivers : [];
      setCategories(loadedCategories);
      setVehicles(loadedVehicles);
      setDrivers(loadedDrivers);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Fleet data could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function save(body: Record<string, unknown>, customSuccessMsg?: string): Promise<boolean> {
    setBusy(true);
    setNotice('');
    setError('');
    try {
      const response = await fetch('/api/admin/fleet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        message?: string;
      };
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Fleet item could not be saved.');
      }
      setNotice(customSuccessMsg || result.message || 'Fleet item saved successfully.');
      await load();
      return true;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Fleet item could not be saved.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  function openAddDriverModal() {
    const firstActiveCategory = categories.find((c) => c.is_active)?.id || categories[0]?.id || '';
    setDriverForm({
      ...emptyDriverForm(firstActiveCategory),
      vehicle_mode: vehicles.length > 0 ? 'existing' : 'new',
    });
    setDriverModalOpen(true);
  }

  function openEditDriverModal(driver: Driver) {
    const firstActiveCategory = categories.find((c) => c.is_active)?.id || categories[0]?.id || '';
    setDriverForm({
      driver_id: driver.id,
      full_name: driver.full_name,
      phone: driver.phone ?? '',
      license_number: driver.license_number ?? '',
      driver_notes: driver.driver_notes ?? '',
      account_status: driver.account_status,
      vehicle_mode: driver.default_vehicle_id ? 'existing' : 'none',
      default_vehicle_id: driver.default_vehicle_id ?? '',
      new_vehicle_category_id: firstActiveCategory,
      new_vehicle_name: '',
      new_vehicle_registration: '',
    });
    setDriverModalOpen(true);
  }

  async function handleSaveDriver(e: React.FormEvent) {
    e.preventDefault();
    const isNewVehicle = driverForm.vehicle_mode === 'new';
    const isExistingVehicle = driverForm.vehicle_mode === 'existing';

    const ok = await save(
      {
        action: 'save_driver',
        driver_id: driverForm.driver_id || null,
        full_name: driverForm.full_name,
        phone: driverForm.phone,
        license_number: driverForm.license_number || null,
        driver_notes: driverForm.driver_notes || null,
        account_status: driverForm.account_status,
        default_vehicle_id: isExistingVehicle ? driverForm.default_vehicle_id || null : null,
        new_vehicle_category_id: isNewVehicle ? driverForm.new_vehicle_category_id || null : null,
        new_vehicle_name: isNewVehicle ? driverForm.new_vehicle_name : null,
        new_vehicle_registration: isNewVehicle ? driverForm.new_vehicle_registration : null,
      },
      driverForm.driver_id
        ? `Driver "${driverForm.full_name}" updated successfully.`
        : `Driver "${driverForm.full_name}" added to fleet.`
    );
    if (ok) {
      setDriverModalOpen(false);
    }
  }

  async function handleToggleDriverStatus(driver: Driver) {
    const nextStatus = driver.account_status === 'active' ? 'inactive' : 'active';
    await save(
      {
        action: 'save_driver',
        driver_id: driver.id,
        full_name: driver.full_name,
        phone: driver.phone ?? '',
        license_number: driver.license_number ?? null,
        driver_notes: driver.driver_notes ?? null,
        account_status: nextStatus,
        default_vehicle_id: driver.default_vehicle_id ?? null,
      },
      `Driver "${driver.full_name}" marked as ${nextStatus}.`
    );
  }

  const filteredDrivers = useMemo(() => {
    const q = driverSearch.trim().toLowerCase();
    return drivers.filter((driver) => {
      if (driverFilter === 'available' && (driver.account_status !== 'active' || driver.is_currently_assigned)) {
        return false;
      }
      if (driverFilter === 'assigned' && !driver.is_currently_assigned) {
        return false;
      }
      if (driverFilter === 'inactive' && driver.account_status !== 'inactive') {
        return false;
      }
      if (!q) return true;
      return (
        driver.full_name.toLowerCase().includes(q) ||
        (driver.phone ?? '').toLowerCase().includes(q) ||
        (driver.license_number ?? '').toLowerCase().includes(q) ||
        (driver.driver_notes ?? '').toLowerCase().includes(q) ||
        (driver.default_vehicle_name ?? '').toLowerCase().includes(q) ||
        (driver.default_vehicle_registration ?? '').toLowerCase().includes(q)
      );
    });
  }, [drivers, driverSearch, driverFilter]);

  const stats = useMemo(() => {
    const activeDrivers = drivers.filter((d) => d.account_status === 'active');
    const assignedDrivers = activeDrivers.filter((d) => d.is_currently_assigned);
    const availableDrivers = activeDrivers.filter((d) => !d.is_currently_assigned);
    const activeVehicles = vehicles.filter((v) => v.operational_status === 'active');
    const assignedVehicles = activeVehicles.filter((v) => v.is_currently_assigned);
    const availableVehicles = activeVehicles.filter((v) => !v.is_currently_assigned);
    return {
      totalDrivers: drivers.length,
      availableDrivers: availableDrivers.length,
      assignedDrivers: assignedDrivers.length,
      totalVehicles: vehicles.length,
      availableVehicles: availableVehicles.length,
      assignedVehicles: assignedVehicles.length,
      activeCategories: categories.filter((c) => c.is_active).length,
    };
  }, [drivers, vehicles, categories]);

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <div>
            <Link
              href="/admin/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Operations Dashboard
            </Link>
            <h1 className="mt-1.5 text-2xl font-black text-slate-900">
              Drivers &amp; Fleet Management
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Register internal drivers and manage fleet vehicles for one-click booking dispatch. No driver login or password is required.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={openAddDriverModal}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black text-white shadow-xs hover:bg-blue-700 transition"
            >
              <UserPlus className="h-4 w-4" />
              + Add New Driver
            </button>
            <button
              type="button"
              onClick={() => void load()}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800 flex items-center justify-between">
            <span>{error}</span>
            <button type="button" onClick={() => setError('')} className="text-red-600 hover:text-red-900">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {notice && (
          <div
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900 flex items-center justify-between"
            aria-live="polite"
          >
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              {notice}
            </span>
            <button type="button" onClick={() => setNotice('')} className="text-emerald-700 hover:text-emerald-950">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Top KPI Cards */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                Registered Drivers
              </span>
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <p className="mt-2 text-3xl font-black text-slate-900">{stats.totalDrivers}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-emerald-700">
                {stats.availableDrivers} Available
              </span>
              <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-indigo-700">
                {stats.assignedDrivers} On Trip / Assigned
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                Fleet Vehicles
              </span>
              <Car className="h-5 w-5 text-emerald-600" />
            </div>
            <p className="mt-2 text-3xl font-black text-slate-900">{stats.totalVehicles}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-emerald-700">
                {stats.availableVehicles} Available
              </span>
              <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-indigo-700">
                {stats.assignedVehicles} Assigned
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                Vehicle Categories
              </span>
              <Truck className="h-5 w-5 text-amber-600" />
            </div>
            <p className="mt-2 text-3xl font-black text-slate-900">{categories.length}</p>
            <p className="mt-2 text-xs font-bold text-slate-500">
              {stats.activeCategories} active categories for customer bookings
            </p>
          </div>
        </section>

        {/* Drivers Directory Section */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-blue-600" />
                Internal Drivers Directory ({drivers.length})
              </h2>
              <p className="text-xs text-slate-500">
                All active drivers listed here appear automatically in the Booking Dispatch tab.
              </p>
            </div>
            <button
              type="button"
              onClick={openAddDriverModal}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black text-white hover:bg-blue-700 transition"
            >
              <Plus className="h-4 w-4" />
              + Add New Driver
            </button>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={driverSearch}
                onChange={(e) => setDriverSearch(e.target.value)}
                placeholder="Search driver by name, phone, license, or vehicle..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2.5 text-xs font-medium text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'all', label: `All (${drivers.length})` },
                  { id: 'available', label: `Available (${stats.availableDrivers})` },
                  { id: 'assigned', label: `Assigned (${stats.assignedDrivers})` },
                  {
                    id: 'inactive',
                    label: `Inactive (${drivers.filter((d) => d.account_status === 'inactive').length})`,
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setDriverFilter(tab.id)}
                  className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                    driverFilter === tab.id
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <p className="py-8 text-center text-sm text-slate-500">Loading drivers…</p>
          ) : filteredDrivers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <UserPlus className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-2 text-sm font-bold text-slate-800">
                {drivers.length === 0
                  ? 'No drivers registered yet'
                  : 'No drivers match your current search or filter'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Click &ldquo;+ Add New Driver&rdquo; to register a driver and their vehicle in seconds.
              </p>
              <button
                type="button"
                onClick={openAddDriverModal}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                + Add First Driver
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Driver</th>
                    <th className="py-3 px-4">Contact (Call / WhatsApp)</th>
                    <th className="py-3 px-4">License &amp; Notes</th>
                    <th className="py-3 px-4">Linked Vehicle</th>
                    <th className="py-3 px-4">Dispatch Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {filteredDrivers.map((driver) => {
                    const waUrl = driver.phone
                      ? whatsAppLink(
                          driver.phone,
                          `Hello ${driver.full_name}, Chama Travels Operations contacting you.`
                        )
                      : null;
                    return (
                      <tr key={driver.id} className="hover:bg-slate-50/80">
                        <td className="py-3.5 px-4">
                          <div className="font-black text-slate-900 text-sm">{driver.full_name}</div>
                          <span
                            className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                              driver.account_status === 'active'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {driver.account_status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          {driver.phone ? (
                            <div className="space-y-1.5">
                              <div className="font-bold text-slate-800">{driver.phone}</div>
                              <div className="flex flex-wrap gap-1.5">
                                <a
                                  href={`tel:${driver.phone}`}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
                                >
                                  <Phone className="h-3 w-3 text-blue-600" />
                                  Call
                                </a>
                                {waUrl && (
                                  <a
                                    href={waUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700"
                                  >
                                    <MessageSquare className="h-3 w-3" />
                                    WhatsApp
                                  </a>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">No phone set</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {driver.license_number ? (
                            <div className="font-bold text-slate-800">
                              Lic: <span className="font-mono">{driver.license_number}</span>
                            </div>
                          ) : (
                            <div className="text-slate-400">No license recorded</div>
                          )}
                          {driver.driver_notes && (
                            <p className="mt-0.5 text-[11px] text-slate-500 max-w-xs line-clamp-2">
                              {driver.driver_notes}
                            </p>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {driver.default_vehicle_name ? (
                            <div>
                              <div className="font-bold text-slate-900">{driver.default_vehicle_name}</div>
                              <div className="text-[11px] text-slate-500">
                                {driver.default_vehicle_registration || 'Unregistered'}
                                {driver.default_vehicle_category ? ` · ${driver.default_vehicle_category}` : ''}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">Any fleet vehicle</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {driver.account_status !== 'active' ? (
                            <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">
                              Inactive
                            </span>
                          ) : driver.is_currently_assigned ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-extrabold text-indigo-700">
                              Assigned {driver.active_booking_ref ? `(${driver.active_booking_ref})` : ''}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-extrabold text-emerald-700">
                              Available
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEditDriverModal(driver)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              Edit
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleToggleDriverStatus(driver)}
                              className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition disabled:opacity-50 ${
                                driver.account_status === 'active'
                                  ? 'border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                                  : 'border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                              }`}
                            >
                              {driver.account_status === 'active' ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Vehicles & Categories Management Grid */}
        <section className="grid gap-6 lg:grid-cols-2">
          {/* Vehicles Form & List */}
          <div className="space-y-4">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void save(
                  {
                    action: 'save_vehicle',
                    vehicle_id: vehicleForm.vehicle_id || null,
                    category_id: vehicleForm.category_id,
                    display_name: vehicleForm.display_name,
                    registration_number: vehicleForm.registration_number,
                    operational_status: vehicleForm.operational_status,
                  },
                  vehicleForm.vehicle_id ? 'Vehicle updated.' : 'New vehicle added to fleet.'
                ).then((ok) => {
                  if (ok && !vehicleForm.vehicle_id) {
                    setVehicleForm({
                      vehicle_id: '',
                      category_id: vehicleForm.category_id,
                      display_name: '',
                      registration_number: '',
                      operational_status: 'active',
                    });
                  }
                });
              }}
              className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-black text-slate-900 flex items-center gap-2">
                  <Car className="h-4 w-4 text-emerald-600" />
                  Add / Edit Fleet Vehicle
                </h2>
                {vehicleForm.vehicle_id && (
                  <button
                    type="button"
                    onClick={() =>
                      setVehicleForm({
                        vehicle_id: '',
                        category_id: '',
                        display_name: '',
                        registration_number: '',
                        operational_status: 'active',
                      })
                    }
                    className="text-xs font-bold text-blue-600 hover:underline"
                  >
                    + New Vehicle Mode
                  </button>
                )}
              </div>
              <select
                value={vehicleForm.vehicle_id}
                onChange={(event) => {
                  const selected = vehicles.find((vehicle) => vehicle.id === event.target.value);
                  setVehicleForm(
                    selected
                      ? {
                          vehicle_id: selected.id,
                          category_id: selected.category_id,
                          display_name: selected.display_name,
                          registration_number: selected.registration_number ?? '',
                          operational_status: selected.operational_status,
                        }
                      : {
                          vehicle_id: '',
                          category_id: '',
                          display_name: '',
                          registration_number: '',
                          operational_status: 'active',
                        }
                  );
                }}
                className="w-full rounded-xl border border-slate-200 p-3 text-sm"
              >
                <option value="">+ Create new vehicle</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    Edit: {vehicle.display_name} ({vehicle.registration_number || 'No reg'}) · {vehicle.operational_status}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <select
                  required
                  value={vehicleForm.category_id}
                  onChange={(event) => setVehicleForm({ ...vehicleForm, category_id: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm"
                >
                  <option value="">Select vehicle category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.display_name} (max {category.max_passengers} pax / {category.max_luggage} bags)
                    </option>
                  ))}
                </select>
                <select
                  value={vehicleForm.operational_status}
                  onChange={(event) => setVehicleForm({ ...vehicleForm, operational_status: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm"
                >
                  <option value="active">Active (Available for Dispatch)</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  required
                  minLength={2}
                  maxLength={120}
                  value={vehicleForm.display_name}
                  onChange={(event) => setVehicleForm({ ...vehicleForm, display_name: event.target.value })}
                  placeholder="Vehicle model / name (e.g. Toyota KDH Van)"
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm"
                />
                <input
                  maxLength={40}
                  value={vehicleForm.registration_number}
                  onChange={(event) => setVehicleForm({ ...vehicleForm, registration_number: event.target.value })}
                  placeholder="Registration no. (e.g. WP CAA-1234)"
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm"
                />
              </div>
              <button
                disabled={busy}
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {vehicleForm.vehicle_id ? 'Update Vehicle' : 'Save New Vehicle'}
              </button>
            </form>

            {/* Vehicles List */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-xs">
              <h3 className="text-sm font-black text-slate-900">
                Fleet Vehicles ({vehicles.length})
              </h3>
              {vehicles.length === 0 ? (
                <p className="text-xs text-slate-500">No vehicles added yet.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {vehicles.map((vehicle) => (
                    <div key={vehicle.id} className="flex items-center justify-between gap-3 py-3 text-xs">
                      <div>
                        <div className="font-bold text-slate-900">
                          {vehicle.display_name}{' '}
                          <span className="text-slate-500 font-normal">· {vehicle.category_name}</span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Reg: <span className="font-mono font-semibold">{vehicle.registration_number || 'Not set'}</span>
                          {vehicle.max_passengers !== undefined && (
                            <span>
                              {' '}
                              · Up to {vehicle.max_passengers} pax / {vehicle.max_luggage} bags
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {vehicle.is_currently_assigned ? (
                          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-extrabold text-indigo-700">
                            Assigned {vehicle.active_booking_ref ? `(${vehicle.active_booking_ref})` : ''}
                          </span>
                        ) : (
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                              vehicle.operational_status === 'active'
                                ? 'bg-emerald-50 text-emerald-700'
                                : vehicle.operational_status === 'maintenance'
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {vehicle.operational_status}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setVehicleForm({
                              vehicle_id: vehicle.id,
                              category_id: vehicle.category_id,
                              display_name: vehicle.display_name,
                              registration_number: vehicle.registration_number ?? '',
                              operational_status: vehicle.operational_status,
                            })
                          }
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Vehicle Categories Form & List */}
          <div className="space-y-4">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void save(
                  {
                    action: 'save_category',
                    category_id: categoryForm.category_id || null,
                    code: categoryForm.code,
                    display_name: categoryForm.display_name,
                    max_passengers: Number(categoryForm.max_passengers),
                    max_luggage: Number(categoryForm.max_luggage),
                    is_active: categoryForm.is_active,
                  },
                  categoryForm.category_id ? 'Vehicle category updated.' : 'Vehicle category created.'
                );
              }}
              className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-xs"
            >
              <h2 className="font-black text-slate-900 flex items-center gap-2">
                <Truck className="h-4 w-4 text-amber-600" />
                Vehicle Categories
              </h2>
              <select
                value={categoryForm.category_id}
                onChange={(event) => {
                  const selected = categories.find((category) => category.id === event.target.value);
                  setCategoryForm(
                    selected
                      ? {
                          category_id: selected.id,
                          code: selected.code,
                          display_name: selected.display_name,
                          max_passengers: String(selected.max_passengers),
                          max_luggage: String(selected.max_luggage),
                          is_active: selected.is_active,
                        }
                      : {
                          category_id: '',
                          code: '',
                          display_name: '',
                          max_passengers: '3',
                          max_luggage: '2',
                          is_active: true,
                        }
                  );
                }}
                className="w-full rounded-xl border border-slate-200 p-3 text-sm"
              >
                <option value="">+ Create new category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    Edit: {category.display_name} ({category.code})
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Category Code</label>
                  <input
                    required
                    pattern="[a-z][a-z0-9_]{1,39}"
                    value={categoryForm.code}
                    onChange={(event) => setCategoryForm({ ...categoryForm, code: event.target.value })}
                    placeholder="e.g. sedan, luxury_van"
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Display Name</label>
                  <input
                    required
                    minLength={2}
                    maxLength={80}
                    value={categoryForm.display_name}
                    onChange={(event) => setCategoryForm({ ...categoryForm, display_name: event.target.value })}
                    placeholder="e.g. Luxury Van / KDH"
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Max Passengers</label>
                  <input
                    required
                    type="number"
                    min={1}
                    max={50}
                    value={categoryForm.max_passengers}
                    onChange={(event) => setCategoryForm({ ...categoryForm, max_passengers: event.target.value })}
                    aria-label="Maximum passengers"
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Max Luggage</label>
                  <input
                    required
                    type="number"
                    min={0}
                    max={50}
                    value={categoryForm.max_luggage}
                    onChange={(event) => setCategoryForm({ ...categoryForm, max_luggage: event.target.value })}
                    aria-label="Maximum luggage"
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={categoryForm.is_active}
                  onChange={(event) => setCategoryForm({ ...categoryForm, is_active: event.target.checked })}
                />
                Active for new customer bookings
              </label>
              <button
                disabled={busy}
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {categoryForm.category_id ? 'Update Category' : 'Save Category'}
              </button>
            </form>

            {/* Categories List */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-xs">
              <h3 className="text-sm font-black text-slate-900">
                Configured Categories ({categories.length})
              </h3>
              <div className="divide-y divide-slate-100">
                {categories.map((category) => (
                  <div key={category.id} className="flex items-center justify-between gap-3 py-3 text-xs">
                    <div>
                      <div className="font-bold text-slate-900">
                        {category.display_name}{' '}
                        <span className="font-mono text-[11px] text-slate-400">({category.code})</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Max {category.max_passengers} passenger(s) · {category.max_luggage} bag(s)
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                          category.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {category.is_active ? 'active' : 'inactive'}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setCategoryForm({
                            category_id: category.id,
                            code: category.code,
                            display_name: category.display_name,
                            max_passengers: String(category.max_passengers),
                            max_luggage: String(category.max_luggage),
                            is_active: category.is_active,
                          })
                        }
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Add / Edit Driver Modal */}
      {driverModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div>
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-blue-600" />
                  {driverForm.driver_id ? 'Edit Driver Record' : 'Add New Internal Driver'}
                </h2>
                <p className="text-xs text-slate-500">
                  Internal operational record — no driver login email or password required.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDriverModalOpen(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={(e) => void handleSaveDriver(e)} className="p-6 space-y-4 overflow-y-auto text-xs">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block font-extrabold text-slate-700 mb-1">
                    Driver Full Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    required
                    minLength={2}
                    maxLength={120}
                    value={driverForm.full_name}
                    onChange={(e) => setDriverForm({ ...driverForm, full_name: e.target.value })}
                    placeholder="e.g. Kamal Perera"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-extrabold text-slate-700 mb-1">
                    Phone / WhatsApp Number <span className="text-red-600">*</span>
                  </label>
                  <input
                    required
                    minLength={7}
                    maxLength={30}
                    value={driverForm.phone}
                    onChange={(e) => setDriverForm({ ...driverForm, phone: e.target.value })}
                    placeholder="e.g. +94 77 123 4567"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block font-extrabold text-slate-700 mb-1">
                    License Number / Tier (Optional)
                  </label>
                  <input
                    maxLength={80}
                    value={driverForm.license_number}
                    onChange={(e) => setDriverForm({ ...driverForm, license_number: e.target.value })}
                    placeholder="e.g. B1234567 / Tourist Guide"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-extrabold text-slate-700 mb-1">Driver Status</label>
                  <select
                    value={driverForm.account_status}
                    onChange={(e) =>
                      setDriverForm({
                        ...driverForm,
                        account_status: e.target.value as 'active' | 'inactive',
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
                  >
                    <option value="active">Active (Available for Dispatch)</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-extrabold text-slate-700 mb-1">
                  Notes / Languages Spoken (Optional)
                </label>
                <input
                  maxLength={500}
                  value={driverForm.driver_notes}
                  onChange={(e) => setDriverForm({ ...driverForm, driver_notes: e.target.value })}
                  placeholder="e.g. Speaks English & Sinhala, experienced in Round Tours"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              {/* Vehicle Linking / Creation Box */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="font-extrabold text-slate-800">
                  Assigned / Default Vehicle (Optional)
                </div>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { id: 'existing', label: 'Select Existing Vehicle' },
                      { id: 'new', label: '+ Create & Link New Vehicle' },
                      { id: 'none', label: 'No Default Vehicle' },
                    ] as const
                  ).map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setDriverForm({ ...driverForm, vehicle_mode: mode.id })}
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                        driverForm.vehicle_mode === mode.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>

                {driverForm.vehicle_mode === 'existing' && (
                  <div>
                    <select
                      value={driverForm.default_vehicle_id}
                      onChange={(e) => setDriverForm({ ...driverForm, default_vehicle_id: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900"
                    >
                      <option value="">-- Choose an existing fleet vehicle --</option>
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.display_name} ({v.registration_number || 'No reg'}) · {v.category_name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {driverForm.vehicle_mode === 'new' && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Category <span className="text-red-600">*</span>
                      </label>
                      <select
                        required
                        value={driverForm.new_vehicle_category_id}
                        onChange={(e) =>
                          setDriverForm({ ...driverForm, new_vehicle_category_id: e.target.value })
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                      >
                        <option value="">Select category</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.display_name} ({c.max_passengers} pax)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Vehicle Model / Name <span className="text-red-600">*</span>
                      </label>
                      <input
                        required
                        minLength={2}
                        maxLength={120}
                        value={driverForm.new_vehicle_name}
                        onChange={(e) =>
                          setDriverForm({ ...driverForm, new_vehicle_name: e.target.value })
                        }
                        placeholder="e.g. Toyota Prius / KDH"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Registration No.
                      </label>
                      <input
                        maxLength={40}
                        value={driverForm.new_vehicle_registration}
                        onChange={(e) =>
                          setDriverForm({ ...driverForm, new_vehicle_registration: e.target.value })
                        }
                        placeholder="e.g. WP CAA-1234"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setDriverModalOpen(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-black text-white shadow-xs hover:bg-blue-700 disabled:opacity-50"
                >
                  {busy
                    ? 'Saving…'
                    : driverForm.driver_id
                      ? 'Save Driver Changes'
                      : 'Create Driver Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
