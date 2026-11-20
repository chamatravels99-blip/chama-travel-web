'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Calendar,
  Car,
  CheckCircle2,
  CreditCard,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Layers,
  Map,
  MapPin,
  PieChart,
  RefreshCw,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import type {
  AnalyticsCurrency,
  BusinessAnalyticsReport,
  MonthlyTrendPoint,
} from '@/lib/admin-analytics';

type CurrencyFocus = 'both' | 'LKR' | 'USD';

function formatMoney(currency: AnalyticsCurrency, amount: number): string {
  const num = Number(amount) || 0;
  return `${currency} ${num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatCompactMoney(currency: AnalyticsCurrency, amount: number): string {
  const num = Number(amount) || 0;
  if (num >= 1_000_000) {
    return `${currency} ${(num / 1_000_000).toFixed(2)}M`;
  }
  if (num >= 1_000) {
    return `${currency} ${(num / 1_000).toFixed(1)}k`;
  }
  return `${currency} ${num.toFixed(0)}`;
}

function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsvFile(filename: string, rows: Array<Array<string | number | null | undefined>>) {
  const csvContent = '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AdminAnalyticsPage() {
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [currencyFocus, setCurrencyFocus] = useState<CurrencyFocus>('both');
  const [chartCurrency, setChartCurrency] = useState<AnalyticsCurrency>('LKR');
  const [hoveredMonthIndex, setHoveredMonthIndex] = useState<number | null>(null);
  const [hoveredVolumeMonthIndex, setHoveredVolumeMonthIndex] = useState<number | null>(null);

  const [report, setReport] = useState<BusinessAnalyticsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportNotice, setExportNotice] = useState('');

  const loadAnalytics = useCallback(async (yearToLoad: string) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ year: yearToLoad });
      const response = await fetch(`/api/admin/analytics?${params}`, {
        cache: 'no-store',
      });
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        data?: BusinessAnalyticsReport;
      };
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || 'Business analytics could not be loaded.');
      }
      setReport(result.data);
    } catch (loadErr) {
      setError(
        loadErr instanceof Error ? loadErr.message : 'Business analytics could not be loaded.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadAnalytics(selectedYear));
  }, [loadAnalytics, selectedYear]);

  function handleCurrencyFocusChange(next: CurrencyFocus) {
    setCurrencyFocus(next);
    if (next === 'LKR' || next === 'USD') {
      setChartCurrency(next);
    }
  }

  // CSV Export 1: Monthly Financial Report
  function handleExportMonthlyFinancialCsv() {
    if (!report) return;
    const scopeTag = report.selected_year === 'all' ? 'all-time' : report.selected_year;
    const rows: Array<Array<string | number>> = [
      [
        'Report Section',
        'Period',
        'Bookings Count',
        'Completed Trips',
        'Cancelled Trips',
        'Booked Value (LKR)',
        'Net Collected (LKR)',
        'Refunds (LKR)',
        'Driver Payouts (LKR)',
        'Booked Value (USD)',
        'Net Collected (USD)',
        'Refunds (USD)',
        'Driver Payouts (USD)',
      ],
    ];

    for (const m of report.monthly_series) {
      rows.push([
        `Monthly (${report.chart_year})`,
        m.month_key,
        m.bookingsCount,
        m.completedCount,
        m.cancelledCount,
        m.bookedLKR.toFixed(2),
        m.collectedLKR.toFixed(2),
        m.refundedLKR.toFixed(2),
        m.driverPayoutsLKR.toFixed(2),
        m.bookedUSD.toFixed(2),
        m.collectedUSD.toFixed(2),
        m.refundedUSD.toFixed(2),
        m.driverPayoutsUSD.toFixed(2),
      ]);
    }

    for (const y of report.annual_series) {
      rows.push([
        'Annual Summary',
        String(y.year),
        y.bookingsCount,
        y.completedCount,
        y.cancelledCount,
        y.bookedLKR.toFixed(2),
        y.collectedLKR.toFixed(2),
        '0.00',
        y.driverPayoutsLKR.toFixed(2),
        y.bookedUSD.toFixed(2),
        y.collectedUSD.toFixed(2),
        '0.00',
        y.driverPayoutsUSD.toFixed(2),
      ]);
    }

    rows.push([
      `KPI Totals (${report.selected_year.toUpperCase()})`,
      report.selected_year.toUpperCase(),
      report.kpis.total_bookings,
      report.kpis.completed_trips,
      report.kpis.cancelled_rejected_trips,
      report.kpis.financials.LKR.gross_quoted_value.toFixed(2),
      report.kpis.financials.LKR.net_payments_collected.toFixed(2),
      report.kpis.financials.LKR.total_refunds.toFixed(2),
      report.kpis.financials.LKR.driver_payouts_paid.toFixed(2),
      report.kpis.financials.USD.gross_quoted_value.toFixed(2),
      report.kpis.financials.USD.net_payments_collected.toFixed(2),
      report.kpis.financials.USD.total_refunds.toFixed(2),
      report.kpis.financials.USD.driver_payouts_paid.toFixed(2),
    ]);

    downloadCsvFile(`chama-monthly-financial-report-${scopeTag}.csv`, rows);
    setExportNotice('Exported Monthly Financial Report (.csv).');
  }

  // CSV Export 2: Top Packages & Destinations
  function handleExportPackagesAndDestinationsCsv() {
    if (!report) return;
    const scopeTag = report.selected_year === 'all' ? 'all-time' : report.selected_year;
    const rows: Array<Array<string | number>> = [
      [
        'Leaderboard Type',
        'Rank',
        'Name / Title',
        'Category / Region',
        'Bookings / Trip Appearances',
        'Completed Trips',
        'Share (%)',
        'Booked Value (LKR)',
        'Collected (LKR)',
        'Booked Value (USD)',
        'Collected (USD)',
      ],
    ];

    for (const pkg of report.top_packages) {
      rows.push([
        'Tour Package / Service',
        pkg.rank,
        pkg.title,
        pkg.category,
        pkg.bookings_count,
        pkg.completed_count,
        pkg.share_pct,
        pkg.booked_lkr.toFixed(2),
        pkg.collected_lkr.toFixed(2),
        pkg.booked_usd.toFixed(2),
        pkg.collected_usd.toFixed(2),
      ]);
    }

    for (const dest of report.top_destinations) {
      rows.push([
        'Destination / Location',
        dest.rank,
        dest.destination,
        dest.region,
        dest.trip_appearances,
        '',
        dest.share_pct,
        dest.booked_lkr.toFixed(2),
        dest.collected_lkr.toFixed(2),
        dest.booked_usd.toFixed(2),
        dest.collected_usd.toFixed(2),
      ]);
    }

    downloadCsvFile(`chama-top-packages-destinations-${scopeTag}.csv`, rows);
    setExportNotice('Exported Top Packages & Destinations (.csv).');
  }

  // CSV Export 3: Driver Performance
  function handleExportDriverPerformanceCsv() {
    if (!report) return;
    const scopeTag = report.selected_year === 'all' ? 'all-time' : report.selected_year;
    const rows: Array<Array<string | number>> = [
      [
        'Driver Name',
        'Phone',
        'Status',
        'Assigned Vehicle',
        'Registration Number',
        'Vehicle Category',
        'Total Assigned Trips',
        'Completed Trips',
        'Active / Upcoming Trips',
        'Cancelled / Released Trips',
        'Completion Rate (%)',
        'Settled Payouts (LKR)',
        'Settled Payouts (USD)',
      ],
    ];

    for (const d of report.driver_performance) {
      rows.push([
        d.driver_name,
        d.driver_phone ?? '',
        d.account_status,
        d.vehicle_name,
        d.vehicle_registration,
        d.vehicle_category,
        d.total_assigned_trips,
        d.completed_trips,
        d.active_upcoming_trips,
        d.cancelled_released_trips,
        d.completion_rate_pct,
        d.settled_lkr.toFixed(2),
        d.settled_usd.toFixed(2),
      ]);
    }

    downloadCsvFile(`chama-driver-performance-${scopeTag}.csv`, rows);
    setExportNotice('Exported Driver & Fleet Performance (.csv).');
  }

  const maxMonthlyRevenue = useMemo(() => {
    if (!report) return 1;
    let maxVal = 0;
    for (const pt of report.monthly_series) {
      const booked = chartCurrency === 'USD' ? pt.bookedUSD : pt.bookedLKR;
      const collected = chartCurrency === 'USD' ? pt.collectedUSD : pt.collectedLKR;
      maxVal = Math.max(maxVal, booked, collected);
    }
    return maxVal > 0 ? maxVal : 1;
  }, [report, chartCurrency]);

  const maxMonthlyBookings = useMemo(() => {
    if (!report) return 1;
    let maxCount = 0;
    for (const pt of report.monthly_series) {
      maxCount = Math.max(maxCount, pt.bookingsCount);
    }
    return maxCount > 0 ? maxCount : 1;
  }, [report]);

  const activeHoveredRevenuePoint: MonthlyTrendPoint | null = useMemo(() => {
    if (!report) return null;
    if (hoveredMonthIndex !== null && report.monthly_series[hoveredMonthIndex]) {
      return report.monthly_series[hoveredMonthIndex];
    }
    // Default to latest month with activity
    const withActivity = [...report.monthly_series]
      .reverse()
      .find(
        (m) =>
          m.bookedLKR > 0 ||
          m.collectedLKR > 0 ||
          m.bookedUSD > 0 ||
          m.collectedUSD > 0 ||
          m.bookingsCount > 0
      );
    return withActivity ?? report.monthly_series[new Date().getMonth()] ?? null;
  }, [report, hoveredMonthIndex]);

  const activeHoveredVolumePoint: MonthlyTrendPoint | null = useMemo(() => {
    if (!report) return null;
    if (hoveredVolumeMonthIndex !== null && report.monthly_series[hoveredVolumeMonthIndex]) {
      return report.monthly_series[hoveredVolumeMonthIndex];
    }
    const withActivity = [...report.monthly_series]
      .reverse()
      .find((m) => m.bookingsCount > 0);
    return withActivity ?? report.monthly_series[new Date().getMonth()] ?? null;
  }, [report, hoveredVolumeMonthIndex]);

  const showLKR = currencyFocus === 'both' || currencyFocus === 'LKR';
  const showUSD = currencyFocus === 'both' || currencyFocus === 'USD';

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* 1. TOP HEADER, YEAR FILTER & CSV EXPORT TOOLBAR */}
        <header className="flex flex-col gap-5 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Link
                  href="/admin/dashboard"
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
                </Link>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-800">
                  <BarChart3 className="h-3.5 w-3.5" /> Business Intelligence &amp; Multi-Currency Reports
                </span>
                <Link
                  href="/admin/reports/financial"
                  className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
                >
                  Custom Date-Range Ledger <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                Business Analytics &amp; Financial Reports
              </h1>
              <p className="mt-1.5 text-sm text-slate-600">
                Real-time multi-currency performance across bookings, verified payment collections, top tour packages, popular destinations, and driver completion rates.
              </p>
            </div>

            {/* Filter & Refresh Controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Year Selector */}
              <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5">
                <Calendar className="h-4 w-4 text-blue-600" />
                <label htmlFor="analytics-year-select" className="text-xs font-bold text-slate-500">
                  Period:
                </label>
                <select
                  id="analytics-year-select"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="bg-transparent text-xs font-black text-slate-900 focus:outline-none"
                >
                  <option value="all">All Time</option>
                  {(report?.available_years ?? [2026]).map((yr) => (
                    <option key={yr} value={String(yr)}>
                      Year {yr}
                    </option>
                  ))}
                </select>
              </div>

              {/* Currency View Toggle */}
              <div
                className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1"
                role="group"
                aria-label="Currency display focus"
              >
                {(
                  [
                    { id: 'both', label: 'Both LKR & USD' },
                    { id: 'LKR', label: 'LKR Focus' },
                    { id: 'USD', label: 'USD Focus' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleCurrencyFocusChange(opt.id)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                      currencyFocus === opt.id
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => void loadAnalytics(selectedYear)}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>
          </div>

          {/* One-Click CSV Export Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>One-Click UTF-8 CSV Exports (LKR &amp; USD Strictly Separated):</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!report}
                onClick={handleExportMonthlyFinancialCsv}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white shadow-2xs transition hover:bg-blue-700 disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                Export Monthly Financial Report (.csv)
              </button>
              <button
                type="button"
                disabled={!report}
                onClick={handleExportPackagesAndDestinationsCsv}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 shadow-2xs transition hover:bg-slate-50 disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5 text-blue-600" />
                Export Top Packages &amp; Destinations (.csv)
              </button>
              <button
                type="button"
                disabled={!report}
                onClick={handleExportDriverPerformanceCsv}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 shadow-2xs transition hover:bg-slate-50 disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5 text-emerald-600" />
                Export Driver Performance (.csv)
              </button>
            </div>
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

        {exportNotice && (
          <div
            role="status"
            className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{exportNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setExportNotice('')}
              className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-100"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {loading || !report ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-sm font-medium text-slate-500">
            Calculating multi-currency financial analytics, package rankings, and fleet metrics…
          </div>
        ) : (
          <>
            {/* 2. EXECUTIVE KPI CARDS */}
            <section
              aria-label="Executive KPI Summary"
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              {/* Card 1: Total Bookings & Completion Rate */}
              <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Total Bookings &amp; Completion
                  </span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                    <Layers className="h-5 w-5" />
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-2.5">
                  <p className="text-3xl font-black text-slate-950">
                    {report.kpis.total_bookings}
                  </p>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-extrabold text-emerald-800 border border-emerald-200">
                    {report.kpis.completion_rate_pct}% Completed
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-600">
                  <span>{report.kpis.completed_trips} Completed</span>
                  <span>· {report.kpis.active_upcoming_trips} Active</span>
                  <span>· {report.kpis.cancellation_rate_pct}% Cancelled</span>
                </div>
              </div>

              {/* Card 2: Net Revenue Collected (LKR & USD) */}
              <div className="flex flex-col justify-between rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                    Net Payments Collected
                  </span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                    <TrendingUp className="h-5 w-5" />
                  </span>
                </div>
                <div className="mt-3 space-y-1">
                  {showLKR && (
                    <p className="text-lg font-black text-emerald-950">
                      {formatMoney('LKR', report.kpis.financials.LKR.net_payments_collected)}
                    </p>
                  )}
                  {showUSD && (
                    <p className="text-sm font-extrabold text-emerald-800">
                      {formatMoney('USD', report.kpis.financials.USD.net_payments_collected)}
                    </p>
                  )}
                </div>
                <p className="mt-2 text-[11px] font-medium text-emerald-800">
                  Verified receipts minus refunds (
                  {report.kpis.financials.LKR.total_refunds > 0 ||
                  report.kpis.financials.USD.total_refunds > 0
                    ? `Refunded: ${formatMoney('LKR', report.kpis.financials.LKR.total_refunds)} / ${formatMoney('USD', report.kpis.financials.USD.total_refunds)}`
                    : '0 refunds'}
                  )
                </p>
              </div>

              {/* Card 3: Gross Booked / Quoted Value (LKR & USD) */}
              <div className="flex flex-col justify-between rounded-2xl border border-blue-200/80 bg-blue-50/40 p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-900">
                    Gross Booked &amp; Quoted Value
                  </span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-800">
                    <CreditCard className="h-5 w-5" />
                  </span>
                </div>
                <div className="mt-3 space-y-1">
                  {showLKR && (
                    <p className="text-lg font-black text-blue-950">
                      {formatMoney('LKR', report.kpis.financials.LKR.gross_booked_value)}
                      <span className="ml-1.5 text-[10px] font-bold uppercase text-blue-700">
                        Confirmed
                      </span>
                    </p>
                  )}
                  {showUSD && (
                    <p className="text-sm font-extrabold text-blue-800">
                      {formatMoney('USD', report.kpis.financials.USD.gross_booked_value)}
                      <span className="ml-1.5 text-[10px] font-bold uppercase text-blue-700">
                        Confirmed
                      </span>
                    </p>
                  )}
                </div>
                <p className="mt-2 text-[11px] font-medium text-blue-800">
                  Open sent quotes: {formatMoney('LKR', report.kpis.financials.LKR.pending_quote_value)} ·{' '}
                  {formatMoney('USD', report.kpis.financials.USD.pending_quote_value)}
                </p>
              </div>

              {/* Card 4: Outstanding Balances & Recorded Driver Settlements */}
              <div className="flex flex-col justify-between rounded-2xl border border-amber-200/80 bg-amber-50/40 p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-900">
                    Outstanding Customer Balances
                  </span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                    <Wallet className="h-5 w-5" />
                  </span>
                </div>
                <div className="mt-3 space-y-1">
                  {showLKR && (
                    <p className="text-lg font-black text-amber-950">
                      {formatMoney('LKR', report.kpis.financials.LKR.outstanding_balance)}
                    </p>
                  )}
                  {showUSD && (
                    <p className="text-sm font-extrabold text-amber-800">
                      {formatMoney('USD', report.kpis.financials.USD.outstanding_balance)}
                    </p>
                  )}
                </div>
                <p className="mt-2 text-[11px] font-medium text-amber-900">
                  {report.kpis.has_any_recorded_expenses
                    ? `Recorded driver settlements paid: ${formatMoney('LKR', report.kpis.financials.LKR.driver_payouts_paid)} / ${formatMoney('USD', report.kpis.financials.USD.driver_payouts_paid)}`
                    : 'Driver settlements: No recorded expenses'}
                </p>
              </div>
            </section>

            {/* 3. INTERACTIVE VISUAL CHARTS */}
            <section
              aria-label="Revenue and booking volume charts"
              className="grid grid-cols-1 gap-6 lg:grid-cols-12"
            >
              {/* CHART 1: Monthly Revenue & Collections Chart (7 cols) */}
              <div className="flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs lg:col-span-7">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-black text-slate-950 flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-blue-600" />
                        Monthly Quoted/Booked vs. Collected Revenue ({report.chart_year})
                      </h2>
                      <p className="text-xs text-slate-500">
                        Hover or focus any month bar to inspect exact {chartCurrency} figures. Currencies are never mixed.
                      </p>
                    </div>

                    {/* LKR / USD Chart Switcher */}
                    <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                      {(['LKR', 'USD'] as const).map((curr) => (
                        <button
                          key={curr}
                          type="button"
                          onClick={() => setChartCurrency(curr)}
                          className={`rounded-lg px-3 py-1 text-xs font-extrabold transition ${
                            chartCurrency === curr
                              ? 'bg-blue-600 text-white shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {curr} Chart
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Interactive Hover Tooltip Banner */}
                  {activeHoveredRevenuePoint && (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="rounded-lg bg-slate-900 px-2.5 py-1 font-black text-white">
                          {activeHoveredRevenuePoint.month_label} {report.chart_year}
                        </span>
                        <span className="font-semibold text-slate-600">
                          {activeHoveredRevenuePoint.bookingsCount} booking
                          {activeHoveredRevenuePoint.bookingsCount === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4">
                        <span className="inline-flex items-center gap-1.5 font-bold text-blue-800">
                          <span className="h-2.5 w-2.5 rounded-xs bg-blue-600" />
                          Quoted/Booked:{' '}
                          {formatMoney(
                            chartCurrency,
                            chartCurrency === 'USD'
                              ? activeHoveredRevenuePoint.bookedUSD
                              : activeHoveredRevenuePoint.bookedLKR
                          )}
                        </span>
                        <span className="inline-flex items-center gap-1.5 font-bold text-emerald-800">
                          <span className="h-2.5 w-2.5 rounded-xs bg-emerald-500" />
                          Net Collected:{' '}
                          {formatMoney(
                            chartCurrency,
                            chartCurrency === 'USD'
                              ? activeHoveredRevenuePoint.collectedUSD
                              : activeHoveredRevenuePoint.collectedLKR
                          )}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Pure Responsive SVG Grouped Bar Chart (Jan–Dec) */}
                  <div className="mt-5">
                    <svg
                      viewBox="0 0 640 230"
                      className="h-56 w-full select-none overflow-visible"
                      role="img"
                      aria-label={`Monthly booked and collected revenue chart in ${chartCurrency} for ${report.chart_year}`}
                    >
                      {/* Horizontal Grid Lines */}
                      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                        const y = 185 - ratio * 155;
                        const labelVal = maxMonthlyRevenue * ratio;
                        return (
                          <g key={ratio}>
                            <line
                              x1="56"
                              y1={y}
                              x2="628"
                              y2={y}
                              stroke="#e2e8f0"
                              strokeDasharray={ratio === 0 ? undefined : '3 3'}
                              strokeWidth="1"
                            />
                            <text
                              x="50"
                              y={y + 4}
                              textAnchor="end"
                              className="fill-slate-400 text-[9px] font-bold"
                            >
                              {ratio === 0
                                ? '0'
                                : formatCompactMoney(chartCurrency, labelVal).replace(
                                    `${chartCurrency} `,
                                    ''
                                  )}
                            </text>
                          </g>
                        );
                      })}

                      {/* 12 Month Grouped Bars */}
                      {report.monthly_series.map((pt, idx) => {
                        const groupX = 65 + idx * 47;
                        const bookedVal =
                          chartCurrency === 'USD' ? pt.bookedUSD : pt.bookedLKR;
                        const collectedVal =
                          chartCurrency === 'USD' ? pt.collectedUSD : pt.collectedLKR;

                        const bookedHeight =
                          bookedVal > 0
                            ? Math.max((bookedVal / maxMonthlyRevenue) * 155, 4)
                            : 2;
                        const collectedHeight =
                          collectedVal > 0
                            ? Math.max((collectedVal / maxMonthlyRevenue) * 155, 4)
                            : 2;

                        const isHovered = hoveredMonthIndex === idx;

                        return (
                          <g
                            key={pt.month_key}
                            onMouseEnter={() => setHoveredMonthIndex(idx)}
                            onMouseLeave={() => setHoveredMonthIndex(null)}
                            className="cursor-pointer"
                          >
                            {/* Hover column highlight */}
                            <rect
                              x={groupX - 4}
                              y="24"
                              width="40"
                              height="165"
                              rx="6"
                              className={
                                isHovered ? 'fill-blue-50/80' : 'fill-transparent'
                              }
                            />
                            {/* Booked Bar */}
                            <rect
                              x={groupX}
                              y={185 - bookedHeight}
                              width="14"
                              height={bookedHeight}
                              rx="3"
                              className={
                                bookedVal > 0
                                  ? 'fill-blue-600 transition-all duration-200'
                                  : 'fill-slate-200'
                              }
                            >
                              <title>
                                {`${pt.month_label} ${report.chart_year} Quoted/Booked: ${formatMoney(
                                  chartCurrency,
                                  bookedVal
                                )}`}
                              </title>
                            </rect>
                            {/* Collected Bar */}
                            <rect
                              x={groupX + 17}
                              y={185 - collectedHeight}
                              width="14"
                              height={collectedHeight}
                              rx="3"
                              className={
                                collectedVal > 0
                                  ? 'fill-emerald-500 transition-all duration-200'
                                  : 'fill-slate-200'
                              }
                            >
                              <title>
                                {`${pt.month_label} ${report.chart_year} Net Collected: ${formatMoney(
                                  chartCurrency,
                                  collectedVal
                                )}`}
                              </title>
                            </rect>
                            {/* Month Label */}
                            <text
                              x={groupX + 15.5}
                              y="204"
                              textAnchor="middle"
                              className={`text-[10px] font-extrabold ${
                                isHovered ? 'fill-blue-700' : 'fill-slate-500'
                              }`}
                            >
                              {pt.month_label}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                </div>

                {/* Legend & Year-over-Year Mini Summary */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs">
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="inline-flex items-center gap-1.5 font-bold text-slate-700">
                      <span className="h-3 w-3 rounded-xs bg-blue-600" />
                      Quoted / Booked ({chartCurrency})
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-bold text-slate-700">
                      <span className="h-3 w-3 rounded-xs bg-emerald-500" />
                      Net Payments Collected ({chartCurrency})
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500">
                    YoY ({report.chart_year}):{' '}
                    <b className="text-slate-800">
                      {formatMoney(
                        chartCurrency,
                        report.monthly_series.reduce(
                          (s, m) =>
                            s + (chartCurrency === 'USD' ? m.collectedUSD : m.collectedLKR),
                          0
                        )
                      )}
                    </b>{' '}
                    collected
                  </span>
                </div>
              </div>

              {/* CHART 2: Monthly Bookings Volume & Status Breakdown (5 cols) */}
              <div className="flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs lg:col-span-5">
                <div className="space-y-5">
                  <div>
                    <h2 className="text-base font-black text-slate-950 flex items-center gap-2">
                      <PieChart className="h-4 w-4 text-indigo-600" />
                      Bookings Volume &amp; Status Breakdown
                    </h2>
                    <p className="text-xs text-slate-500">
                      Monthly booking velocity ({report.chart_year}) and lifecycle distribution.
                    </p>
                  </div>

                  {/* Mini Monthly Volume Bar Chart */}
                  <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5">
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700">
                        Monthly Trips ({report.chart_year})
                      </span>
                      {activeHoveredVolumePoint && (
                        <span className="font-extrabold text-indigo-800">
                          {activeHoveredVolumePoint.month_label}:{' '}
                          {activeHoveredVolumePoint.bookingsCount} total (
                          {activeHoveredVolumePoint.completedCount} completed)
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-12 items-end gap-1.5 h-24 pt-2">
                      {report.monthly_series.map((pt, idx) => {
                        const heightPct =
                          pt.bookingsCount > 0
                            ? Math.max(
                                Math.round((pt.bookingsCount / maxMonthlyBookings) * 100),
                                14
                              )
                            : 6;
                        const isHovered = hoveredVolumeMonthIndex === idx;
                        return (
                          <button
                            key={pt.month_key}
                            type="button"
                            onMouseEnter={() => setHoveredVolumeMonthIndex(idx)}
                            onMouseLeave={() => setHoveredVolumeMonthIndex(null)}
                            onFocus={() => setHoveredVolumeMonthIndex(idx)}
                            className="group flex h-full flex-col items-center justify-end gap-1 focus:outline-none"
                            title={`${pt.month_label} ${report.chart_year}: ${pt.bookingsCount} bookings (${pt.completedCount} completed)`}
                          >
                            <div className="flex w-full flex-1 items-end justify-center">
                              <div
                                style={{ height: `${heightPct}%` }}
                                className={`w-full rounded-t-md transition-all ${
                                  pt.bookingsCount > 0
                                    ? isHovered
                                      ? 'bg-indigo-700'
                                      : 'bg-indigo-500'
                                    : 'bg-slate-200'
                                }`}
                              />
                            </div>
                            <span className="text-[9px] font-bold text-slate-500">
                              {pt.month_label.slice(0, 1)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Horizontal Progress Breakdown of 4 Lifecycle Buckets */}
                  <div className="space-y-3">
                    {report.status_buckets.map((bucket) => {
                      const barColor =
                        bucket.bucket === 'completed'
                          ? 'bg-emerald-500'
                          : bucket.bucket === 'confirmed_assigned'
                            ? 'bg-blue-600'
                            : bucket.bucket === 'pending_quoted'
                              ? 'bg-amber-500'
                              : 'bg-rose-500';
                      const badgeColor =
                        bucket.bucket === 'completed'
                          ? 'bg-emerald-50 text-emerald-800'
                          : bucket.bucket === 'confirmed_assigned'
                            ? 'bg-blue-50 text-blue-800'
                            : bucket.bucket === 'pending_quoted'
                              ? 'bg-amber-50 text-amber-900'
                              : 'bg-rose-50 text-rose-800';

                      return (
                        <div key={bucket.bucket} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-800">{bucket.label}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-slate-900">
                                {bucket.count}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${badgeColor}`}
                              >
                                {bucket.percentage}%
                              </span>
                            </div>
                          </div>
                          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                              style={{ width: `${Math.min(bucket.percentage, 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Service Type Mini Pills */}
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <p className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Bookings by Service Type
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {report.service_type_breakdown.map((svc) => (
                      <span
                        key={svc.service_type}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-700"
                      >
                        <span>{svc.label}</span>
                        <span className="rounded bg-slate-900 px-1.5 py-0.2 text-[10px] font-black text-white">
                          {svc.bookings_count}
                        </span>
                        <span className="text-[10px] text-slate-500">({svc.share_pct}%)</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* 4. TOP PACKAGES & POPULAR DESTINATIONS LEADERBOARD */}
            <section
              aria-label="Top tour packages and popular destinations leaderboard"
              className="grid grid-cols-1 gap-6 lg:grid-cols-2"
            >
              {/* Left Leaderboard: Most Booked Tour Packages & Service Types */}
              <div className="flex flex-col rounded-3xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
                  <div>
                    <h2 className="text-base font-black text-slate-950 flex items-center gap-2">
                      <Map className="h-4 w-4 text-blue-600" />
                      Most Booked Tour Packages &amp; Services
                    </h2>
                    <p className="text-xs text-slate-500">
                      Ranked by booking volume and associated multi-currency revenue.
                    </p>
                  </div>
                  <Link
                    href="/admin/tour-packages"
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline"
                  >
                    Manage Packages <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>

                {report.top_packages.length === 0 ? (
                  <p className="p-8 text-center text-xs text-slate-500">
                    No package or service bookings found for this period.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {report.top_packages.map((pkg) => (
                      <div key={pkg.title} className="p-4 sm:px-6 space-y-2 hover:bg-slate-50/70">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <span
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black ${
                                pkg.rank === 1
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : pkg.rank === 2
                                    ? 'bg-slate-200 text-slate-800'
                                    : pkg.rank === 3
                                      ? 'bg-orange-100 text-orange-900'
                                      : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              #{pkg.rank}
                            </span>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <h3 className="text-sm font-black text-slate-900 truncate">
                                  {pkg.title}
                                </h3>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                                    pkg.is_catalog_package
                                      ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {pkg.category}
                                </span>
                              </div>
                              <p className="mt-0.5 text-[11px] text-slate-500">
                                <b className="text-slate-800">{pkg.bookings_count}</b> booking
                                {pkg.bookings_count === 1 ? '' : 's'} ({pkg.completed_count}{' '}
                                completed) · <b className="text-blue-700">{pkg.share_pct}%</b> share
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0 text-xs">
                            {showLKR && (pkg.booked_lkr > 0 || pkg.collected_lkr > 0) && (
                              <div className="font-black text-slate-900">
                                {formatMoney('LKR', pkg.booked_lkr)}
                                {pkg.collected_lkr > 0 && (
                                  <span className="block text-[10px] font-bold text-emerald-700">
                                    Paid: {formatMoney('LKR', pkg.collected_lkr)}
                                  </span>
                                )}
                              </div>
                            )}
                            {showUSD && (pkg.booked_usd > 0 || pkg.collected_usd > 0) && (
                              <div className="font-black text-blue-800">
                                {formatMoney('USD', pkg.booked_usd)}
                                {pkg.collected_usd > 0 && (
                                  <span className="block text-[10px] font-bold text-emerald-700">
                                    Paid: {formatMoney('USD', pkg.collected_usd)}
                                  </span>
                                )}
                              </div>
                            )}
                            {pkg.booked_lkr === 0 &&
                              pkg.booked_usd === 0 &&
                              pkg.collected_lkr === 0 &&
                              pkg.collected_usd === 0 && (
                                <span className="text-[11px] font-semibold text-slate-400">
                                  Awaiting quote
                                </span>
                              )}
                          </div>
                        </div>

                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-blue-600"
                            style={{ width: `${Math.min(pkg.share_pct, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Leaderboard: Top Destinations & Popular Routes */}
              <div className="flex flex-col rounded-3xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
                  <div>
                    <h2 className="text-base font-black text-slate-950 flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-emerald-600" />
                      Top Destinations &amp; Popular Locations
                    </h2>
                    <p className="text-xs text-slate-500">
                      Most requested Sri Lankan destinations across booking legs and tour itineraries.
                    </p>
                  </div>
                  <Link
                    href="/admin/destinations"
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline"
                  >
                    Manage Destinations <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>

                {report.top_destinations.length === 0 ? (
                  <p className="p-8 text-center text-xs text-slate-500">
                    No destination data recorded for this period.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {report.top_destinations.slice(0, 10).map((dest) => (
                      <div
                        key={dest.destination}
                        className="p-4 sm:px-6 space-y-2 hover:bg-slate-50/70"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <span
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black ${
                                dest.rank === 1
                                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                  : dest.rank === 2
                                    ? 'bg-slate-200 text-slate-800'
                                    : dest.rank === 3
                                      ? 'bg-teal-100 text-teal-900'
                                      : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              #{dest.rank}
                            </span>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <h3 className="text-sm font-black text-slate-900 truncate">
                                  {dest.destination}
                                </h3>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                                  {dest.region}
                                </span>
                              </div>
                              <p className="mt-0.5 text-[11px] text-slate-500">
                                Featured in <b className="text-slate-800">{dest.trip_appearances}</b>{' '}
                                trip{dest.trip_appearances === 1 ? '' : 's'} ·{' '}
                                <b className="text-emerald-700">{dest.share_pct}%</b> route share
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0 text-xs">
                            {showLKR && dest.booked_lkr > 0 && (
                              <div className="font-black text-slate-900">
                                {formatMoney('LKR', dest.booked_lkr)}
                              </div>
                            )}
                            {showUSD && dest.booked_usd > 0 && (
                              <div className="font-black text-blue-800">
                                {formatMoney('USD', dest.booked_usd)}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{ width: `${Math.min(dest.share_pct * 2.5, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* 5. DRIVER & FLEET PERFORMANCE TABLE */}
            <section
              aria-label="Driver and fleet performance table"
              className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
                <div>
                  <h2 className="text-base font-black text-slate-950 flex items-center gap-2">
                    <Car className="h-5 w-5 text-blue-600" />
                    Driver &amp; Fleet Dispatch Performance ({report.driver_performance.length})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Trip assignments, completion rates, assigned vehicles, and recorded driver settlements.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportDriverPerformanceCsv}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="h-3.5 w-3.5 text-emerald-600" />
                    Export Drivers (.csv)
                  </button>
                  <Link
                    href="/admin/fleet"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3.5 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100"
                  >
                    Manage Fleet &amp; Drivers <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>

              {report.driver_performance.length === 0 ? (
                <p className="p-8 text-center text-xs text-slate-500">
                  No drivers registered in the fleet yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                        <th className="py-3.5 px-6">Driver</th>
                        <th className="py-3.5 px-4">Assigned Vehicle &amp; Plate</th>
                        <th className="py-3.5 px-4 text-center">Total Trips</th>
                        <th className="py-3.5 px-4 text-center">Completed</th>
                        <th className="py-3.5 px-4 text-center">Active / Upcoming</th>
                        <th className="py-3.5 px-4">Completion Rate</th>
                        <th className="py-3.5 px-6 text-right">Recorded Payouts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/80 text-xs">
                      {report.driver_performance.map((driver) => (
                        <tr key={driver.driver_id} className="hover:bg-slate-50/80">
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-xs font-black text-white">
                                {(driver.driver_name.trim()[0] || 'D').toUpperCase()}
                              </div>
                              <div>
                                <div className="font-black text-sm text-slate-950 flex items-center gap-1.5">
                                  {driver.driver_name}
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                                      driver.account_status === 'active'
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : 'bg-slate-100 text-slate-500'
                                    }`}
                                  >
                                    {driver.account_status}
                                  </span>
                                </div>
                                {driver.driver_phone && (
                                  <p className="text-[11px] text-slate-500 font-medium">
                                    {driver.driver_phone}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="py-4 px-4">
                            <div className="font-bold text-slate-900">{driver.vehicle_name}</div>
                            <div className="text-[11px] text-slate-500">
                              Plate:{' '}
                              <span className="font-mono font-semibold text-slate-700">
                                {driver.vehicle_registration}
                              </span>{' '}
                              · {driver.vehicle_category}
                            </div>
                          </td>

                          <td className="py-4 px-4 text-center">
                            <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg bg-slate-900 px-2 font-black text-white">
                              {driver.total_assigned_trips}
                            </span>
                          </td>

                          <td className="py-4 px-4 text-center">
                            <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg bg-emerald-50 px-2 font-black text-emerald-800 border border-emerald-200">
                              {driver.completed_trips}
                            </span>
                          </td>

                          <td className="py-4 px-4 text-center">
                            <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg bg-blue-50 px-2 font-black text-blue-800 border border-blue-200">
                              {driver.active_upcoming_trips}
                            </span>
                          </td>

                          <td className="py-4 px-4 min-w-[160px]">
                            <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                              <span className="text-slate-700">
                                {driver.completion_rate_pct}%
                              </span>
                              {driver.cancelled_released_trips > 0 && (
                                <span className="text-rose-600">
                                  {driver.cancelled_released_trips} released
                                </span>
                              )}
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-emerald-500 transition-all"
                                style={{
                                  width: `${Math.min(driver.completion_rate_pct, 100)}%`,
                                }}
                              />
                            </div>
                          </td>

                          <td className="py-4 px-6 text-right">
                            {driver.settled_lkr === 0 && driver.settled_usd === 0 ? (
                              <span className="text-slate-400 font-medium">
                                No recorded payouts
                              </span>
                            ) : (
                              <div className="space-y-0.5">
                                {driver.settled_lkr > 0 && (
                                  <div className="font-black text-slate-900">
                                    {formatMoney('LKR', driver.settled_lkr)}
                                  </div>
                                )}
                                {driver.settled_usd > 0 && (
                                  <div className="font-black text-blue-800">
                                    {formatMoney('USD', driver.settled_usd)}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
