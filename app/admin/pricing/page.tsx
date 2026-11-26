'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Calculator,
  Car,
  CheckCircle2,
  Edit3,
  FolderKanban,
  Layers,
  Lock,
  Plus,
  Power,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';

type PricingRule = {
  id: string;
  package_id?: string;
  category_id: string | null;
  category_name?: string | null;
  rule_type: string;
  unit: string;
  amount: number;
  min_quantity: number | null;
  max_quantity: number | null;
  is_active: boolean;
  created_at?: string;
};

type PricingPackage = {
  id: string;
  code: string;
  name: string;
  service_type: string;
  currency: 'LKR' | 'USD';
  is_active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  rules: PricingRule[];
};

type FlattenedRule = PricingRule & {
  package_id: string;
  package_code: string;
  package_name: string;
  package_active: boolean;
  service_type: string;
  currency: 'LKR' | 'USD';
  resolved_category_name: string;
};

type Category = {
  id: string;
  code?: string;
  display_name: string;
  max_passengers?: number;
  max_luggage?: number;
};

type QuotePreviewLine = {
  rule_id: string;
  rule_type: string;
  unit: string;
  category_id: string | null;
  category_name: string;
  quantity: number;
  unit_amount: number;
  line_total: number;
};

type QuotePreviewResult = {
  matched: boolean;
  currency: 'LKR' | 'USD';
  total: number | null;
  package: {
    id: string;
    code: string;
    name: string;
    service_type: string;
    currency: string;
  } | null;
  lines: QuotePreviewLine[];
  message: string;
};

type FilterTab = 'all' | 'active' | 'inactive' | 'USD' | 'LKR';

const SERVICE_OPTIONS = [
  { value: 'airport_transfer', label: 'Airport Transfer (Pickup / Drop)' },
  { value: 'day_trip', label: 'Day Trip' },
  { value: 'round_tour', label: 'Chauffeur Round Tour' },
  { value: 'vehicle_hire', label: 'Private Vehicle Hire / Point-to-Point' },
  { value: 'custom', label: 'Custom Journey' },
] as const;

const UNIT_OPTIONS = [
  { value: 'booking', label: 'Base Fare (Per Booking)' },
  { value: 'day', label: 'Per Day' },
  { value: 'km', label: 'Per KM / Extra Distance' },
  { value: 'passenger', label: 'Per Passenger' },
  { value: 'leg', label: 'Per Trip Leg' },
] as const;

function serviceLabel(value: string) {
  return SERVICE_OPTIONS.find((s) => s.value === value)?.label ?? value.replaceAll('_', ' ');
}

function unitLabel(value: string) {
  switch (value) {
    case 'booking':
      return 'Per Booking';
    case 'day':
      return 'Per Day';
    case 'km':
      return 'Per KM';
    case 'passenger':
      return 'Per Passenger';
    case 'leg':
      return 'Per Leg';
    default:
      return value;
  }
}

function formatMoney(currency: string, amount: number | string) {
  const num = Number(amount);
  if (!Number.isFinite(num)) return `${currency} ${amount}`;
  return `${currency} ${num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function localDateTime(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}

export default function PricingPage() {
  const [packages, setPackages] = useState<PricingPackage[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Search & Filter
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');

  // Add/Edit Rule Modal State
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [ruleForm, setRuleForm] = useState({
    rule_id: '',
    package_id: '',
    category_id: '',
    rule_type: '',
    unit: 'booking',
    amount: '',
    min_quantity: '',
    max_quantity: '',
    is_active: true,
  });
  const [savingRule, setSavingRule] = useState(false);

  // Manage Packages Modal State
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [packageForm, setPackageForm] = useState({
    package_id: '',
    code: '',
    name: '',
    service_type: 'airport_transfer',
    currency: 'LKR' as 'LKR' | 'USD',
    is_active: true,
    valid_from: '',
    valid_until: '',
  });
  const [savingPackage, setSavingPackage] = useState(false);

  // Live Rate Calculator Simulator State
  const [simService, setSimService] = useState('airport_transfer');
  const [simCategoryId, setSimCategoryId] = useState('');
  const [simCurrency, setSimCurrency] = useState<'LKR' | 'USD'>('LKR');
  const [simDays, setSimDays] = useState('1');
  const [simPassengers, setSimPassengers] = useState('2');
  const [simLegs, setSimLegs] = useState('1');
  const [simKm, setSimKm] = useState('0');
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState<QuotePreviewResult | null>(null);
  const [simError, setSimError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [priceResponse, fleetResponse] = await Promise.all([
        fetch('/api/admin/pricing', { cache: 'no-store' }),
        fetch('/api/admin/fleet', { cache: 'no-store' }),
      ]);
      const priceResult = (await priceResponse.json()) as {
        success?: boolean;
        error?: string;
        data?: PricingPackage[];
        can_manage?: boolean;
        roles?: string[];
      };
      const fleetResult = (await fleetResponse.json()) as {
        success?: boolean;
        error?: string;
        data?: { categories: Category[] };
      };
      if (!priceResponse.ok || !priceResult.success || !priceResult.data) {
        throw new Error(priceResult.error || 'Pricing configuration could not be loaded.');
      }
      if (!fleetResponse.ok || !fleetResult.success || !fleetResult.data) {
        throw new Error(fleetResult.error || 'Vehicle categories could not be loaded.');
      }
      setPackages(priceResult.data);
      setCategories(fleetResult.data.categories);
      setCanManage(
        Boolean(priceResult.can_manage ?? priceResult.roles?.includes('super_admin'))
      );
      setError('');
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Pricing configuration could not be loaded.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c.display_name])),
    [categories]
  );

  // Flatten all rules with parent package metadata & readable category names
  const allRules = useMemo<FlattenedRule[]>(() => {
    return packages.flatMap((pkg) =>
      pkg.rules.map((rule) => ({
        ...rule,
        package_id: pkg.id,
        package_code: pkg.code,
        package_name: pkg.name,
        package_active: pkg.is_active,
        service_type: pkg.service_type,
        currency: pkg.currency,
        resolved_category_name: rule.category_id
          ? rule.category_name || categoryMap.get(rule.category_id) || 'Specific Vehicle Category'
          : 'All Vehicle Categories',
      }))
    );
  }, [packages, categoryMap]);

  // KPI Metrics
  const kpis = useMemo(() => {
    const total = allRules.length;
    const active = allRules.filter((r) => r.is_active && r.package_active).length;
    const lkr = allRules.filter((r) => r.currency === 'LKR').length;
    const usd = allRules.filter((r) => r.currency === 'USD').length;
    return { total, active, lkr, usd };
  }, [allRules]);

  // Filtered rules
  const filteredRules = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return allRules.filter((rule) => {
      if (filterTab === 'active' && !(rule.is_active && rule.package_active)) return false;
      if (filterTab === 'inactive' && rule.is_active && rule.package_active) return false;
      if (filterTab === 'USD' && rule.currency !== 'USD') return false;
      if (filterTab === 'LKR' && rule.currency !== 'LKR') return false;

      if (!needle) return true;
      return [
        rule.rule_type,
        rule.package_name,
        rule.package_code,
        serviceLabel(rule.service_type),
        rule.service_type,
        rule.resolved_category_name,
        rule.currency,
        unitLabel(rule.unit),
      ].some((field) => field.toLowerCase().includes(needle));
    });
  }, [allRules, filterTab, search]);

  function openNewRuleModal() {
    setError('');
    setNotice('');
    setRuleForm({
      rule_id: '',
      package_id: packages[0]?.id ?? '',
      category_id: '',
      rule_type: '',
      unit: 'booking',
      amount: '',
      min_quantity: '',
      max_quantity: '',
      is_active: true,
    });
    setShowRuleModal(true);
  }

  function openEditRuleModal(rule: FlattenedRule) {
    setError('');
    setNotice('');
    setRuleForm({
      rule_id: rule.id,
      package_id: rule.package_id,
      category_id: rule.category_id ?? '',
      rule_type: rule.rule_type,
      unit: rule.unit,
      amount: String(rule.amount),
      min_quantity: rule.min_quantity === null ? '' : String(rule.min_quantity),
      max_quantity: rule.max_quantity === null ? '' : String(rule.max_quantity),
      is_active: rule.is_active,
    });
    setShowRuleModal(true);
  }

  function openPackageModal(pkg?: PricingPackage) {
    setError('');
    setNotice('');
    if (pkg) {
      setPackageForm({
        package_id: pkg.id,
        code: pkg.code,
        name: pkg.name,
        service_type: pkg.service_type,
        currency: pkg.currency,
        is_active: pkg.is_active,
        valid_from: localDateTime(pkg.valid_from),
        valid_until: localDateTime(pkg.valid_until),
      });
    } else {
      setPackageForm({
        package_id: '',
        code: '',
        name: '',
        service_type: 'airport_transfer',
        currency: 'LKR',
        is_active: true,
        valid_from: '',
        valid_until: '',
      });
    }
    setShowPackageModal(true);
  }

  async function submitRule(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');

    if (!ruleForm.package_id) {
      setError('Select a pricing package first (or create one in Manage Packages).');
      return;
    }
    const amt = Number(ruleForm.amount);
    if (!Number.isFinite(amt) || amt < 0) {
      setError('Enter a valid non-negative rate amount.');
      return;
    }
    const minQ = ruleForm.min_quantity.trim() ? Number(ruleForm.min_quantity) : null;
    const maxQ = ruleForm.max_quantity.trim() ? Number(ruleForm.max_quantity) : null;
    if ((minQ !== null && minQ < 0) || (maxQ !== null && maxQ < 0)) {
      setError('Minimum and maximum quantity must be 0 or greater.');
      return;
    }
    if (minQ !== null && maxQ !== null && maxQ < minQ) {
      setError('Maximum quantity must be greater than or equal to minimum quantity.');
      return;
    }

    setSavingRule(true);
    try {
      const response = await fetch('/api/admin/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_rule',
          rule_id: ruleForm.rule_id || null,
          package_id: ruleForm.package_id,
          category_id: ruleForm.category_id || null,
          rule_type: ruleForm.rule_type.trim(),
          unit: ruleForm.unit,
          amount: amt.toFixed(2),
          min_quantity: minQ,
          max_quantity: maxQ,
          is_active: ruleForm.is_active,
        }),
      });
      const result = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Pricing rule could not be saved.');
      }
      setShowRuleModal(false);
      setNotice(ruleForm.rule_id ? 'Pricing rule updated.' : 'New pricing rule created.');
      await load();
    } catch (saveErr) {
      setError(saveErr instanceof Error ? saveErr.message : 'Pricing rule could not be saved.');
    } finally {
      setSavingRule(false);
    }
  }

  async function toggleRuleActive(rule: FlattenedRule) {
    setBusyId(rule.id);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_rule',
          rule_id: rule.id,
          package_id: rule.package_id,
          category_id: rule.category_id,
          rule_type: rule.rule_type,
          unit: rule.unit,
          amount: Number(rule.amount).toFixed(2),
          min_quantity: rule.min_quantity,
          max_quantity: rule.max_quantity,
          is_active: !rule.is_active,
        }),
      });
      const result = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Could not update rule status.');
      }
      setNotice(
        `Rule "${rule.rule_type}" is now ${!rule.is_active ? 'Active' : 'Inactive'}.`
      );
      await load();
    } catch (toggleErr) {
      setError(toggleErr instanceof Error ? toggleErr.message : 'Could not update rule status.');
    } finally {
      setBusyId('');
    }
  }

  async function deleteRule(rule: FlattenedRule) {
    if (
      !window.confirm(
        `Delete pricing rule "${rule.rule_type}" (${formatMoney(rule.currency, rule.amount)})? Historical issued quotes will remain unaffected.`
      )
    ) {
      return;
    }
    setBusyId(rule.id);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_rule', rule_id: rule.id }),
      });
      const result = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Pricing rule could not be deleted.');
      }
      setNotice(`Pricing rule "${rule.rule_type}" deleted.`);
      await load();
    } catch (delErr) {
      setError(delErr instanceof Error ? delErr.message : 'Pricing rule could not be deleted.');
    } finally {
      setBusyId('');
    }
  }

  async function submitPackage(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (
      packageForm.valid_from &&
      packageForm.valid_until &&
      Date.parse(packageForm.valid_until) <= Date.parse(packageForm.valid_from)
    ) {
      setError('Valid Until date must be after Valid From date.');
      return;
    }
    setSavingPackage(true);
    try {
      const response = await fetch('/api/admin/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_package',
          package_id: packageForm.package_id || null,
          code: packageForm.code.trim(),
          name: packageForm.name.trim(),
          service_type: packageForm.service_type,
          currency: packageForm.currency,
          is_active: packageForm.is_active,
          valid_from: packageForm.valid_from ? new Date(packageForm.valid_from).toISOString() : null,
          valid_until: packageForm.valid_until
            ? new Date(packageForm.valid_until).toISOString()
            : null,
        }),
      });
      const result = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Pricing package could not be saved.');
      }
      setNotice(
        packageForm.package_id ? 'Pricing package updated.' : 'New pricing package created.'
      );
      setPackageForm({
        package_id: '',
        code: '',
        name: '',
        service_type: 'airport_transfer',
        currency: 'LKR',
        is_active: true,
        valid_from: '',
        valid_until: '',
      });
      await load();
    } catch (pkgErr) {
      setError(pkgErr instanceof Error ? pkgErr.message : 'Pricing package could not be saved.');
    } finally {
      setSavingPackage(false);
    }
  }

  async function deletePackage(pkg: PricingPackage) {
    if (pkg.rules.length > 0) {
      setError(`Remove the ${pkg.rules.length} rule(s) inside "${pkg.name}" before deleting it.`);
      return;
    }
    if (!window.confirm(`Delete pricing package "${pkg.name}" (${pkg.code})?`)) return;
    setBusyId(pkg.id);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_package', package_id: pkg.id }),
      });
      const result = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Pricing package could not be deleted.');
      }
      setNotice(`Pricing package "${pkg.name}" deleted.`);
      await load();
    } catch (delErr) {
      setError(delErr instanceof Error ? delErr.message : 'Pricing package could not be deleted.');
    } finally {
      setBusyId('');
    }
  }

  async function runQuoteSimulation(event: React.FormEvent) {
    event.preventDefault();
    setSimLoading(true);
    setSimError('');
    try {
      const response = await fetch('/api/admin/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'preview_quote',
          service_type: simService,
          category_id: simCategoryId || null,
          currency: simCurrency,
          days: Math.max(1, Number(simDays) || 1),
          passengers: Math.max(1, Math.round(Number(simPassengers) || 1)),
          legs: Math.max(1, Math.round(Number(simLegs) || 1)),
          km: Math.max(0, Number(simKm) || 0),
        }),
      });
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        data?: QuotePreviewResult;
      };
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || 'Quote simulation failed.');
      }
      setSimResult(result.data);
    } catch (err) {
      setSimError(err instanceof Error ? err.message : 'Quote simulation failed.');
      setSimResult(null);
    } finally {
      setSimLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Pricing &amp; Rate Management
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage LKR &amp; USD pricing packages and vehicle rate rules used by the Bookings Quotation Calculator.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/fleet#vehicle-categories"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
          >
            <Car className="h-4 w-4 text-slate-500" />
            Vehicle Categories
          </Link>

          {canManage && (
            <button
              type="button"
              onClick={() => openPackageModal()}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              <FolderKanban className="h-4 w-4 text-blue-600" />
              Packages ({packages.length})
            </button>
          )}

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {canManage && (
            <button
              type="button"
              onClick={openNewRuleModal}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-blue-700 px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-blue-800 transition"
            >
              <Plus className="h-4 w-4" />
              Add Pricing Rule
            </button>
          )}
        </div>
      </header>

      {/* Read-Only Notice for Standard Admin */}
      {!loading && !canManage && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-medium text-amber-950">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div>
            <span className="font-extrabold">Read-Only Mode (Admin Role):</span> You can inspect all active and
            inactive pricing rules, run the live Test Rate Calculator below, and apply active rules in{' '}
            <Link href="/admin/bookings" className="font-bold underline">
              Bookings Quotations
            </Link>
            . Only a <strong>Super Admin</strong> can create, edit, toggle, or delete pricing rules.
          </div>
        </div>
      )}

      {/* Alerts */}
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800"
        >
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </span>
          <button
            type="button"
            onClick={() => setError('')}
            className="rounded-lg p-1 text-rose-700 hover:bg-rose-100"
            aria-label="Dismiss error"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {notice && (
        <div
          aria-live="polite"
          className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> {notice}
          </span>
          <button
            type="button"
            onClick={() => setNotice('')}
            className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-100"
            aria-label="Dismiss notice"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* KPI Summary Cards */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Rules</p>
          <p className="mt-1 text-2xl font-black text-slate-900">{kpis.total}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">{packages.length} package(s)</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Active Rules</p>
          <p className="mt-1 text-2xl font-black text-emerald-950">{kpis.active}</p>
          <p className="mt-0.5 text-[11px] text-emerald-700">Live in quote engine</p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-800">LKR Rules</p>
          <p className="mt-1 text-2xl font-black text-blue-950">{kpis.lkr}</p>
          <p className="mt-0.5 text-[11px] text-blue-700">Sri Lankan Rupee</p>
        </div>
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-800">USD Rules</p>
          <p className="mt-1 text-2xl font-black text-indigo-950">{kpis.usd}</p>
          <p className="mt-0.5 text-[11px] text-indigo-700">US Dollar</p>
        </div>
      </section>

      {/* Live Quote Test Simulator Card */}
      <section className="rounded-2xl border border-blue-200 bg-gradient-to-br from-white to-blue-50/40 p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Calculator className="h-4 w-4 text-blue-700" />
              Test Rate Calculator (Live Quote Simulator)
            </h2>
            <p className="text-xs text-slate-500">
              Preview the exact server-side quote calculated from your active rules before issuing real customer quotes.
            </p>
          </div>
        </div>

        <form onSubmit={(e) => void runQuoteSimulation(e)} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6 items-end">
          <label className="block text-xs font-bold text-slate-700 lg:col-span-2">
            Service Type
            <select
              value={simService}
              onChange={(e) => setSimService(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs font-semibold text-slate-900"
            >
              {SERVICE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-bold text-slate-700 lg:col-span-2">
            Vehicle Category
            <select
              value={simCategoryId}
              onChange={(e) => setSimCategoryId(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs font-semibold text-slate-900"
            >
              <option value="">Any / All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.display_name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-bold text-slate-700">
            Currency
            <select
              value={simCurrency}
              onChange={(e) => setSimCurrency(e.target.value as 'LKR' | 'USD')}
              className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs font-bold text-slate-900"
            >
              <option value="LKR">LKR</option>
              <option value="USD">USD</option>
            </select>
          </label>

          <label className="block text-xs font-bold text-slate-700">
            Days
            <input
              type="number"
              min="1"
              max="365"
              value={simDays}
              onChange={(e) => setSimDays(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs font-bold text-slate-900"
            />
          </label>

          <label className="block text-xs font-bold text-slate-700">
            Passengers
            <input
              type="number"
              min="1"
              max="50"
              value={simPassengers}
              onChange={(e) => setSimPassengers(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs font-bold text-slate-900"
            />
          </label>

          <label className="block text-xs font-bold text-slate-700">
            Legs
            <input
              type="number"
              min="1"
              max="20"
              value={simLegs}
              onChange={(e) => setSimLegs(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs font-bold text-slate-900"
            />
          </label>

          <label className="block text-xs font-bold text-slate-700">
            Extra KM (Optional)
            <input
              type="number"
              min="0"
              max="50000"
              value={simKm}
              onChange={(e) => setSimKm(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs font-bold text-slate-900"
            />
          </label>

          <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
            <button
              type="submit"
              disabled={simLoading}
              className="w-full sm:w-auto inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-black text-white hover:bg-slate-800 disabled:opacity-50 transition"
            >
              <Calculator className="h-4 w-4" />
              {simLoading ? 'Calculating…' : 'Calculate Quote Preview'}
            </button>
          </div>
        </form>

        {simError && (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
            {simError}
          </p>
        )}

        {simResult && (
          <div
            aria-live="polite"
            className={`rounded-2xl border p-4 text-xs space-y-3 ${
              simResult.matched
                ? 'border-emerald-200 bg-emerald-50/70'
                : 'border-amber-200 bg-amber-50/70'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className={`font-extrabold ${simResult.matched ? 'text-emerald-950' : 'text-amber-950'}`}>
                  {simResult.message}
                </p>
                {simResult.package && (
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Matched Package: <strong>{simResult.package.name}</strong> ({simResult.package.code})
                  </p>
                )}
              </div>
              {simResult.matched && simResult.total !== null && (
                <div className="rounded-xl bg-emerald-700 px-4 py-2 text-right text-white shadow-sm">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-100">
                    Calculated Quote
                  </span>
                  <span className="text-lg font-black">
                    {formatMoney(simResult.currency, simResult.total)}
                  </span>
                </div>
              )}
            </div>

            {simResult.lines.length > 0 && (
              <div className="rounded-xl border border-emerald-200/80 bg-white divide-y divide-slate-100">
                {simResult.lines.map((line) => (
                  <div key={line.rule_id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <div>
                      <span className="font-bold text-slate-900">{line.rule_type}</span>
                      <span className="ml-2 text-slate-500">
                        ({line.category_name} · {line.quantity} × {formatMoney(simResult.currency, line.unit_amount)} / {line.unit})
                      </span>
                    </div>
                    <span className="font-extrabold text-slate-900">
                      {formatMoney(simResult.currency, line.line_total)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Search & Filter Bar */}
      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rule name, package, service type, or vehicle category…"
            className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-9 pr-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(['all', 'active', 'inactive', 'USD', 'LKR'] as FilterTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilterTab(tab)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                filterTab === tab
                  ? 'bg-blue-700 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab === 'all'
                ? 'All'
                : tab === 'active'
                  ? 'Active'
                  : tab === 'inactive'
                    ? 'Inactive'
                    : tab}
            </button>
          ))}
        </div>
      </section>

      {/* Pricing Rules List: Desktop Table & Mobile Cards */}
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Loading pricing rules…
        </div>
      ) : filteredRules.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center space-y-2">
          <Layers className="mx-auto h-8 w-8 text-slate-300" />
          <p className="text-sm font-bold text-slate-800">No pricing rules match your current filter.</p>
          <p className="text-xs text-slate-500">
            {allRules.length === 0 && canManage
              ? 'Click "Add Pricing Rule" above to configure your first vehicle rate rule.'
              : 'Try clearing your search or switching filter tabs.'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Rule &amp; Service Type</th>
                  <th className="px-4 py-3">Vehicle Category</th>
                  <th className="px-4 py-3">Currency</th>
                  <th className="px-4 py-3">Rate &amp; Unit</th>
                  <th className="px-4 py-3">Qty Bounds</th>
                  <th className="px-4 py-3">Status</th>
                  {canManage && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRules.map((rule) => {
                  const effectivelyActive = rule.is_active && rule.package_active;
                  return (
                    <tr key={rule.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3.5">
                        <p className="font-extrabold text-slate-900">{rule.rule_type}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {serviceLabel(rule.service_type)} · <span className="font-semibold">{rule.package_name}</span> ({rule.package_code})
                        </p>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-800">
                        {rule.resolved_category_name}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black ring-1 ring-inset ${
                            rule.currency === 'USD'
                              ? 'bg-emerald-50 text-emerald-800 ring-emerald-600/20'
                              : 'bg-blue-50 text-blue-800 ring-blue-600/20'
                          }`}
                        >
                          {rule.currency}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-black text-slate-900">
                          {formatMoney(rule.currency, rule.amount)}
                        </p>
                        <p className="text-[11px] text-slate-500">{unitLabel(rule.unit)}</p>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {rule.min_quantity === null && rule.max_quantity === null
                          ? 'Any'
                          : `${rule.min_quantity ?? '0'} – ${rule.max_quantity ?? '∞'}`}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset ${
                            effectivelyActive
                              ? 'bg-emerald-50 text-emerald-800 ring-emerald-600/20'
                              : 'bg-slate-100 text-slate-600 ring-slate-400/20'
                          }`}
                        >
                          {effectivelyActive
                            ? 'Active'
                            : !rule.package_active
                              ? 'Pkg Inactive'
                              : 'Inactive'}
                        </span>
                      </td>
                      {canManage && (
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditRuleModal(rule)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
                            >
                              <Edit3 className="h-3.5 w-3.5" /> Edit
                            </button>
                            <button
                              type="button"
                              disabled={busyId === rule.id}
                              onClick={() => void toggleRuleActive(rule)}
                              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold disabled:opacity-50 ${
                                rule.is_active
                                  ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                                  : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                              }`}
                            >
                              <Power className="h-3.5 w-3.5" />
                              {rule.is_active ? 'Disable' : 'Enable'}
                            </button>
                            <button
                              type="button"
                              disabled={busyId === rule.id}
                              onClick={() => void deleteRule(rule)}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Delete
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards (360px - 430px friendly) */}
          <div className="grid gap-3 md:hidden">
            {filteredRules.map((rule) => {
              const effectivelyActive = rule.is_active && rule.package_active;
              return (
                <article
                  key={rule.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-black text-slate-900">{rule.rule_type}</h3>
                      <p className="text-xs text-slate-500">
                        {serviceLabel(rule.service_type)} · {rule.package_name}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-black ring-1 ring-inset ${
                          rule.currency === 'USD'
                            ? 'bg-emerald-50 text-emerald-800 ring-emerald-600/20'
                            : 'bg-blue-50 text-blue-800 ring-blue-600/20'
                        }`}
                      >
                        {rule.currency}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset ${
                          effectivelyActive
                            ? 'bg-emerald-50 text-emerald-800 ring-emerald-600/20'
                            : 'bg-slate-100 text-slate-600 ring-slate-400/20'
                        }`}
                      >
                        {effectivelyActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-xs">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Rate</span>
                      <span className="font-black text-slate-900">
                        {formatMoney(rule.currency, rule.amount)}
                      </span>
                      <span className="block text-[11px] text-slate-500">{unitLabel(rule.unit)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Vehicle</span>
                      <span className="font-bold text-slate-800">{rule.resolved_category_name}</span>
                      {(rule.min_quantity !== null || rule.max_quantity !== null) && (
                        <span className="block text-[11px] text-slate-500">
                          Qty: {rule.min_quantity ?? '0'}–{rule.max_quantity ?? '∞'}
                        </span>
                      )}
                    </div>
                  </div>

                  {canManage && (
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => openEditRuleModal(rule)}
                        className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"
                      >
                        <Edit3 className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button
                        type="button"
                        disabled={busyId === rule.id}
                        onClick={() => void toggleRuleActive(rule)}
                        className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800"
                      >
                        <Power className="h-3.5 w-3.5" />
                        {rule.is_active ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === rule.id}
                        onClick={() => void deleteRule(rule)}
                        className="inline-flex items-center justify-center gap-1 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}

      {/* Add / Edit Pricing Rule Modal */}
      {showRuleModal && canManage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-6 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rule-modal-title"
        >
          <div className="w-full max-w-xl max-h-[92dvh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 id="rule-modal-title" className="text-lg font-black text-slate-900">
                  {ruleForm.rule_id ? 'Edit Pricing Rule' : 'Add Pricing Rule'}
                </h2>
                <p className="text-xs text-slate-500">
                  Configure vehicle rate rules used by the Bookings Quotation Calculator.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRuleModal(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {packages.length === 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950 space-y-2">
                <p className="font-bold">Create a Pricing Package first.</p>
                <p>Rules belong to a package (which sets the Service Type and LKR/USD Currency).</p>
                <button
                  type="button"
                  onClick={() => {
                    setShowRuleModal(false);
                    openPackageModal();
                  }}
                  className="rounded-xl bg-amber-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-amber-800"
                >
                  Open Package Manager
                </button>
              </div>
            ) : (
              <form onSubmit={(e) => void submitRule(e)} className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-bold text-slate-700 sm:col-span-2">
                    Pricing Package (Service Type &amp; Currency) *
                    <select
                      required
                      value={ruleForm.package_id}
                      onChange={(e) => setRuleForm({ ...ruleForm, package_id: e.target.value })}
                      className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm font-semibold text-slate-900"
                    >
                      <option value="">Choose pricing package…</option>
                      {packages.map((pkg) => (
                        <option key={pkg.id} value={pkg.id}>
                          {pkg.name} ({pkg.currency}) — {serviceLabel(pkg.service_type)}
                          {pkg.is_active ? '' : ' [Inactive]'}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-xs font-bold text-slate-700 sm:col-span-2">
                    Rule Name / Charge Description *
                    <input
                      required
                      minLength={2}
                      maxLength={80}
                      value={ruleForm.rule_type}
                      onChange={(e) => setRuleForm({ ...ruleForm, rule_type: e.target.value })}
                      placeholder="e.g. Airport Transfer Base Fare, Daily Chauffeur Rate, Extra KM"
                      className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm text-slate-900"
                    />
                  </label>

                  <label className="block text-xs font-bold text-slate-700">
                    Vehicle Category
                    <select
                      value={ruleForm.category_id}
                      onChange={(e) => setRuleForm({ ...ruleForm, category_id: e.target.value })}
                      className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm text-slate-900"
                    >
                      <option value="">All Vehicle Categories</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.display_name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-xs font-bold text-slate-700">
                    Charge Basis / Unit *
                    <select
                      value={ruleForm.unit}
                      onChange={(e) => setRuleForm({ ...ruleForm, unit: e.target.value })}
                      className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm text-slate-900"
                    >
                      {UNIT_OPTIONS.map((u) => (
                        <option key={u.value} value={u.value}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-xs font-bold text-slate-700">
                    Rate Amount *
                    <input
                      required
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      value={ruleForm.amount}
                      onChange={(e) => setRuleForm({ ...ruleForm, amount: e.target.value })}
                      placeholder="e.g. 15000.00 or 65.00"
                      className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm font-bold text-slate-900"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="block text-xs font-bold text-slate-700">
                      Min Qty
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={ruleForm.min_quantity}
                        onChange={(e) => setRuleForm({ ...ruleForm, min_quantity: e.target.value })}
                        placeholder="Optional"
                        className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm text-slate-900"
                      />
                    </label>
                    <label className="block text-xs font-bold text-slate-700">
                      Max Qty
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={ruleForm.max_quantity}
                        onChange={(e) => setRuleForm({ ...ruleForm, max_quantity: e.target.value })}
                        placeholder="Optional"
                        className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm text-slate-900"
                      />
                    </label>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={ruleForm.is_active}
                    onChange={(e) => setRuleForm({ ...ruleForm, is_active: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600"
                  />
                  Rule is Active (included in Bookings Quotation Calculator)
                </label>

                <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowRuleModal(false)}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingRule}
                    className="rounded-xl bg-blue-700 px-5 py-2.5 text-xs font-black text-white hover:bg-blue-800 disabled:opacity-50"
                  >
                    {savingRule ? 'Saving…' : ruleForm.rule_id ? 'Update Rule' : 'Save Pricing Rule'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Manage Pricing Packages Modal */}
      {showPackageModal && canManage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-6 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pkg-modal-title"
        >
          <div className="w-full max-w-2xl max-h-[92dvh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 id="pkg-modal-title" className="text-lg font-black text-slate-900">
                  Pricing Packages
                </h2>
                <p className="text-xs text-slate-500">
                  Each package groups rules by Service Type and Currency (LKR or USD).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPackageModal(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={(e) => void submitPackage(e)} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  {packageForm.package_id ? 'Edit Package' : 'Create New Package'}
                </h3>
                {packageForm.package_id && (
                  <button
                    type="button"
                    onClick={() =>
                      setPackageForm({
                        package_id: '',
                        code: '',
                        name: '',
                        service_type: 'airport_transfer',
                        currency: 'LKR',
                        is_active: true,
                        valid_from: '',
                        valid_until: '',
                      })
                    }
                    className="text-xs font-bold text-blue-700 hover:underline"
                  >
                    + Switch to New Package
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-xs font-bold text-slate-700">
                  Package Code *
                  <input
                    required
                    pattern="[A-Za-z0-9_-]{2,60}"
                    value={packageForm.code}
                    onChange={(e) => setPackageForm({ ...packageForm, code: e.target.value })}
                    placeholder="e.g. AIRPORT-USD-2026"
                    className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm text-slate-900"
                  />
                </label>
                <label className="block text-xs font-bold text-slate-700">
                  Package Name *
                  <input
                    required
                    minLength={2}
                    maxLength={120}
                    value={packageForm.name}
                    onChange={(e) => setPackageForm({ ...packageForm, name: e.target.value })}
                    placeholder="e.g. Airport Transfers (USD)"
                    className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm text-slate-900"
                  />
                </label>
                <label className="block text-xs font-bold text-slate-700">
                  Service Type *
                  <select
                    value={packageForm.service_type}
                    onChange={(e) => setPackageForm({ ...packageForm, service_type: e.target.value })}
                    className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm text-slate-900"
                  >
                    {SERVICE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-bold text-slate-700">
                  Currency *
                  <select
                    value={packageForm.currency}
                    onChange={(e) =>
                      setPackageForm({ ...packageForm, currency: e.target.value as 'LKR' | 'USD' })
                    }
                    className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm font-bold text-slate-900"
                  >
                    <option value="LKR">LKR (Sri Lankan Rupee)</option>
                    <option value="USD">USD (US Dollar)</option>
                  </select>
                </label>
                <label className="block text-xs font-bold text-slate-700">
                  Valid From (Optional)
                  <input
                    type="datetime-local"
                    value={packageForm.valid_from}
                    onChange={(e) => setPackageForm({ ...packageForm, valid_from: e.target.value })}
                    className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-2 text-xs text-slate-900"
                  />
                </label>
                <label className="block text-xs font-bold text-slate-700">
                  Valid Until (Optional)
                  <input
                    type="datetime-local"
                    value={packageForm.valid_until}
                    onChange={(e) => setPackageForm({ ...packageForm, valid_until: e.target.value })}
                    className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-2 text-xs text-slate-900"
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={packageForm.is_active}
                    onChange={(e) => setPackageForm({ ...packageForm, is_active: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600"
                  />
                  Package is Active
                </label>
                <button
                  type="submit"
                  disabled={savingPackage}
                  className="rounded-xl bg-blue-700 px-4 py-2 text-xs font-black text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  {savingPackage
                    ? 'Saving…'
                    : packageForm.package_id
                      ? 'Update Package'
                      : 'Create Package'}
                </button>
              </div>
            </form>

            {/* Existing Packages List */}
            <div className="space-y-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                Existing Packages ({packages.length})
              </h3>
              {packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 text-xs"
                >
                  <div>
                    <p className="font-extrabold text-slate-900">
                      {pkg.name} <span className="font-mono text-slate-500">({pkg.code})</span>
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {serviceLabel(pkg.service_type)} · {pkg.currency} · {pkg.rules.length} rule(s) ·{' '}
                      <span className={pkg.is_active ? 'text-emerald-700 font-bold' : 'text-slate-500'}>
                        {pkg.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openPackageModal(pkg)}
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={busyId === pkg.id || pkg.rules.length > 0}
                      title={
                        pkg.rules.length > 0
                          ? 'Delete or move rules out of this package first'
                          : 'Delete package'
                      }
                      onClick={() => void deletePackage(pkg)}
                      className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
