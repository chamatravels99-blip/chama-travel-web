'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpDown,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  CreditCard,
  Crown,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Globe,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Plus,
  Receipt,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  StickyNote,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { customerWhatsAppUrl } from '@/lib/whatsapp';
import type {
  CustomerCrmOverview,
  CustomerInvoiceRecord,
  CustomerReceiptRecord,
  CustomerVipStatus,
  UnifiedCustomerProfile,
} from '@/lib/admin-customers';

type FilterTab = 'all' | 'repeat_vip' | 'outstanding' | 'upcoming';
type SortOption = 'recent' | 'highest_spend' | 'most_bookings' | 'name_asc';
type DrawerTab = 'bookings' | 'ledger';

type CustomerFormState = {
  crm_profile_id: string | null;
  normalized_key: string;
  full_name: string;
  email: string;
  phone: string;
  whatsapp: string;
  country: string;
  vip_status: CustomerVipStatus;
  notes: string;
};

const EMPTY_ADD_CUSTOMER_FORM: CustomerFormState = {
  crm_profile_id: null,
  normalized_key: '',
  full_name: '',
  email: '',
  phone: '',
  whatsapp: '',
  country: '',
  vip_status: 'standard',
  notes: '',
};

const EMPTY_OVERVIEW: CustomerCrmOverview = {
  kpis: {
    total_customers: 0,
    repeat_and_vip_customers: 0,
    customers_with_outstanding: 0,
    customers_with_upcoming_trips: 0,
    revenue_collected: { LKR: 0, USD: 0 },
    outstanding_balances: { LKR: 0, USD: 0 },
    total_quoted: { LKR: 0, USD: 0 },
  },
  customers: [],
};

function formatMoney(currency: 'LKR' | 'USD', amount: number): string {
  const num = Number(amount) || 0;
  return `${currency} ${num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return '—';
  return new Date(parsed).toLocaleDateString('en-GB', {
    timeZone: 'Asia/Colombo',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return '—';
  return new Date(parsed).toLocaleString('en-GB', {
    timeZone: 'Asia/Colombo',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function vipBadgeConfig(tier: CustomerVipStatus) {
  if (tier === 'vip') {
    return {
      label: 'VIP Guest',
      classes: 'bg-amber-100 text-amber-900 border-amber-300',
      icon: Crown,
    };
  }
  if (tier === 'repeat') {
    return {
      label: 'Repeat Guest',
      classes: 'bg-indigo-50 text-indigo-800 border-indigo-200',
      icon: Award,
    };
  }
  return {
    label: 'Standard',
    classes: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: Users,
  };
}

function bookingStatusClasses(status: string): string {
  if (['pending', 'reviewing'].includes(status)) {
    return 'bg-amber-50 text-amber-800 border-amber-200';
  }
  if (['quoted', 'assigned', 'in_progress'].includes(status)) {
    return 'bg-blue-50 text-blue-800 border-blue-200';
  }
  if (['confirmed', 'completed'].includes(status)) {
    return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  }
  if (['cancelled', 'rejected'].includes(status)) {
    return 'bg-rose-50 text-rose-800 border-rose-200';
  }
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function paymentStatusBadge(status: string) {
  if (status === 'paid') {
    return { label: 'Paid', classes: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
  }
  if (status === 'partially_paid') {
    return { label: 'Partial', classes: 'bg-amber-50 text-amber-800 border-amber-200' };
  }
  if (status === 'unpaid') {
    return { label: 'Unpaid', classes: 'bg-rose-50 text-rose-800 border-rose-200' };
  }
  if (status === 'refunded') {
    return { label: 'Refunded', classes: 'bg-purple-50 text-purple-800 border-purple-200' };
  }
  return { label: 'No Quote', classes: 'bg-slate-100 text-slate-500 border-slate-200' };
}

// Normalizes spend into LKR-equivalent only for relative sorting across currencies (1 USD ≈ 300 LKR)
function customerSpendScore(customer: UnifiedCustomerProfile): number {
  return customer.financials.LKR.net_paid + customer.financials.USD.net_paid * 300;
}

export default function AdminCustomersPage() {
  const [overview, setOverview] = useState<CustomerCrmOverview>(EMPTY_OVERVIEW);
  const [loading, setLoading] = useState(true);
  const [savingCrm, setSavingCrm] = useState(false);
  const [generatingDocId, setGeneratingDocId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [sortBy, setSortBy] = useState<SortOption>('recent');

  // 360° Customer Drawer State
  const [selectedNormalizedKey, setSelectedNormalizedKey] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('bookings');
  const [drawerForm, setDrawerForm] = useState<CustomerFormState>(EMPTY_ADD_CUSTOMER_FORM);

  // "+ Add Customer" Modal State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState<CustomerFormState>(EMPTY_ADD_CUSTOMER_FORM);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/customers', { cache: 'no-store' });
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        data?: CustomerCrmOverview;
      };
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || 'Customer CRM records could not be loaded.');
      }
      setOverview(result.data);
      setError('');
    } catch (loadErr) {
      setError(
        loadErr instanceof Error ? loadErr.message : 'Customer CRM records could not be loaded.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadCustomers);
  }, [loadCustomers]);

  const selectedCustomer = useMemo(() => {
    if (!selectedNormalizedKey) return null;
    return (
      overview.customers.find((c) => c.normalized_key === selectedNormalizedKey) ?? null
    );
  }, [overview.customers, selectedNormalizedKey]);

  function toCustomerFormState(customer: UnifiedCustomerProfile): CustomerFormState {
    return {
      crm_profile_id: customer.crm_profile_id,
      normalized_key: customer.normalized_key,
      full_name: customer.full_name,
      email: customer.email ?? '',
      phone: customer.phone ?? '',
      whatsapp: customer.whatsapp ?? customer.phone ?? '',
      country: customer.country ?? '',
      vip_status: customer.vip_status,
      notes: customer.notes ?? '',
    };
  }

  function openCustomerDrawer(customer: UnifiedCustomerProfile, initialTab: DrawerTab = 'bookings') {
    setSelectedNormalizedKey(customer.normalized_key);
    setDrawerTab(initialTab);
    setDrawerForm(toCustomerFormState(customer));
    setError('');
  }

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = overview.customers.filter((customer) => {
      if (activeFilter === 'repeat_vip' && !customer.is_repeat_or_vip) return false;
      if (activeFilter === 'outstanding' && !customer.has_outstanding_balance) return false;
      if (activeFilter === 'upcoming' && !customer.has_upcoming_trips) return false;

      if (!q) return true;

      const matchesBasic = [
        customer.full_name,
        customer.email ?? '',
        customer.phone ?? '',
        customer.whatsapp ?? '',
        customer.country ?? '',
        customer.notes ?? '',
      ].some((field) => field.toLowerCase().includes(q));

      if (matchesBasic) return true;

      const matchesBookingRef = customer.bookings.some(
        (b) =>
          b.booking_ref.toLowerCase().includes(q) ||
          b.route_summary.toLowerCase().includes(q)
      );
      if (matchesBookingRef) return true;

      const matchesDoc =
        customer.invoices.some((inv) => inv.invoice_number.toLowerCase().includes(q)) ||
        customer.receipts.some((rec) => rec.receipt_number.toLowerCase().includes(q));

      return matchesDoc;
    });

    filtered.sort((a, b) => {
      if (sortBy === 'recent') {
        return Date.parse(b.last_activity_at) - Date.parse(a.last_activity_at);
      }
      if (sortBy === 'highest_spend') {
        const diff = customerSpendScore(b) - customerSpendScore(a);
        if (diff !== 0) return diff;
        return b.total_bookings - a.total_bookings;
      }
      if (sortBy === 'most_bookings') {
        const diff = b.total_bookings - a.total_bookings;
        if (diff !== 0) return diff;
        return Date.parse(b.last_activity_at) - Date.parse(a.last_activity_at);
      }
      if (sortBy === 'name_asc') {
        return a.full_name.localeCompare(b.full_name, undefined, { sensitivity: 'base' });
      }
      return 0;
    });

    return filtered;
  }, [overview.customers, searchQuery, activeFilter, sortBy]);

  async function handleSaveDrawerCrm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCustomer) return;

    setSavingCrm(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_crm_profile',
          crm_profile_id: drawerForm.crm_profile_id,
          normalized_key: drawerForm.normalized_key,
          full_name: drawerForm.full_name.trim(),
          email: drawerForm.email.trim() || null,
          phone: drawerForm.phone.trim() || null,
          whatsapp: drawerForm.whatsapp.trim() || drawerForm.phone.trim() || null,
          country: drawerForm.country.trim() || null,
          vip_status: drawerForm.vip_status,
          notes: drawerForm.notes.trim() || null,
        }),
      });
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        message?: string;
        data?: { id?: string; normalized_key?: string };
      };
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Customer CRM profile could not be saved.');
      }
      setNotice(result.message || 'Customer CRM profile updated.');
      if (result.data?.normalized_key) {
        setSelectedNormalizedKey(result.data.normalized_key);
      }
      if (result.data?.id || result.data?.normalized_key) {
        setDrawerForm((prev) => ({
          ...prev,
          crm_profile_id: result.data?.id ?? prev.crm_profile_id,
          normalized_key: result.data?.normalized_key ?? prev.normalized_key,
        }));
      }
      await loadCustomers();
    } catch (saveErr) {
      setError(
        saveErr instanceof Error ? saveErr.message : 'Customer CRM profile could not be saved.'
      );
    } finally {
      setSavingCrm(false);
    }
  }

  async function handleAddCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingCrm(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_customer',
          full_name: addForm.full_name.trim(),
          email: addForm.email.trim() || null,
          phone: addForm.phone.trim() || null,
          whatsapp: addForm.whatsapp.trim() || addForm.phone.trim() || null,
          country: addForm.country.trim() || null,
          vip_status: addForm.vip_status,
          notes: addForm.notes.trim() || null,
        }),
      });
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        message?: string;
        data?: { normalized_key?: string };
      };
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Customer could not be added.');
      }
      setNotice(result.message || 'Customer added to CRM.');
      setAddModalOpen(false);
      setAddForm(EMPTY_ADD_CUSTOMER_FORM);
      await loadCustomers();
      if (result.data?.normalized_key) {
        setSelectedNormalizedKey(result.data.normalized_key);
      }
    } catch (addErr) {
      setError(addErr instanceof Error ? addErr.message : 'Customer could not be added.');
    } finally {
      setSavingCrm(false);
    }
  }

  async function handlePrepareBillingPdf(
    action: 'issue_receipt' | 'retry_render',
    item: CustomerInvoiceRecord | CustomerReceiptRecord
  ) {
    const busyKey = item.id;
    setGeneratingDocId(busyKey);
    setError('');
    setNotice('');
    try {
      const payload =
        action === 'issue_receipt' && 'payment_id' in item
          ? { action: 'issue_receipt', payment_id: item.payment_id }
          : { action: 'retry_render', document_id: item.document_id };

      const response = await fetch('/api/admin/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        success?: boolean;
        message?: string;
        warning?: string;
        error?: string;
      };
      if ((!response.ok && response.status !== 202) || result.success !== true) {
        throw new Error(result.error || 'The PDF document could not be generated.');
      }
      setNotice(result.warning || result.message || 'PDF document generated and stored.');
      await loadCustomers();
    } catch (pdfErr) {
      setError(pdfErr instanceof Error ? pdfErr.message : 'The PDF document could not be generated.');
    } finally {
      setGeneratingDocId('');
    }
  }

  const { kpis } = overview;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* TOP HEADER */}
        <header className="flex flex-col gap-5 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Link
                href="/admin/dashboard"
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
              </Link>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-800">
                <Users className="h-3.5 w-3.5" /> Centralized Guest CRM &amp; Ledger
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              Customer CRM &amp; Financial History
            </h1>
            <p className="mt-1.5 text-sm text-slate-600">
              Unified 360° guest directory aggregating contact channels, multi-currency spend, outstanding balances, invoices, receipts, and confidential Admin notes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => void loadCustomers()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button
              type="button"
              onClick={() => {
                setAddForm(EMPTY_ADD_CUSTOMER_FORM);
                setError('');
                setAddModalOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-600/20 transition hover:bg-blue-700"
            >
              <UserPlus className="h-4 w-4" /> + Add Customer
            </button>
          </div>
        </header>

        {/* ALERTS */}
        {error && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900"
          >
            <div className="flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError('')}
              className="rounded-lg p-1 text-rose-600 hover:bg-rose-100"
              aria-label="Dismiss error"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{notice}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotice('')}
              className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-100"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* 1. TOP KPI SUMMARY BAR */}
        <section
          aria-label="Customer CRM KPI summary"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {/* KPI 1: Total Unique Customers */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total Unique Customers
              </span>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <Users className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-black text-slate-950">{kpis.total_customers}</p>
            <p className="mt-1.5 text-xs font-medium text-slate-500">
              {kpis.customers_with_upcoming_trips} with active / upcoming trips
            </p>
          </div>

          {/* KPI 2: Repeat & VIP Customers */}
          <div className="flex flex-col justify-between rounded-2xl border border-indigo-200/80 bg-indigo-50/40 p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                Repeat &amp; VIP Customers
              </span>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-800">
                <Crown className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-black text-indigo-950">
              {kpis.repeat_and_vip_customers}
            </p>
            <p className="mt-1.5 text-xs font-medium text-indigo-800">
              2+ bookings or designated VIP tier
            </p>
          </div>

          {/* KPI 3: Total Revenue Collected (LKR & USD) */}
          <div className="flex flex-col justify-between rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                Total Revenue Collected
              </span>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                <TrendingUp className="h-5 w-5" />
              </span>
            </div>
            <div className="mt-3 space-y-1">
              <p className="text-lg font-black text-emerald-950">
                {formatMoney('LKR', kpis.revenue_collected.LKR)}
              </p>
              <p className="text-sm font-extrabold text-emerald-800">
                {formatMoney('USD', kpis.revenue_collected.USD)}
              </p>
            </div>
            <p className="mt-1.5 text-xs font-medium text-emerald-800">
              Verified net customer receipts
            </p>
          </div>

          {/* KPI 4: Total Outstanding Customer Balances (LKR & USD) */}
          <div className="flex flex-col justify-between rounded-2xl border border-amber-200/80 bg-amber-50/40 p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-900">
                Outstanding Balances
              </span>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                <Wallet className="h-5 w-5" />
              </span>
            </div>
            <div className="mt-3 space-y-1">
              <p className="text-lg font-black text-amber-950">
                {formatMoney('LKR', kpis.outstanding_balances.LKR)}
              </p>
              <p className="text-sm font-extrabold text-amber-800">
                {formatMoney('USD', kpis.outstanding_balances.USD)}
              </p>
            </div>
            <p className="mt-1.5 text-xs font-medium text-amber-800">
              Across {kpis.customers_with_outstanding} customer
              {kpis.customers_with_outstanding === 1 ? '' : 's'} with balance due
            </p>
          </div>
        </section>

        {/* 2. SEARCH, FILTER & ACTION TOOLBAR */}
        <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Search Input */}
            <div className="relative flex-1 max-w-lg">
              <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by customer name, phone/WhatsApp, email, or booking ref (CT-...)..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
              />
            </div>

            {/* Filter Pills & Sort Selector */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex flex-wrap rounded-xl border border-slate-200 bg-slate-50 p-1">
                {(
                  [
                    { id: 'all', label: `All Customers (${kpis.total_customers})` },
                    { id: 'repeat_vip', label: `Repeat / VIP (${kpis.repeat_and_vip_customers})` },
                    {
                      id: 'outstanding',
                      label: `Has Outstanding Balance (${kpis.customers_with_outstanding})`,
                    },
                    {
                      id: 'upcoming',
                      label: `Upcoming Trips (${kpis.customers_with_upcoming_trips})`,
                    },
                  ] as const
                ).map((pill) => (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setActiveFilter(pill.id)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                      activeFilter === pill.id
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                <select
                  aria-label="Sort customers"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 focus:border-blue-500 focus:bg-white focus:outline-none"
                >
                  <option value="recent">Most Recent Activity</option>
                  <option value="highest_spend">Highest Spend</option>
                  <option value="most_bookings">Most Bookings</option>
                  <option value="name_asc">Name (A–Z)</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* 3. CUSTOMERS TABLE / CARDS VIEW */}
        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-sm font-medium text-slate-500">
            Loading centralized customer CRM profiles and financial ledgers…
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <Users className="mx-auto h-10 w-10 text-slate-400" />
            <h2 className="mt-3 text-base font-bold text-slate-900">
              No customers match your filter
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Try clearing your search query or pre-register a walk-in / WhatsApp inquiry customer.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {(searchQuery || activeFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveFilter('all');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Reset Filters
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setAddForm(EMPTY_ADD_CUSTOMER_FORM);
                  setAddModalOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" /> + Add Customer
              </button>
            </div>
          </div>
        ) : (
          <section
            aria-label="Customers directory table"
            className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-xs"
          >
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                    <th className="py-3.5 px-5">Customer &amp; Tier</th>
                    <th className="py-3.5 px-4">Bookings Breakdown</th>
                    <th className="py-3.5 px-4">Total Paid (Net)</th>
                    <th className="py-3.5 px-4">Outstanding Balance</th>
                    <th className="py-3.5 px-4">Last Trip / Activity</th>
                    <th className="py-3.5 px-5 text-right">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80 text-xs">
                  {filteredCustomers.map((customer) => {
                    const tierBadge = vipBadgeConfig(customer.effective_tier);
                    const TierIcon = tierBadge.icon;
                    const primaryPhone = customer.whatsapp || customer.phone;
                    const waUrl = customerWhatsAppUrl(
                      primaryPhone,
                      `Hello ${customer.full_name}, Chama Travels Customer Relations team contacting you.`
                    );
                    const lkrPaid = customer.financials.LKR.net_paid;
                    const usdPaid = customer.financials.USD.net_paid;
                    const lkrDue = customer.financials.LKR.outstanding_balance;
                    const usdDue = customer.financials.USD.outstanding_balance;
                    const isSelected = selectedNormalizedKey === customer.normalized_key;

                    return (
                      <tr
                        key={customer.normalized_key}
                        onClick={() => openCustomerDrawer(customer)}
                        className={`cursor-pointer transition ${
                          isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50/90'
                        }`}
                      >
                        {/* Customer & Tier */}
                        <td className="py-4 px-5">
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-sm font-black text-white shadow-2xs">
                              {(customer.full_name.trim()[0] || 'C').toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-black text-sm text-slate-950">
                                  {customer.full_name}
                                </span>
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${tierBadge.classes}`}
                                >
                                  <TierIcon className="h-3 w-3" />
                                  {tierBadge.label}
                                </span>
                                {customer.country && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                                    <Globe className="h-2.5 w-2.5" /> {customer.country}
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                                {customer.email && (
                                  <span className="inline-flex items-center gap-1 truncate">
                                    <Mail className="h-3 w-3 text-slate-400" />
                                    {customer.email}
                                  </span>
                                )}
                                {primaryPhone && (
                                  <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                                    <Phone className="h-3 w-3 text-slate-400" />
                                    {primaryPhone}
                                  </span>
                                )}
                              </div>
                              {customer.notes && (
                                <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-amber-50/90 px-2 py-0.5 text-[10px] font-semibold text-amber-900 border border-amber-200/70 max-w-xs truncate">
                                  <StickyNote className="h-2.5 w-2.5 shrink-0 text-amber-700" />
                                  {customer.notes}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Bookings Breakdown */}
                        <td className="py-4 px-4">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="rounded-lg bg-slate-900 px-2 py-0.5 text-[11px] font-black text-white">
                              {customer.total_bookings} Total
                            </span>
                            <span className="rounded-lg bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200/80">
                              {customer.completed_bookings} Completed
                            </span>
                            {customer.active_upcoming_bookings > 0 && (
                              <span className="rounded-lg bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-800 border border-blue-200/80">
                                {customer.active_upcoming_bookings} Upcoming
                              </span>
                            )}
                          </div>
                          {customer.bookings[0] && (
                            <p className="mt-1.5 text-[11px] text-slate-500 truncate max-w-[210px]">
                              Latest: <b className="text-slate-700">{customer.bookings[0].booking_ref}</b>
                            </p>
                          )}
                        </td>

                        {/* Total Paid */}
                        <td className="py-4 px-4">
                          {lkrPaid === 0 && usdPaid === 0 ? (
                            <span className="text-slate-400 font-semibold">No payments yet</span>
                          ) : (
                            <div className="space-y-0.5">
                              {lkrPaid > 0 && (
                                <div className="font-extrabold text-slate-900">
                                  {formatMoney('LKR', lkrPaid)}
                                </div>
                              )}
                              {usdPaid > 0 && (
                                <div className="font-extrabold text-blue-800">
                                  {formatMoney('USD', usdPaid)}
                                </div>
                              )}
                            </div>
                          )}
                          {(customer.invoices.length > 0 || customer.receipts.length > 0) && (
                            <p className="mt-1 text-[10px] font-bold text-slate-500">
                              {customer.invoices.length} Inv · {customer.receipts.length} Rec
                            </p>
                          )}
                        </td>

                        {/* Outstanding Balance */}
                        <td className="py-4 px-4">
                          {customer.has_outstanding_balance ? (
                            <div className="space-y-1">
                              {lkrDue > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-extrabold text-rose-800">
                                  Due: {formatMoney('LKR', lkrDue)}
                                </span>
                              )}
                              {usdDue > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-extrabold text-amber-900">
                                  Due: {formatMoney('USD', usdDue)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-extrabold text-emerald-800">
                              <CheckCircle2 className="h-3 w-3" /> Settled
                            </span>
                          )}
                        </td>

                        {/* Last Trip / Last Booking Date */}
                        <td className="py-4 px-4">
                          {customer.last_booking_date ? (
                            <div>
                              <div className="font-bold text-slate-800">
                                {formatDate(customer.last_trip_date)}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                Booked {formatDate(customer.last_booking_date)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">CRM Pre-registered</span>
                          )}
                        </td>

                        {/* Quick Actions */}
                        <td
                          className="py-4 px-5 text-right"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                            {waUrl && (
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Chat on WhatsApp"
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white shadow-2xs hover:bg-emerald-700"
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                                <span className="hidden xl:inline">WhatsApp</span>
                              </a>
                            )}
                            {primaryPhone && (
                              <a
                                href={`tel:${primaryPhone}`}
                                title={`Call ${primaryPhone}`}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
                              >
                                <Phone className="h-3.5 w-3.5 text-blue-600" />
                                <span className="hidden xl:inline">Call</span>
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => openCustomerDrawer(customer)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-blue-700 transition"
                            >
                              <BookOpen className="h-3.5 w-3.5" />
                              View History &amp; Ledger
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      {/* 4. CUSTOMER 360° PROFILE DRAWER / MODAL */}
      {selectedCustomer && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="customer-360-title"
        >
          <div
            className="fixed inset-0"
            onClick={() => setSelectedNormalizedKey(null)}
            aria-hidden="true"
          />
          <aside className="relative z-10 flex h-full w-full max-w-4xl flex-col overflow-hidden bg-slate-50 shadow-2xl">
            {/* Drawer Header & Contact Actions */}
            <header className="border-b border-slate-200 bg-white px-6 py-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-lg font-black text-white shadow-sm">
                    {(selectedCustomer.full_name.trim()[0] || 'C').toUpperCase()}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2
                        id="customer-360-title"
                        className="text-xl font-black tracking-tight text-slate-950"
                      >
                        {selectedCustomer.full_name}
                      </h2>
                      {(() => {
                        const badge = vipBadgeConfig(selectedCustomer.effective_tier);
                        const BadgeIcon = badge.icon;
                        return (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-extrabold ${badge.classes}`}
                          >
                            <BadgeIcon className="h-3.5 w-3.5" />
                            {badge.label}
                          </span>
                        );
                      })()}
                      {selectedCustomer.country && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                          <Globe className="h-3 w-3 text-blue-600" /> {selectedCustomer.country}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                      {selectedCustomer.email && (
                        <span className="inline-flex items-center gap-1 font-medium">
                          <Mail className="h-3.5 w-3.5 text-slate-400" />
                          {selectedCustomer.email}
                        </span>
                      )}
                      {(selectedCustomer.phone || selectedCustomer.whatsapp) && (
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                          <Phone className="h-3.5 w-3.5 text-slate-400" />
                          {selectedCustomer.phone || selectedCustomer.whatsapp}
                        </span>
                      )}
                      {selectedCustomer.first_booking_date && (
                        <span className="inline-flex items-center gap-1 text-slate-500">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          Customer since {formatDate(selectedCustomer.first_booking_date)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* One-Click Contact Actions & Close */}
                <div className="flex flex-wrap items-center gap-2">
                  {(() => {
                    const waUrl = customerWhatsAppUrl(
                      selectedCustomer.whatsapp || selectedCustomer.phone,
                      `Hello ${selectedCustomer.full_name}, Chama Travels contacting you regarding your travel itinerary.`
                    );
                    return waUrl ? (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
                      >
                        <MessageSquare className="h-4 w-4" /> WhatsApp Chat
                      </a>
                    ) : null;
                  })()}
                  {(selectedCustomer.phone || selectedCustomer.whatsapp) && (
                    <a
                      href={`tel:${selectedCustomer.phone || selectedCustomer.whatsapp}`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      <Phone className="h-4 w-4 text-blue-600" /> Call
                    </a>
                  )}
                  {selectedCustomer.email && (
                    <a
                      href={`mailto:${selectedCustomer.email}`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      <Mail className="h-4 w-4 text-indigo-600" /> Email
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedNormalizedKey(null)}
                    className="rounded-xl border border-slate-200 bg-slate-100 p-2 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                    aria-label="Close customer profile drawer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </header>

            {/* Drawer Scrollable Body */}
            <div className="flex-1 space-y-6 overflow-y-auto p-6">
              {/* Financial Snapshot Cards (LKR & USD) */}
              <section aria-label="Customer financial snapshot">
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                      Total Quoted / Booked
                    </p>
                    <p className="mt-2 text-base font-black text-slate-950">
                      {formatMoney('LKR', selectedCustomer.financials.LKR.total_quoted)}
                    </p>
                    <p className="mt-0.5 text-sm font-bold text-blue-800">
                      {formatMoney('USD', selectedCustomer.financials.USD.total_quoted)}
                    </p>
                    <p className="mt-1.5 text-[11px] text-slate-500">
                      Across {selectedCustomer.total_bookings} booking
                      {selectedCustomer.total_bookings === 1 ? '' : 's'}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-2xs">
                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-900">
                      Net Paid
                    </p>
                    <p className="mt-2 text-base font-black text-emerald-950">
                      {formatMoney('LKR', selectedCustomer.financials.LKR.net_paid)}
                    </p>
                    <p className="mt-0.5 text-sm font-bold text-emerald-800">
                      {formatMoney('USD', selectedCustomer.financials.USD.net_paid)}
                    </p>
                    <p className="mt-1.5 text-[11px] text-emerald-800">
                      {selectedCustomer.receipts.length} official receipt
                      {selectedCustomer.receipts.length === 1 ? '' : 's'} issued
                    </p>
                  </div>

                  <div
                    className={`rounded-2xl border p-4 shadow-2xs ${
                      selectedCustomer.has_outstanding_balance
                        ? 'border-rose-200 bg-rose-50/60'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <p
                      className={`text-[11px] font-extrabold uppercase tracking-wider ${
                        selectedCustomer.has_outstanding_balance
                          ? 'text-rose-900'
                          : 'text-slate-500'
                      }`}
                    >
                      Outstanding Balance
                    </p>
                    <p
                      className={`mt-2 text-base font-black ${
                        selectedCustomer.has_outstanding_balance
                          ? 'text-rose-950'
                          : 'text-slate-900'
                      }`}
                    >
                      {formatMoney('LKR', selectedCustomer.financials.LKR.outstanding_balance)}
                    </p>
                    <p
                      className={`mt-0.5 text-sm font-bold ${
                        selectedCustomer.has_outstanding_balance
                          ? 'text-rose-800'
                          : 'text-slate-600'
                      }`}
                    >
                      {formatMoney('USD', selectedCustomer.financials.USD.outstanding_balance)}
                    </p>
                    <p className="mt-1.5 text-[11px] font-semibold text-slate-600">
                      {selectedCustomer.has_outstanding_balance
                        ? 'Balance due on confirmed quotes'
                        : 'All confirmed quotes settled'}
                    </p>
                  </div>
                </div>
              </section>

              {/* CRM Notes & Tier Editor */}
              <section
                aria-label="CRM notes and tier editor"
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs"
              >
                <div className="mb-3.5 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-950 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-blue-600" />
                      CRM Profile, VIP Tier &amp; Confidential Admin Notes
                    </h3>
                    <p className="text-xs text-slate-500">
                      Private internal metadata linked to <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px]">{selectedCustomer.normalized_key}</code>. Never visible to guests.
                    </p>
                  </div>
                </div>

                <form onSubmit={(event) => void handleSaveDrawerCrm(event)} className="space-y-3.5">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="block text-xs font-bold text-slate-700">
                      Full Name
                      <input
                        type="text"
                        required
                        minLength={2}
                        maxLength={160}
                        value={drawerForm.full_name}
                        onChange={(e) =>
                          setDrawerForm({ ...drawerForm, full_name: e.target.value })
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                      />
                    </label>

                    <label className="block text-xs font-bold text-slate-700">
                      VIP / Loyalty Tier
                      <select
                        value={drawerForm.vip_status}
                        onChange={(e) =>
                          setDrawerForm({
                            ...drawerForm,
                            vip_status: e.target.value as CustomerVipStatus,
                          })
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                      >
                        <option value="standard">Standard</option>
                        <option value="repeat">Repeat Guest</option>
                        <option value="vip">VIP Guest</option>
                      </select>
                    </label>

                    <label className="block text-xs font-bold text-slate-700">
                      Country / Origin
                      <input
                        type="text"
                        maxLength={100}
                        placeholder="e.g. United Kingdom, Germany"
                        value={drawerForm.country}
                        onChange={(e) =>
                          setDrawerForm({ ...drawerForm, country: e.target.value })
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                      />
                    </label>

                    <label className="block text-xs font-bold text-slate-700">
                      WhatsApp Number
                      <input
                        type="text"
                        maxLength={30}
                        placeholder="+94 77 123 4567"
                        value={drawerForm.whatsapp}
                        onChange={(e) =>
                          setDrawerForm({ ...drawerForm, whatsapp: e.target.value })
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block text-xs font-bold text-slate-700">
                      Email Address
                      <input
                        type="email"
                        maxLength={254}
                        placeholder="guest@example.com"
                        value={drawerForm.email}
                        onChange={(e) =>
                          setDrawerForm({ ...drawerForm, email: e.target.value })
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                      />
                    </label>

                    <label className="block text-xs font-bold text-slate-700">
                      Primary Phone
                      <input
                        type="text"
                        maxLength={30}
                        placeholder="+94 77 123 4567"
                        value={drawerForm.phone}
                        onChange={(e) =>
                          setDrawerForm({ ...drawerForm, phone: e.target.value })
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                      />
                    </label>
                  </div>

                  <label className="block text-xs font-bold text-slate-700">
                    Confidential Admin CRM Notes (preferences, dietary needs, language, payment notes)
                    <textarea
                      rows={2}
                      maxLength={4000}
                      placeholder="Add internal notes about this customer (e.g. prefers English-speaking chauffeur, vegetarian meals, repeat family guest)..."
                      value={drawerForm.notes}
                      onChange={(e) =>
                        setDrawerForm({ ...drawerForm, notes: e.target.value })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-medium text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                    />
                  </label>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="submit"
                      disabled={savingCrm}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {savingCrm ? 'Saving CRM Profile…' : 'Save CRM Profile'}
                    </button>
                  </div>
                </form>
              </section>

              {/* Drawer Sub-Tabs Navigation */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2">
                <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
                  <button
                    type="button"
                    onClick={() => setDrawerTab('bookings')}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
                      drawerTab === 'bookings'
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    Bookings History ({selectedCustomer.bookings.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrawerTab('ledger')}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
                      drawerTab === 'ledger'
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    Payments, Invoices &amp; Receipts (
                    {selectedCustomer.payments.length + selectedCustomer.invoices.length})
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 text-xs font-bold">
                  <span className="rounded-full bg-slate-200/70 px-2.5 py-1 text-slate-700">
                    {selectedCustomer.completed_bookings} Completed
                  </span>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-800">
                    {selectedCustomer.active_upcoming_bookings} Active / Upcoming
                  </span>
                  {selectedCustomer.cancelled_bookings > 0 && (
                    <span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-800">
                      {selectedCustomer.cancelled_bookings} Cancelled
                    </span>
                  )}
                </div>
              </div>

              {/* SUB-TAB 1: BOOKINGS HISTORY */}
              {drawerTab === 'bookings' && (
                <section aria-label="Customer bookings history" className="space-y-3">
                  {selectedCustomer.bookings.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                      <MapPin className="mx-auto h-8 w-8 text-slate-400" />
                      <p className="mt-2 text-sm font-bold text-slate-800">
                        No bookings linked to this customer yet
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        When this guest submits a booking with the same email or phone number, it will automatically link here.
                      </p>
                    </div>
                  ) : (
                    selectedCustomer.bookings.map((booking) => {
                      const payBadge = paymentStatusBadge(booking.payment_status);
                      return (
                        <article
                          key={booking.id}
                          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs transition hover:border-blue-300"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-sm font-black text-slate-950">
                                  {booking.booking_ref}
                                </span>
                                <span
                                  className={`rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${bookingStatusClasses(
                                    booking.booking_status
                                  )}`}
                                >
                                  {booking.booking_status.replaceAll('_', ' ')}
                                </span>
                                <span
                                  className={`rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${payBadge.classes}`}
                                >
                                  {payBadge.label}
                                </span>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                                  {booking.service_type.replaceAll('_', ' ')} ·{' '}
                                  {booking.journey_type.replaceAll('_', ' ')}
                                </span>
                              </div>

                              <p className="mt-2 text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                                <span className="truncate">{booking.route_summary}</span>
                              </p>

                              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                                <span>
                                  Pickup:{' '}
                                  <b className="text-slate-700">
                                    {booking.pickup_at
                                      ? formatDateTime(booking.pickup_at)
                                      : 'Unscheduled'}
                                  </b>
                                </span>
                                <span>
                                  Created: <b className="text-slate-700">{formatDate(booking.created_at)}</b>
                                </span>
                                <span>
                                  Party:{' '}
                                  <b className="text-slate-700">
                                    {booking.passenger_count} pax / {booking.luggage_count} bags
                                  </b>
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-2 text-right">
                              <div>
                                {booking.quoted_amount !== null ? (
                                  <div className="text-sm font-black text-slate-950">
                                    {formatMoney(booking.currency, booking.quoted_amount)}
                                    {booking.quote_status && (
                                      <span className="ml-1.5 text-[10px] font-bold uppercase text-slate-500">
                                        ({booking.quote_status})
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="text-xs font-bold text-slate-400">
                                    Awaiting quote ({booking.currency})
                                  </div>
                                )}
                                <div className="mt-0.5 text-[11px] text-slate-600">
                                  Paid:{' '}
                                  <b className="text-emerald-700">
                                    {formatMoney(booking.currency, booking.net_paid)}
                                  </b>
                                  {booking.outstanding_balance > 0 && (
                                    <span className="ml-2 text-rose-700 font-bold">
                                      · Due: {formatMoney(booking.currency, booking.outstanding_balance)}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <Link
                                href={booking.booking_link}
                                className="inline-flex items-center gap-1 rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition"
                              >
                                Open in Bookings →
                              </Link>
                            </div>
                          </div>
                        </article>
                      );
                    })
                  )}
                </section>
              )}

              {/* SUB-TAB 2: PAYMENTS, INVOICES & RECEIPTS */}
              {drawerTab === 'ledger' && (
                <div className="space-y-6">
                  {/* Invoices & Official Receipts PDF Archive */}
                  <section
                    aria-label="Customer invoices and receipts"
                    className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs"
                  >
                    <div className="border-b border-slate-100 px-5 py-4 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-black text-slate-950 flex items-center gap-2">
                          <FileText className="h-4 w-4 text-blue-600" />
                          Invoices &amp; Official Receipts (
                          {selectedCustomer.invoices.length + selectedCustomer.receipts.length})
                        </h3>
                        <p className="text-xs text-slate-500">
                          One-click PDF download for every booking invoice and verified payment receipt.
                        </p>
                      </div>
                    </div>

                    {selectedCustomer.invoices.length === 0 &&
                    selectedCustomer.receipts.length === 0 ? (
                      <p className="p-6 text-xs text-slate-500">
                        No invoices or payment receipts have been issued for this customer yet.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {/* Invoices */}
                        {selectedCustomer.invoices.map((invoice) => (
                          <div
                            key={`inv-${invoice.id}`}
                            className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-xs"
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-extrabold uppercase text-blue-800 border border-blue-200">
                                  Invoice
                                </span>
                                <span className="font-mono font-black text-slate-900">
                                  {invoice.invoice_number}
                                </span>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                    invoice.status === 'issued'
                                      ? 'bg-emerald-50 text-emerald-800'
                                      : 'bg-rose-50 text-rose-800'
                                  }`}
                                >
                                  {invoice.status}
                                </span>
                              </div>
                              <p className="mt-1 text-[11px] text-slate-500">
                                Booking <b className="text-slate-700">{invoice.booking_ref}</b> ·{' '}
                                <b className="text-slate-900">
                                  {formatMoney(invoice.currency, invoice.total)}
                                </b>{' '}
                                · Issued {formatDate(invoice.issued_at)}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              {invoice.download_url ? (
                                <>
                                  {invoice.view_url && (
                                    <a
                                      href={invoice.view_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                                    >
                                      <Eye className="h-3.5 w-3.5 text-blue-600" /> View PDF
                                    </a>
                                  )}
                                  <a
                                    href={invoice.download_url}
                                    className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
                                  >
                                    <Download className="h-3.5 w-3.5" /> Download PDF
                                  </a>
                                </>
                              ) : invoice.document_id ? (
                                <button
                                  type="button"
                                  disabled={generatingDocId === invoice.id}
                                  onClick={() => void handlePrepareBillingPdf('retry_render', invoice)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-800 hover:bg-blue-100 disabled:opacity-50"
                                >
                                  {generatingDocId === invoice.id ? 'Generating…' : 'Generate PDF'}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ))}

                        {/* Receipts */}
                        {selectedCustomer.receipts.map((receipt) => (
                          <div
                            key={`rec-${receipt.id}`}
                            className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-xs"
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold uppercase text-emerald-800 border border-emerald-200">
                                  <Receipt className="h-3 w-3" /> Receipt
                                </span>
                                <span className="font-mono font-black text-slate-900">
                                  {receipt.receipt_number}
                                </span>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                                  {receipt.method.replaceAll('_', ' ')}
                                </span>
                              </div>
                              <p className="mt-1 text-[11px] text-slate-500">
                                Booking <b className="text-slate-700">{receipt.booking_ref}</b> ·{' '}
                                <b className="text-emerald-800">
                                  {formatMoney(receipt.currency, receipt.amount)}
                                </b>{' '}
                                · Paid {formatDate(receipt.payment_date || receipt.verified_at)}
                                {receipt.reference ? ` · Ref: ${receipt.reference}` : ''}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              {receipt.download_url ? (
                                <>
                                  {receipt.view_url && (
                                    <a
                                      href={receipt.view_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                                    >
                                      <Eye className="h-3.5 w-3.5 text-blue-600" /> View PDF
                                    </a>
                                  )}
                                  <a
                                    href={receipt.download_url}
                                    className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
                                  >
                                    <Download className="h-3.5 w-3.5" /> Download PDF
                                  </a>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  disabled={generatingDocId === receipt.id}
                                  onClick={() =>
                                    void handlePrepareBillingPdf(
                                      receipt.document_id ? 'retry_render' : 'issue_receipt',
                                      receipt
                                    )
                                  }
                                  className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-800 hover:bg-blue-100 disabled:opacity-50"
                                >
                                  {generatingDocId === receipt.id
                                    ? 'Preparing PDF…'
                                    : 'Generate Receipt PDF'}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* Complete Payment Ledger Table */}
                  <section
                    aria-label="Customer payment ledger"
                    className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs"
                  >
                    <div className="border-b border-slate-100 px-5 py-4 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-black text-slate-950 flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-emerald-600" />
                          Verified Payment &amp; Refund Ledger ({selectedCustomer.payments.length})
                        </h3>
                        <p className="text-xs text-slate-500">
                          Immutable chronological audit trail of all customer payments and refunds.
                        </p>
                      </div>
                      <Link
                        href="/admin/payments"
                        className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline"
                      >
                        Open Payments Hub <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </div>

                    {selectedCustomer.payments.length === 0 ? (
                      <p className="p-6 text-xs text-slate-500">
                        No verified payments recorded for this customer yet.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                              <th className="py-2.5 px-4">Date</th>
                              <th className="py-2.5 px-4">Booking Ref</th>
                              <th className="py-2.5 px-4">Type &amp; Receipt</th>
                              <th className="py-2.5 px-4">Method &amp; Ref</th>
                              <th className="py-2.5 px-4">Amount</th>
                              <th className="py-2.5 px-4">Status</th>
                              <th className="py-2.5 px-4 text-right">PDF</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {selectedCustomer.payments.map((payment) => (
                              <tr key={payment.id} className="hover:bg-slate-50/80">
                                <td className="py-3 px-4 font-semibold text-slate-800">
                                  {formatDate(payment.payment_date || payment.verified_at)}
                                </td>
                                <td className="py-3 px-4">
                                  <Link
                                    href={`/admin/bookings?booking_id=${encodeURIComponent(
                                      payment.booking_id
                                    )}`}
                                    className="font-mono font-bold text-blue-700 hover:underline"
                                  >
                                    {payment.booking_ref}
                                  </Link>
                                </td>
                                <td className="py-3 px-4">
                                  <span
                                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                                      payment.entry_type === 'receipt'
                                        ? 'bg-emerald-50 text-emerald-800'
                                        : 'bg-amber-50 text-amber-900'
                                    }`}
                                  >
                                    {payment.entry_type}
                                  </span>
                                  {payment.receipt_number && (
                                    <span className="ml-1.5 font-mono text-[11px] font-bold text-slate-700">
                                      {payment.receipt_number}
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-slate-600">
                                  <span className="font-semibold capitalize">
                                    {payment.method.replaceAll('_', ' ')}
                                  </span>
                                  {payment.reference && (
                                    <span className="block text-[11px] text-slate-500">
                                      Ref: {payment.reference}
                                    </span>
                                  )}
                                  {payment.refund_reason && (
                                    <span className="block text-[11px] text-amber-800">
                                      Reason: {payment.refund_reason}
                                    </span>
                                  )}
                                </td>
                                <td
                                  className={`py-3 px-4 font-black ${
                                    payment.entry_type === 'refund'
                                      ? 'text-amber-800'
                                      : 'text-slate-900'
                                  }`}
                                >
                                  {payment.entry_type === 'refund' ? '−' : ''}
                                  {formatMoney(payment.currency, payment.amount)}
                                </td>
                                <td className="py-3 px-4">
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800">
                                    <CheckCircle2 className="h-3 w-3" /> {payment.status}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  {payment.download_url ? (
                                    <a
                                      href={payment.download_url}
                                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-800 hover:bg-slate-100"
                                    >
                                      <Download className="h-3 w-3" /> PDF
                                    </a>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* "+ ADD CUSTOMER" PRE-REGISTRATION MODAL */}
      {addModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-customer-modal-title"
        >
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2
                  id="add-customer-modal-title"
                  className="text-lg font-black text-slate-950 flex items-center gap-2"
                >
                  <UserPlus className="h-5 w-5 text-blue-600" />
                  Pre-Register Customer in CRM
                </h2>
                <p className="text-xs text-slate-500">
                  Register a walk-in or WhatsApp inquiry guest. Future bookings with matching email or phone will link automatically.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="rounded-xl p-1.5 text-slate-500 hover:bg-slate-100"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={(event) => void handleAddCustomer(event)} className="space-y-4 p-6">
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <label className="block text-xs font-bold text-slate-700 sm:col-span-2">
                  Customer Full Name *
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={160}
                    placeholder="e.g. David Miller"
                    value={addForm.full_name}
                    onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                  />
                </label>

                <label className="block text-xs font-bold text-slate-700">
                  Email Address
                  <input
                    type="email"
                    maxLength={254}
                    placeholder="guest@example.com"
                    value={addForm.email}
                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                  />
                </label>

                <label className="block text-xs font-bold text-slate-700">
                  Phone Number
                  <input
                    type="text"
                    maxLength={30}
                    placeholder="+94 77 123 4567"
                    value={addForm.phone}
                    onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                  />
                </label>

                <label className="block text-xs font-bold text-slate-700">
                  WhatsApp Number
                  <input
                    type="text"
                    maxLength={30}
                    placeholder="+94 77 123 4567"
                    value={addForm.whatsapp}
                    onChange={(e) => setAddForm({ ...addForm, whatsapp: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                  />
                </label>

                <label className="block text-xs font-bold text-slate-700">
                  Country
                  <input
                    type="text"
                    maxLength={100}
                    placeholder="e.g. Australia, UK, Sri Lanka"
                    value={addForm.country}
                    onChange={(e) => setAddForm({ ...addForm, country: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                  />
                </label>

                <label className="block text-xs font-bold text-slate-700 sm:col-span-2">
                  VIP / Loyalty Tier
                  <select
                    value={addForm.vip_status}
                    onChange={(e) =>
                      setAddForm({ ...addForm, vip_status: e.target.value as CustomerVipStatus })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                  >
                    <option value="standard">Standard</option>
                    <option value="repeat">Repeat Guest</option>
                    <option value="vip">VIP Guest</option>
                  </select>
                </label>

                <label className="block text-xs font-bold text-slate-700 sm:col-span-2">
                  Confidential Admin CRM Notes
                  <textarea
                    rows={3}
                    maxLength={4000}
                    placeholder="Inquiry source, preferred vehicle category, travel dates, or VIP notes..."
                    value={addForm.notes}
                    onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-medium text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                  />
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCrm}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  {savingCrm ? 'Saving…' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
