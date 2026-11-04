'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw } from 'lucide-react';

type Rule = { id: string; category_id: string | null; rule_type: string; unit: string; amount: number; min_quantity: number | null; max_quantity: number | null; is_active: boolean };
type Package = { id: string; code: string; name: string; service_type: string; currency: 'LKR' | 'USD'; is_active: boolean; valid_from: string | null; valid_until: string | null; rules: Rule[] };
type Category = { id: string; display_name: string };
const SERVICES = ['airport_transfer', 'day_trip', 'round_tour', 'vehicle_hire', 'custom'];

function localDateTime(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}

export default function PricingPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [packageForm, setPackageForm] = useState({ package_id: '', code: '', name: '', service_type: 'airport_transfer', currency: 'LKR', is_active: true, valid_from: '', valid_until: '' });
  const [ruleForm, setRuleForm] = useState({ rule_id: '', package_id: '', category_id: '', rule_type: '', unit: 'booking', amount: '', min_quantity: '', max_quantity: '', is_active: true });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const [priceResponse, fleetResponse] = await Promise.all([
        fetch('/api/admin/pricing', { cache: 'no-store' }),
        fetch('/api/admin/fleet', { cache: 'no-store' }),
      ]);
      const priceResult = await priceResponse.json() as { success?: boolean; error?: string; data?: Package[] };
      const fleetResult = await fleetResponse.json() as { success?: boolean; error?: string; data?: { categories: Category[] } };
      if (!priceResponse.ok || !priceResult.success || !priceResult.data) throw new Error(priceResult.error || 'Pricing configuration could not be loaded.');
      if (!fleetResponse.ok || !fleetResult.success || !fleetResult.data) throw new Error(fleetResult.error || 'Vehicle categories could not be loaded.');
      setPackages(priceResult.data);
      setCategories(fleetResult.data.categories);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Pricing configuration could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function save(body: Record<string, unknown>) {
    setBusy(true);
    setNotice('');
    try {
      const response = await fetch('/api/admin/pricing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json() as { success?: boolean; error?: string };
      if (!response.ok || !result.success) throw new Error(result.error || 'Pricing item could not be saved.');
      setNotice('Pricing item saved.');
      await load();
    } catch (saveError) {
      setNotice(saveError instanceof Error ? saveError.message : 'Pricing item could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between gap-4">
          <div><Link href="/admin/dashboard" className="inline-flex items-center gap-1 text-xs font-bold text-blue-700"><ArrowLeft className="h-4 w-4" />Operations</Link><h1 className="mt-2 text-2xl font-black text-slate-900">Pricing management</h1><p className="text-sm text-slate-500">The quote engine reads active package and rule data; customer-provided totals are never used.</p></div>
          <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white"><RefreshCw className="h-4 w-4" />Refresh</button>
        </header>
        {error && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        {notice && <p className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900" aria-live="polite">{notice}</p>}

        <section className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={(event) => {
            event.preventDefault();
            void save({
              action: 'save_package',
              package_id: packageForm.package_id || null,
              code: packageForm.code,
              name: packageForm.name,
              service_type: packageForm.service_type,
              currency: packageForm.currency,
              is_active: packageForm.is_active,
              valid_from: packageForm.valid_from ? new Date(packageForm.valid_from).toISOString() : null,
              valid_until: packageForm.valid_until ? new Date(packageForm.valid_until).toISOString() : null,
            });
          }} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <h2 className="font-extrabold">Pricing package</h2>
            <select value={packageForm.package_id} onChange={(event) => {
              const selected = packages.find((item) => item.id === event.target.value);
              setPackageForm(selected
                ? { package_id: selected.id, code: selected.code, name: selected.name, service_type: selected.service_type, currency: selected.currency, is_active: selected.is_active, valid_from: localDateTime(selected.valid_from), valid_until: localDateTime(selected.valid_until) }
                : { package_id: '', code: '', name: '', service_type: 'airport_transfer', currency: 'LKR', is_active: true, valid_from: '', valid_until: '' });
            }} className="w-full rounded-xl border border-slate-200 p-3 text-sm">
              <option value="">Create new package</option>{packages.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.service_type} · {item.currency}</option>)}
            </select>
            <div className="grid sm:grid-cols-2 gap-3">
              <input required pattern="[A-Za-z0-9_-]{2,60}" value={packageForm.code} onChange={(event) => setPackageForm({ ...packageForm, code: event.target.value })} placeholder="Unique package code" className="rounded-xl border border-slate-200 p-3 text-sm" />
              <input required minLength={2} maxLength={120} value={packageForm.name} onChange={(event) => setPackageForm({ ...packageForm, name: event.target.value })} placeholder="Package name" className="rounded-xl border border-slate-200 p-3 text-sm" />
              <select value={packageForm.service_type} onChange={(event) => setPackageForm({ ...packageForm, service_type: event.target.value })} className="rounded-xl border border-slate-200 p-3 text-sm">{SERVICES.map((service) => <option key={service} value={service}>{service.replaceAll('_', ' ')}</option>)}</select>
              <select value={packageForm.currency} onChange={(event) => setPackageForm({ ...packageForm, currency: event.target.value })} className="rounded-xl border border-slate-200 p-3 text-sm"><option value="LKR">LKR</option><option value="USD">USD</option></select>
              <label className="text-xs text-slate-500">Valid from<input type="datetime-local" value={packageForm.valid_from} onChange={(event) => setPackageForm({ ...packageForm, valid_from: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-900" /></label>
              <label className="text-xs text-slate-500">Valid until<input type="datetime-local" value={packageForm.valid_until} onChange={(event) => setPackageForm({ ...packageForm, valid_until: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-900" /></label>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={packageForm.is_active} onChange={(event) => setPackageForm({ ...packageForm, is_active: event.target.checked })} /> Active</label>
            <button disabled={busy} className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">Save package</button>
          </form>

          <form onSubmit={(event) => {
            event.preventDefault();
            void save({
              action: 'save_rule',
              rule_id: ruleForm.rule_id || null,
              package_id: ruleForm.package_id,
              category_id: ruleForm.category_id || null,
              rule_type: ruleForm.rule_type,
              unit: ruleForm.unit,
              amount: ruleForm.amount,
              min_quantity: ruleForm.min_quantity || null,
              max_quantity: ruleForm.max_quantity || null,
              is_active: ruleForm.is_active,
            });
          }} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <h2 className="font-extrabold">Pricing rule</h2>
            <select value={ruleForm.rule_id} onChange={(event) => {
              const selected = packages.flatMap((item) => item.rules).find((rule) => rule.id === event.target.value);
              const selectedPackage = selected ? packages.find((item) => item.rules.some((rule) => rule.id === selected.id)) : null;
              setRuleForm(selected && selectedPackage
                ? { rule_id: selected.id, package_id: selectedPackage.id, category_id: selected.category_id ?? '', rule_type: selected.rule_type, unit: selected.unit, amount: String(selected.amount), min_quantity: selected.min_quantity === null ? '' : String(selected.min_quantity), max_quantity: selected.max_quantity === null ? '' : String(selected.max_quantity), is_active: selected.is_active }
                : { rule_id: '', package_id: '', category_id: '', rule_type: '', unit: 'booking', amount: '', min_quantity: '', max_quantity: '', is_active: true });
            }} className="w-full rounded-xl border border-slate-200 p-3 text-sm">
              <option value="">Create new rule</option>{packages.flatMap((item) => item.rules.map((rule) => <option key={rule.id} value={rule.id}>{item.name} · {rule.rule_type} ({rule.unit})</option>))}
            </select>
            <select required value={ruleForm.package_id} onChange={(event) => setRuleForm({ ...ruleForm, package_id: event.target.value })} className="w-full rounded-xl border border-slate-200 p-3 text-sm"><option value="">Choose package</option>{packages.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.currency}</option>)}</select>
            <select value={ruleForm.category_id} onChange={(event) => setRuleForm({ ...ruleForm, category_id: event.target.value })} className="w-full rounded-xl border border-slate-200 p-3 text-sm"><option value="">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.display_name}</option>)}</select>
            <div className="grid sm:grid-cols-2 gap-3">
              <input required minLength={2} maxLength={80} value={ruleForm.rule_type} onChange={(event) => setRuleForm({ ...ruleForm, rule_type: event.target.value })} placeholder="Rule name / charge type" className="rounded-xl border border-slate-200 p-3 text-sm" />
              <select value={ruleForm.unit} onChange={(event) => setRuleForm({ ...ruleForm, unit: event.target.value })} className="rounded-xl border border-slate-200 p-3 text-sm"><option value="booking">Per booking</option><option value="leg">Per leg</option><option value="passenger">Per passenger</option><option value="day">Per day</option></select>
              <input required inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" value={ruleForm.amount} onChange={(event) => setRuleForm({ ...ruleForm, amount: event.target.value })} placeholder="Unit amount" className="rounded-xl border border-slate-200 p-3 text-sm" />
              <input inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" value={ruleForm.min_quantity} onChange={(event) => setRuleForm({ ...ruleForm, min_quantity: event.target.value })} placeholder="Minimum quantity (optional)" className="rounded-xl border border-slate-200 p-3 text-sm" />
              <input inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" value={ruleForm.max_quantity} onChange={(event) => setRuleForm({ ...ruleForm, max_quantity: event.target.value })} placeholder="Maximum quantity (optional)" className="rounded-xl border border-slate-200 p-3 text-sm" />
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ruleForm.is_active} onChange={(event) => setRuleForm({ ...ruleForm, is_active: event.target.checked })} /> Active</label>
            <button disabled={busy} className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">Save rule</button>
          </form>
        </section>

        {loading ? <p className="text-sm text-slate-500">Loading pricing…</p> : packages.map((item) => (
          <article key={item.id} className="rounded-2xl bg-white border border-slate-200 p-5">
            <h2 className="font-extrabold">{item.name} · {item.currency}</h2>
            <p className="text-xs text-slate-500">{item.service_type.replaceAll('_', ' ')} · {item.code} · {item.is_active ? 'active' : 'inactive'}</p>
            <ul className="mt-3 space-y-1 text-sm">{item.rules.map((rule) => <li key={rule.id} className="flex justify-between gap-4 border-t border-slate-100 pt-2"><span>{rule.rule_type} · {rule.unit}{rule.category_id ? ` · ${categories.find((category) => category.id === rule.category_id)?.display_name ?? 'category'}` : ''} {rule.is_active ? '' : '(inactive)'}</span><b>{item.currency} {Number(rule.amount).toFixed(2)}</b></li>)}</ul>
          </article>
        ))}
      </div>
    </main>
  );
}
