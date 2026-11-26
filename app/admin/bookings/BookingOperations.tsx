'use client';

import { useState } from 'react';
import { colomboInput, colomboInputToInstant } from '@/lib/booking-time';
import { Calculator, Clock, Send } from 'lucide-react';

type Leg = { sequence_no: number; pickup_at: string; planned_end_at: string | null };
type Result = {
  success?: boolean;
  error?: string;
  data?: {
    quote_id?: string | null;
    total?: number | string | null;
    suggested_total?: number | string | null;
    acceptance_url?: string | null;
  };
};

function defaultExpiryInput(hoursFromNow = 48): string {
  return colomboInput(new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString());
}

function defaultLegEndInput(pickupAt: string, hoursAfter = 4): string {
  const pickupMs = Date.parse(pickupAt);
  const baseMs = Number.isFinite(pickupMs) ? pickupMs : Date.now();
  return colomboInput(new Date(baseMs + hoursAfter * 60 * 60 * 1000).toISOString());
}

export default function BookingOperations({
  bookingId,
  status,
  currency: initialCurrency,
  legs,
  onUpdated,
}: {
  bookingId: string;
  status: string;
  currency: string;
  legs: Leg[];
  onUpdated: (acceptanceUrl?: string | null) => Promise<void>;
}) {
  const [ends, setEnds] = useState<Record<number, string>>({});
  const [quoteCurrency, setQuoteCurrency] = useState<'LKR' | 'USD'>(
    initialCurrency === 'USD' ? 'USD' : 'LKR'
  );
  const [expiry, setExpiry] = useState<string>(() => defaultExpiryInput(48));
  const [amount, setAmount] = useState('');
  const [quoteNote, setQuoteNote] = useState('');
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const editableSchedule = ['pending', 'reviewing'].includes(status);
  const quotable = ['pending', 'reviewing', 'quoted'].includes(status);

  async function postOp(body: Record<string, unknown>): Promise<Result> {
    const response = await fetch('/api/operations/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: bookingId, ...body }),
    });
    const result = (await response.json()) as Result;
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Booking operation failed.');
    }
    return result;
  }

  async function ensureLegEndTimes() {
    for (const leg of legs) {
      const customEnd = ends[leg.sequence_no];
      if (!leg.planned_end_at || customEnd) {
        const inputVal =
          customEnd ??
          (leg.planned_end_at
            ? colomboInput(leg.planned_end_at)
            : defaultLegEndInput(leg.pickup_at, 4));
        const plannedEnd = colomboInputToInstant(inputVal);
        const pickup = Date.parse(leg.pickup_at);
        if (Number.isFinite(pickup) && Date.parse(plannedEnd) > pickup && editableSchedule) {
          await postOp({
            action: 'set_end_time',
            sequence_no: leg.sequence_no,
            planned_end_at: plannedEnd,
          });
        }
      }
    }
  }

  async function saveEnd(leg: Leg) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const inputVal =
        ends[leg.sequence_no] ??
        (leg.planned_end_at ? colomboInput(leg.planned_end_at) : defaultLegEndInput(leg.pickup_at, 4));
      const plannedEnd = colomboInputToInstant(inputVal);
      const pickup = Date.parse(leg.pickup_at);
      if (!Number.isFinite(pickup) || Date.parse(plannedEnd) <= pickup) {
        throw new Error('Expected end time must be after pickup time.');
      }
      setSuggestion(null);
      await postOp({
        action: 'set_end_time',
        sequence_no: leg.sequence_no,
        planned_end_at: plannedEnd,
      });
      setMessage(`Leg ${leg.sequence_no} expected end time saved.`);
      await onUpdated();
    } catch (inputError) {
      setError(inputError instanceof Error ? inputError.message : 'Invalid expected end time.');
    } finally {
      setBusy(false);
    }
  }

  async function calculateSuggestion() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await ensureLegEndTimes();
      const result = await postOp({ action: 'suggest_quote', currency: quoteCurrency });
      if (result.data?.suggested_total == null) {
        throw new Error('No pricing rule matched. Enter a manual quotation amount below.');
      }
      const suggestedStr = Number(result.data.suggested_total).toFixed(2);
      setSuggestion(suggestedStr);
      setAmount(suggestedStr);
      setMessage(`Calculated price (${quoteCurrency} ${suggestedStr}) pre-filled below. Click "Issue Quote" to send.`);
    } catch (calcError) {
      setError(calcError instanceof Error ? calcError.message : 'Could not calculate price suggestion.');
    } finally {
      setBusy(false);
    }
  }

  async function handleIssueQuote(mode: 'manual_quote' | 'issue_quote') {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const expiresAt = colomboInputToInstant(expiry || defaultExpiryInput(48));
      if (Date.parse(expiresAt) <= Date.now()) {
        throw new Error('Quote expiry must be in the future.');
      }
      if (mode === 'manual_quote') {
        const trimmed = amount.trim();
        if (!/^\d{1,10}(\.\d{1,2})?$/.test(trimmed) || Number(trimmed) <= 0) {
          throw new Error('Enter a valid positive quotation amount (up to 2 decimal places).');
        }
      }

      await ensureLegEndTimes();

      const result = await postOp({
        action: mode,
        currency: quoteCurrency,
        expires_at: expiresAt,
        ...(mode === 'manual_quote' ? { amount: Number(amount.trim()).toFixed(2) } : {}),
        ...(quoteNote.trim() ? { customer_message: quoteNote.trim() } : {}),
      });

      if (quoteNote.trim()) {
        setQuoteNote('');
      }

      setMessage('Quotation issued successfully! Share the guest acceptance link below with the customer.');
      await onUpdated(result.data?.acceptance_url ?? null);
    } catch (issueError) {
      setError(issueError instanceof Error ? issueError.message : 'Quote could not be issued.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900">Prepare &amp; Issue Quotation</h3>
          <p className="text-xs text-slate-500">
            Auto-calculate from pricing rules or enter a custom price in LKR or USD.
          </p>
        </div>
        {quotable && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void calculateSuggestion()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-bold text-blue-800 hover:bg-blue-100 disabled:opacity-50 transition"
          >
            <Calculator className="h-4 w-4" /> Auto-Calculate from Pricing Rules
          </button>
        )}
      </div>

      {/* Trip Leg Expected End Times (Required by DB before quote issuance) */}
      {editableSchedule && (
        <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200/80 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-slate-500" /> Trip Leg Expected End Time (Sri Lanka Time)
            </span>
            <span className="text-[11px] text-slate-500">
              Auto-filled (+4 hrs) if not set; adjust for multi-day tours
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {legs.map((leg) => (
              <div key={leg.sequence_no} className="flex items-end gap-2">
                <label className="flex-1 text-xs font-semibold text-slate-700">
                  Leg {leg.sequence_no} Expected End
                  <input
                    type="datetime-local"
                    value={
                      ends[leg.sequence_no] ??
                      (leg.planned_end_at
                        ? colomboInput(leg.planned_end_at)
                        : defaultLegEndInput(leg.pickup_at, 4))
                    }
                    onChange={(event) =>
                      setEnds({ ...ends, [leg.sequence_no]: event.target.value })
                    }
                    className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-2 text-xs font-medium text-slate-900"
                  />
                </label>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void saveEnd(leg)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {quotable ? (
        <div className="space-y-4">
          {suggestion !== null && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-2.5 text-xs">
              <span className="font-bold text-blue-950">
                Pricing-Rule Suggested Total: {quoteCurrency} {suggestion}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleIssueQuote('issue_quote')}
                className="rounded-lg bg-blue-700 px-3 py-1.5 font-bold text-white hover:bg-blue-800"
              >
                Issue Rule Quote ({quoteCurrency} {suggestion})
              </button>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-xs font-bold text-slate-700">
              Currency
              <select
                value={quoteCurrency}
                onChange={(e) => {
                  setQuoteCurrency(e.target.value as 'LKR' | 'USD');
                  setSuggestion(null);
                }}
                className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm font-bold text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                <option value="LKR">LKR (Sri Lankan Rupee)</option>
                <option value="USD">USD (US Dollar)</option>
              </select>
            </label>

            <label className="block text-xs font-bold text-slate-700">
              Quotation Amount ({quoteCurrency})
              <input
                type="number"
                step="0.01"
                min="0.01"
                inputMode="decimal"
                placeholder="e.g. 25000.00"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm font-bold text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </label>

            <div className="block text-xs font-bold text-slate-700">
              <div className="flex items-center justify-between">
                <span>Quote Validity Expiry</span>
                <div className="flex gap-1">
                  {[
                    { label: '24h', hrs: 24 },
                    { label: '48h', hrs: 48 },
                    { label: '7d', hrs: 168 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setExpiry(defaultExpiryInput(preset.hrs))}
                      className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 hover:bg-blue-100 hover:text-blue-800"
                    >
                      +{preset.label}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="datetime-local"
                value={expiry}
                onChange={(event) => setExpiry(event.target.value)}
                className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 block text-xs font-bold text-slate-700">
              Quotation Inclusions / Note (Optional)
              <input
                type="text"
                maxLength={300}
                placeholder="e.g. Includes highway tolls, fuel, driver accommodation & airport parking"
                value={quoteNote}
                onChange={(e) => setQuoteNote(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </label>

            <button
              type="button"
              disabled={busy || !amount.trim() || Number(amount) <= 0}
              onClick={() => void handleIssueQuote('manual_quote')}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-xs font-black text-white shadow-sm hover:bg-blue-800 disabled:opacity-50 transition"
            >
              <Send className="h-4 w-4" />
              {busy
                ? 'Issuing Quote…'
                : status === 'quoted'
                  ? 'Issue Revised Quote'
                  : 'Issue Quote'}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs font-medium text-slate-600">
          This booking is already <b>{status.replaceAll('_', ' ')}</b>. Active quotations are locked once accepted.
        </p>
      )}

      {message && (
        <p aria-live="polite" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
          {error}
        </p>
      )}
    </section>
  );
}
