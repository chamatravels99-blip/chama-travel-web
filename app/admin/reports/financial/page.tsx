'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, RefreshCw } from 'lucide-react';

type MethodTotal = {
  entry_type?: string;
  method: string;
  amount: number;
};
type PeriodTotal = {
  month?: string;
  year?: string;
  customer_received: number;
  customer_refunded: number;
  driver_payouts: number;
};
type CurrencyReport = {
  currency: 'LKR' | 'USD';
  customer_received: number;
  customer_refunded: number;
  net_customer_income: number;
  booking_value: number;
  outstanding_customer_balance: number;
  driver_hire_obligations: number;
  actual_driver_payouts: number;
  outstanding_driver_balance: number;
  customer_payment_methods: MethodTotal[];
  driver_payout_methods: MethodTotal[];
  monthly_summary: PeriodTotal[];
  annual_summary: PeriodTotal[];
};
type FinancialReport = {
  start_date: string;
  end_date: string;
  currencies: CurrencyReport[];
};

function colomboDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function formatAmount(currency: string, value: number) {
  return `${currency} ${Number(value).toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function FinancialReportsPage() {
  const today = colomboDate();
  const [startDate, setStartDate] = useState(`${today.slice(0, 4)}-01-01`);
  const [endDate, setEndDate] = useState(today);
  const [report, setReport] = useState<FinancialReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
      const response = await fetch(`/api/admin/reports/financial?${params}`, { cache: 'no-store' });
      const result = await response.json() as { success?: boolean; error?: string; data?: FinancialReport };
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || 'Financial report could not be loaded.');
      }
      setReport(result.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Financial report could not be loaded.');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  function exportCsv() {
    if (!report) return;
    const rows: Array<Array<string | number>> = [
      ['Category', 'Currency', 'Period', 'Method', 'Type', 'Amount'],
    ];
    for (const currency of report.currencies) {
      rows.push(
        ['Customer received', currency.currency, `${report.start_date} to ${report.end_date}`, '', '', currency.customer_received],
        ['Customer refunds', currency.currency, `${report.start_date} to ${report.end_date}`, '', '', currency.customer_refunded],
        ['Net customer income', currency.currency, `${report.start_date} to ${report.end_date}`, '', '', currency.net_customer_income],
        ['Accepted booking value', currency.currency, `${report.start_date} to ${report.end_date}`, '', 'Quotes accepted in range', currency.booking_value],
        ['Outstanding customer balance', currency.currency, `${report.start_date} to ${report.end_date}`, '', 'Quotes accepted in range', currency.outstanding_customer_balance],
        ['Driver hire obligations', currency.currency, `${report.start_date} to ${report.end_date}`, '', 'Offers accepted/settlements created in range', currency.driver_hire_obligations],
        ['Actual driver payouts', currency.currency, `${report.start_date} to ${report.end_date}`, '', '', currency.actual_driver_payouts],
        ['Outstanding driver balance', currency.currency, `${report.start_date} to ${report.end_date}`, '', 'Accepted hire cohort in range', currency.outstanding_driver_balance],
      );
      for (const method of currency.customer_payment_methods) {
        rows.push(['Customer payment method', currency.currency, `${report.start_date} to ${report.end_date}`, method.method, method.entry_type ?? '', method.amount]);
      }
      for (const method of currency.driver_payout_methods) {
        rows.push(['Driver payout method', currency.currency, `${report.start_date} to ${report.end_date}`, method.method, '', method.amount]);
      }
      for (const period of currency.monthly_summary) {
        rows.push(
          ['Monthly customer received', currency.currency, period.month ?? '', '', '', period.customer_received],
          ['Monthly customer refunds', currency.currency, period.month ?? '', '', '', period.customer_refunded],
          ['Monthly driver payouts', currency.currency, period.month ?? '', '', '', period.driver_payouts],
        );
      }
      for (const period of currency.annual_summary) {
        rows.push(
          ['Annual customer received', currency.currency, period.year ?? '', '', '', period.customer_received],
          ['Annual customer refunds', currency.currency, period.year ?? '', '', '', period.customer_refunded],
          ['Annual driver payouts', currency.currency, period.year ?? '', '', '', period.driver_payouts],
        );
      }
    }
    const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `chama-financial-report-${report.start_date}-to-${report.end_date}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/admin/dashboard" className="inline-flex items-center gap-1 text-xs font-bold text-blue-700">
              <ArrowLeft className="h-4 w-4" />Operations
            </Link>
            <h1 className="mt-2 text-2xl font-black text-slate-900">Financial reports</h1>
            <p className="text-sm text-slate-500">Admin-only server-side aggregates. LKR and USD are never combined.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">
              <RefreshCw className="h-4 w-4" />Refresh
            </button>
            <button type="button" onClick={exportCsv} disabled={!report} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">
              <Download className="h-4 w-4" />Export CSV
            </button>
          </div>
        </header>

        <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="text-xs font-semibold text-slate-600">
            From
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm" />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Through
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm" />
          </label>
          <button type="button" onClick={() => void load()} disabled={loading} className="rounded-xl bg-blue-700 px-5 py-2.5 text-xs font-bold text-white disabled:opacity-50">
            Apply range
          </button>
          <p className="text-xs text-slate-500 sm:col-span-3">Income and payout activity uses transaction dates in Sri Lanka time. Outstanding balances and liabilities include records created/accepted in this range and calculate payments through the end date.</p>
        </section>

        {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        {loading && <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading financial aggregates…</p>}
        {!loading && report && report.currencies.map((currency) => (
          <section key={currency.currency} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <h2 className="text-lg font-extrabold text-slate-900">{currency.currency}</h2>
              <p className="text-xs text-slate-500">{report.start_date} – {report.end_date}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['Customer received', currency.customer_received],
                ['Customer refunds', currency.customer_refunded],
                ['Net customer income', currency.net_customer_income],
                ['Accepted booking value', currency.booking_value],
                ['Outstanding customer balance', currency.outstanding_customer_balance],
                ['Driver hire obligations', currency.driver_hire_obligations],
                ['Actual driver payouts', currency.actual_driver_payouts],
                ['Outstanding driver balance', currency.outstanding_driver_balance],
              ].map(([label, amount]) => (
                <article key={label} className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-500">{label}</p>
                  <p className="mt-2 text-lg font-black text-slate-900">{formatAmount(currency.currency, Number(amount))}</p>
                </article>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-bold text-slate-800">Customer payment methods</h3>
                {currency.customer_payment_methods.length === 0 ? <p className="text-xs text-slate-500">No customer ledger activity in this range.</p> : (
                  <ul className="divide-y divide-slate-100 text-sm">
                    {currency.customer_payment_methods.map((method) => (
                      <li key={`${method.entry_type}-${method.method}`} className="flex justify-between gap-3 py-2">
                        <span>{method.entry_type} · {method.method.replaceAll('_', ' ')}</span>
                        <b>{formatAmount(currency.currency, Number(method.amount))}</b>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="mb-2 text-sm font-bold text-slate-800">Driver payout methods</h3>
                {currency.driver_payout_methods.length === 0 ? <p className="text-xs text-slate-500">No driver payouts in this range.</p> : (
                  <ul className="divide-y divide-slate-100 text-sm">
                    {currency.driver_payout_methods.map((method) => (
                      <li key={method.method} className="flex justify-between gap-3 py-2">
                        <span>{method.method.replaceAll('_', ' ')}</span>
                        <b>{formatAmount(currency.currency, Number(method.amount))}</b>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-bold text-slate-800">Monthly summary</h3>
                {currency.monthly_summary.length === 0 ? <p className="text-xs text-slate-500">No monthly activity in this range.</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[32rem] text-left text-xs">
                      <thead className="text-slate-500"><tr><th className="py-2">Month</th><th>Received</th><th>Refunds</th><th>Driver payouts</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {currency.monthly_summary.map((period) => (
                          <tr key={period.month}><td className="py-2 font-semibold">{period.month}</td><td>{formatAmount(currency.currency, period.customer_received)}</td><td>{formatAmount(currency.currency, period.customer_refunded)}</td><td>{formatAmount(currency.currency, period.driver_payouts)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div>
                <h3 className="mb-2 text-sm font-bold text-slate-800">Annual summary</h3>
                {currency.annual_summary.length === 0 ? <p className="text-xs text-slate-500">No annual activity in this range.</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[32rem] text-left text-xs">
                      <thead className="text-slate-500"><tr><th className="py-2">Year</th><th>Received</th><th>Refunds</th><th>Driver payouts</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {currency.annual_summary.map((period) => (
                          <tr key={period.year}><td className="py-2 font-semibold">{period.year}</td><td>{formatAmount(currency.currency, period.customer_received)}</td><td>{formatAmount(currency.currency, period.customer_refunded)}</td><td>{formatAmount(currency.currency, period.driver_payouts)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
