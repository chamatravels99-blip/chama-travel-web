'use client';

import { useState } from 'react';
import { colomboInput, colomboInputToInstant } from '@/lib/booking-time';

type Leg = { sequence_no: number; pickup_at: string; planned_end_at: string | null };
type Result = { success?: boolean; error?: string; data?: { suggested_total?: number | string | null; acceptance_url?: string | null } };

export default function BookingOperations({
  bookingId, status, currency, legs, onUpdated,
}: {
  bookingId: string;
  status: string;
  currency: string;
  legs: Leg[];
  onUpdated: (acceptanceUrl?: string | null) => Promise<void>;
}) {
  const [ends, setEnds] = useState<Record<number, string>>({});
  const [expiry, setExpiry] = useState('');
  const [amount, setAmount] = useState('');
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const editableSchedule = ['pending', 'reviewing'].includes(status);
  const quotable = ['pending', 'reviewing', 'quoted'].includes(status);

  async function run(body: Record<string, unknown>, refresh: boolean) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/operations/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId, ...body }),
      });
      const result = await response.json() as Result;
      if (!response.ok || !result.success) throw new Error(result.error || 'Booking operation failed.');
      if (body.action === 'suggest_quote') {
        if (result.data?.suggested_total == null) throw new Error('No price suggestion was returned.');
        setSuggestion(String(result.data.suggested_total));
        setMessage('Suggestion calculated from the active pricing rules. It is not a quote.');
      } else {
        setMessage('Booking updated.');
      }
      if (refresh) await onUpdated(result.data?.acceptance_url);
    } catch (operationError) {
      setError(operationError instanceof Error ? operationError.message : 'Booking operation failed.');
    } finally {
      setBusy(false);
    }
  }

  function saveEnd(leg: Leg) {
    try {
      const plannedEnd = colomboInputToInstant(ends[leg.sequence_no] ?? (leg.planned_end_at ? colomboInput(leg.planned_end_at) : ''));
      const pickup = Date.parse(leg.pickup_at);
      if (!Number.isFinite(pickup) || Date.parse(plannedEnd) <= pickup) throw new Error('Expected end must be after a valid pickup time.');
      setSuggestion(null);
      void run({ action: 'set_end_time', sequence_no: leg.sequence_no, planned_end_at: plannedEnd }, true);
    } catch (inputError) {
      setError(inputError instanceof Error ? inputError.message : 'Invalid expected end time.');
    }
  }

  function issue(action: 'manual_quote' | 'issue_quote') {
    try {
      const expiresAt = colomboInputToInstant(expiry);
      if (Date.parse(expiresAt) <= Date.now()) throw new Error('Quote expiry must be in the future.');
      if (action === 'manual_quote' && !/^\d{1,10}(\.\d{1,2})?$/.test(amount.trim())) {
        throw new Error('Enter a positive amount with at most two decimal places.');
      }
      if (action === 'manual_quote' && Number(amount) <= 0) throw new Error('Quote amount must be positive.');
      const warning = action === 'issue_quote' ? ' Pricing is recalculated when issued and may differ from the suggestion.' : '';
      if (!window.confirm(`${status === 'quoted' ? 'Replace the current quote' : 'Issue this quote'}?${warning}`)) return;
      void run({ action, currency, expires_at: expiresAt, ...(action === 'manual_quote' ? { amount } : {}) }, true);
    } catch (inputError) {
      setError(inputError instanceof Error ? inputError.message : 'Invalid quote details.');
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="font-extrabold text-slate-900">Review and quotation</h3>
      {status === 'pending' && <button type="button" disabled={busy} onClick={() => void run({ action: 'set_review' }, true)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold disabled:opacity-50">Mark under review</button>}
      {editableSchedule ? legs.map((leg) => (
        <div key={leg.sequence_no} className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-semibold">Leg {leg.sequence_no} expected end (Sri Lanka time)
            <input type="datetime-local" value={ends[leg.sequence_no] ?? (leg.planned_end_at ? colomboInput(leg.planned_end_at) : '')} onChange={(event) => setEnds({ ...ends, [leg.sequence_no]: event.target.value })} className="mt-1 block rounded-lg border border-slate-300 p-2 text-sm" />
          </label>
          <button type="button" disabled={busy} onClick={() => saveEnd(leg)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold disabled:opacity-50">Save end time</button>
        </div>
      )) : <p className="text-xs text-slate-600">Schedule changes are locked after a quote is issued.</p>}
      {quotable && (
        <div className="space-y-3 border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-600">Currency: {currency}. Times are in Sri Lanka time. Issuing a quote is a separate action from calculating a suggestion.</p>
          <button type="button" disabled={busy} onClick={() => void run({ action: 'suggest_quote', currency }, false)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold disabled:opacity-50">Calculate pricing-rule suggestion</button>
          {suggestion !== null && <p className="text-sm font-bold">Pricing-rule suggestion: {currency} {suggestion}</p>}
          <label className="block text-xs font-semibold">Quote expiry
            <input type="datetime-local" value={expiry} onChange={(event) => setExpiry(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 p-2 text-sm" />
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs font-semibold">Manual amount ({currency})
              <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 p-2 text-sm" />
            </label>
            <button type="button" disabled={busy} onClick={() => issue('manual_quote')} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Issue manual quote</button>
            <button type="button" disabled={busy || suggestion === null} onClick={() => issue('issue_quote')} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Issue pricing-rule quote</button>
          </div>
        </div>
      )}
      {message && <p aria-live="polite" className="text-xs text-emerald-700">{message}</p>}
      {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
    </section>
  );
}
