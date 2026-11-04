'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw } from 'lucide-react';

type Category = { id: string; code: string; display_name: string; max_passengers: number; max_luggage: number; is_active: boolean };
type Vehicle = { id: string; category_id: string; category_name: string; display_name: string; registration_number: string | null; operational_status: string };

export default function FleetPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [categoryForm, setCategoryForm] = useState({ category_id: '', code: '', display_name: '', max_passengers: '3', max_luggage: '2', is_active: true });
  const [vehicleForm, setVehicleForm] = useState({ vehicle_id: '', category_id: '', display_name: '', registration_number: '', operational_status: 'active' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/fleet', { cache: 'no-store' });
      const result = await response.json() as { success?: boolean; error?: string; data?: { categories: Category[]; vehicles: Vehicle[] } };
      if (!response.ok || !result.success || !result.data) throw new Error(result.error || 'Fleet data could not be loaded.');
      setCategories(result.data.categories);
      setVehicles(result.data.vehicles);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Fleet data could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function save(body: Record<string, unknown>) {
    setBusy(true);
    setNotice('');
    try {
      const response = await fetch('/api/admin/fleet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json() as { success?: boolean; error?: string };
      if (!response.ok || !result.success) throw new Error(result.error || 'Fleet item could not be saved.');
      setNotice('Fleet item saved.');
      await load();
    } catch (saveError) {
      setNotice(saveError instanceof Error ? saveError.message : 'Fleet item could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between gap-4">
          <div><Link href="/admin/dashboard" className="inline-flex items-center gap-1 text-xs font-bold text-blue-700"><ArrowLeft className="h-4 w-4" />Operations</Link><h1 className="mt-2 text-2xl font-black text-slate-900">Fleet management</h1><p className="text-sm text-slate-500">Deactivate vehicles or categories instead of deleting records used in booking history.</p></div>
          <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white"><RefreshCw className="h-4 w-4" />Refresh</button>
        </header>
        {error && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        {notice && <p className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900" aria-live="polite">{notice}</p>}

        <section className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={(event) => { event.preventDefault(); void save({ action: 'save_category', category_id: categoryForm.category_id || null, code: categoryForm.code, display_name: categoryForm.display_name, max_passengers: Number(categoryForm.max_passengers), max_luggage: Number(categoryForm.max_luggage), is_active: categoryForm.is_active }); }} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <h2 className="font-extrabold">Vehicle categories</h2>
            <select value={categoryForm.category_id} onChange={(event) => {
              const selected = categories.find((category) => category.id === event.target.value);
              setCategoryForm(selected
                ? { category_id: selected.id, code: selected.code, display_name: selected.display_name, max_passengers: String(selected.max_passengers), max_luggage: String(selected.max_luggage), is_active: selected.is_active }
                : { category_id: '', code: '', display_name: '', max_passengers: '3', max_luggage: '2', is_active: true });
            }} className="w-full rounded-xl border border-slate-200 p-3 text-sm">
              <option value="">Create new category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.display_name} ({category.code})</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <input required pattern="[a-z][a-z0-9_]{1,39}" value={categoryForm.code} onChange={(event) => setCategoryForm({ ...categoryForm, code: event.target.value })} placeholder="code" className="rounded-xl border border-slate-200 p-3 text-sm" />
              <input required minLength={2} maxLength={80} value={categoryForm.display_name} onChange={(event) => setCategoryForm({ ...categoryForm, display_name: event.target.value })} placeholder="Display name" className="rounded-xl border border-slate-200 p-3 text-sm" />
              <input required type="number" min={1} max={50} value={categoryForm.max_passengers} onChange={(event) => setCategoryForm({ ...categoryForm, max_passengers: event.target.value })} aria-label="Maximum passengers" className="rounded-xl border border-slate-200 p-3 text-sm" />
              <input required type="number" min={0} max={50} value={categoryForm.max_luggage} onChange={(event) => setCategoryForm({ ...categoryForm, max_luggage: event.target.value })} aria-label="Maximum luggage" className="rounded-xl border border-slate-200 p-3 text-sm" />
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={categoryForm.is_active} onChange={(event) => setCategoryForm({ ...categoryForm, is_active: event.target.checked })} /> Active for new bookings</label>
            <button disabled={busy} className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">Save category</button>
          </form>

          <form onSubmit={(event) => { event.preventDefault(); void save({ action: 'save_vehicle', vehicle_id: vehicleForm.vehicle_id || null, category_id: vehicleForm.category_id, display_name: vehicleForm.display_name, registration_number: vehicleForm.registration_number, operational_status: vehicleForm.operational_status }); }} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <h2 className="font-extrabold">Vehicles</h2>
            <select value={vehicleForm.vehicle_id} onChange={(event) => {
              const selected = vehicles.find((vehicle) => vehicle.id === event.target.value);
              setVehicleForm(selected
                ? { vehicle_id: selected.id, category_id: selected.category_id, display_name: selected.display_name, registration_number: selected.registration_number ?? '', operational_status: selected.operational_status }
                : { vehicle_id: '', category_id: '', display_name: '', registration_number: '', operational_status: 'active' });
            }} className="w-full rounded-xl border border-slate-200 p-3 text-sm">
              <option value="">Create new vehicle</option>{vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.display_name} · {vehicle.operational_status}</option>)}
            </select>
            <select required value={vehicleForm.category_id} onChange={(event) => setVehicleForm({ ...vehicleForm, category_id: event.target.value })} className="w-full rounded-xl border border-slate-200 p-3 text-sm">
              <option value="">Select category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.display_name}</option>)}
            </select>
            <input required minLength={2} maxLength={120} value={vehicleForm.display_name} onChange={(event) => setVehicleForm({ ...vehicleForm, display_name: event.target.value })} placeholder="Vehicle name" className="w-full rounded-xl border border-slate-200 p-3 text-sm" />
            <input maxLength={40} value={vehicleForm.registration_number} onChange={(event) => setVehicleForm({ ...vehicleForm, registration_number: event.target.value })} placeholder="Registration number (optional)" className="w-full rounded-xl border border-slate-200 p-3 text-sm" />
            <select value={vehicleForm.operational_status} onChange={(event) => setVehicleForm({ ...vehicleForm, operational_status: event.target.value })} className="w-full rounded-xl border border-slate-200 p-3 text-sm">
              <option value="active">Active</option><option value="maintenance">Maintenance</option><option value="inactive">Inactive</option>
            </select>
            <button disabled={busy} className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">Save vehicle</button>
          </form>
        </section>

        {loading ? <p className="text-sm text-slate-500">Loading fleet…</p> : (
          <section className="grid gap-4 md:grid-cols-2">
            {categories.map((category) => <article key={category.id} className="rounded-2xl bg-white border border-slate-200 p-4 text-sm"><b>{category.display_name}</b> · {category.code}<p className="text-xs text-slate-500">{category.max_passengers} passenger(s) · {category.max_luggage} bag(s) · {category.is_active ? 'active' : 'inactive'}</p></article>)}
            {vehicles.map((vehicle) => <article key={vehicle.id} className="rounded-2xl bg-white border border-slate-200 p-4 text-sm"><b>{vehicle.display_name}</b> · {vehicle.category_name}<p className="text-xs text-slate-500">{vehicle.registration_number || 'No registration'} · {vehicle.operational_status}</p></article>)}
          </section>
        )}
      </div>
    </main>
  );
}
