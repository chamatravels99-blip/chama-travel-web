'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw } from 'lucide-react';

type Claim = {
  id: string;
  booking_id: string;
  booking_ref: string;
  customer_name: string;
  quote_id: string;
  amount: number;
  currency: string;
  method: string;
  customer_reference: string | null;
  claim_status: string;
  submitted_at: string;
};
type Payment = {
  id: string;
  booking_ref: string;
  entry_type: string;
  original_payment_id: string | null;
  amount: number;
  currency: string;
  method: string;
  refund_reason: string | null;
  verified_at: string;
};
type Settlement = {
  id: string;
  booking_ref: string;
  driver_name: string;
  currency: string;
  amount: number;
  settlement_status: 'pending' | 'paid';
  payout_method: string | null;
  payout_reference: string | null;
  created_at: string;
  paid_at: string | null;
};
type SettlementCandidate = {
  assignment_id: string;
  booking_ref: string;
  driver_name: string;
  currency: string;
  quote_total: number;
};

export default function PaymentsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [settlementCandidates, setSettlementCandidates] = useState<SettlementCandidate[]>([]);
  const [settlementAmounts, setSettlementAmounts] = useState<Record<string, string>>({});
  const [payoutDetails, setPayoutDetails] = useState<Record<string, { method: string; reference: string }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({});
  const [refunds, setRefunds] = useState<Record<string, { amount: string; reason: string }>>({});
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/payments', { cache: 'no-store' });
      const result = await response.json() as {
        success?: boolean;
        error?: string;
        data?: {
          claims: Claim[];
          payments: Payment[];
          settlements: Settlement[];
          settlement_candidates: SettlementCandidate[];
        };
      };
      if (!response.ok || !result.success || !result.data) throw new Error(result.error || 'Finance data could not be loaded.');
      setClaims(result.data.claims);
      setPayments(result.data.payments);
      setSettlements(result.data.settlements);
      setSettlementCandidates(result.data.settlement_candidates);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Finance data could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function submit(body: Record<string, unknown>): Promise<{ created?: boolean }> {
    const response = await fetch('/api/admin/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = await response.json() as { success?: boolean; error?: string; created?: boolean };
    if (!response.ok || !result.success) throw new Error(result.error || 'Finance operation failed.');
    return { created: result.created };
  }

  async function reviewClaim(claimId: string, approve: boolean) {
    setBusy(claimId);
    setNotice('');
    try {
      await submit({ action: 'review_claim', claim_id: claimId, approve, note: reviewNote[claimId] ?? '' });
      setNotice(approve ? 'Payment claim verified and recorded in the ledger.' : 'Payment claim rejected.');
      await load();
    } catch (actionError) {
      setNotice(actionError instanceof Error ? actionError.message : 'Claim review failed.');
    } finally {
      setBusy('');
    }
  }

  async function refundPayment(paymentId: string) {
    const input = refunds[paymentId] ?? { amount: '', reason: '' };
    setBusy(paymentId);
    setNotice('');
    try {
      await submit({ action: 'refund', payment_id: paymentId, amount: input.amount, reason: input.reason });
      setNotice('Refund entry recorded. The payment ledger is append-only.');
      await load();
    } catch (actionError) {
      setNotice(actionError instanceof Error ? actionError.message : 'Refund failed.');
    } finally {
      setBusy('');
    }
  }

  async function createSettlement(candidate: SettlementCandidate) {
    setBusy(candidate.assignment_id);
    setNotice('');
    try {
      const result = await submit({
        action: 'create_settlement',
        assignment_id: candidate.assignment_id,
        amount: settlementAmounts[candidate.assignment_id] ?? '',
      });
      setNotice(result.created === false
        ? `A matching pending settlement already exists for ${candidate.booking_ref}.`
        : `Pending settlement created for ${candidate.booking_ref}.`);
      await load();
    } catch (actionError) {
      setNotice(actionError instanceof Error ? actionError.message : 'Settlement creation failed.');
    } finally {
      setBusy('');
    }
  }

  async function paySettlement(settlementId: string) {
    const payout = payoutDetails[settlementId] ?? { method: 'bank_transfer', reference: '' };
    setBusy(settlementId);
    setNotice('');
    try {
      await submit({
        action: 'pay_settlement',
        settlement_id: settlementId,
        method: payout.method,
        reference: payout.reference,
      });
      setNotice('Driver payout recorded or already recorded with these details.');
      await load();
    } catch (actionError) {
      setNotice(actionError instanceof Error ? actionError.message : 'Payout recording failed.');
    } finally {
      setBusy('');
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <Link href="/admin/dashboard" className="inline-flex items-center gap-1 text-xs font-bold text-blue-700"><ArrowLeft className="h-4 w-4" />Operations</Link>
            <h1 className="mt-2 text-2xl font-black text-slate-900">Payments & refunds</h1>
            <p className="text-sm text-slate-500">Only Admin and Super Admin can verify claims or add immutable refund entries.</p>
          </div>
          <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white"><RefreshCw className="h-4 w-4" />Refresh</button>
        </header>
        {error && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        {notice && <p className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900" aria-live="polite">{notice}</p>}

        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100"><h2 className="font-extrabold">Submitted claims</h2></div>
          {loading ? <p className="p-6 text-sm text-slate-500">Loading…</p> : claims.filter((claim) => claim.claim_status === 'submitted').length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No submitted claims need review.</p>
          ) : claims.filter((claim) => claim.claim_status === 'submitted').map((claim) => (
            <article key={claim.id} className="p-5 border-b border-slate-100 space-y-3">
              <div className="flex flex-wrap justify-between gap-2">
                <div><b>{claim.booking_ref}</b> · {claim.customer_name}<p className="text-xs text-slate-500">{claim.method.replaceAll('_', ' ')} · {claim.currency} {Number(claim.amount).toFixed(2)} · {new Date(claim.submitted_at).toLocaleString()}</p></div>
                <span className="text-xs text-slate-500">Customer reference: {claim.customer_reference || '—'}</span>
              </div>
              <textarea value={reviewNote[claim.id] ?? ''} maxLength={1000} onChange={(event) => setReviewNote({ ...reviewNote, [claim.id]: event.target.value })} placeholder="Optional review note" className="w-full rounded-xl border border-slate-200 p-3 text-sm" />
              <div className="flex justify-end gap-2">
                <button disabled={busy === claim.id} onClick={() => void reviewClaim(claim.id, false)} className="rounded-xl bg-red-50 px-4 py-2 text-xs font-bold text-red-700 disabled:opacity-50">Reject claim</button>
                <button disabled={busy === claim.id} onClick={() => void reviewClaim(claim.id, true)} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Verify payment</button>
              </div>
            </article>
          ))}
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100"><h2 className="font-extrabold">Verified payment ledger</h2></div>
          {payments.length === 0 ? <p className="p-6 text-sm text-slate-500">No verified ledger entries.</p> : payments.map((payment) => (
            <article key={payment.id} className="p-5 border-b border-slate-100 space-y-3">
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <div><b>{payment.booking_ref}</b> · {payment.entry_type} · {payment.currency} {Number(payment.amount).toFixed(2)} · {payment.method.replaceAll('_', ' ')}</div>
                <span className="text-xs text-slate-500">{new Date(payment.verified_at).toLocaleString()}</span>
              </div>
              {payment.entry_type === 'receipt' && (
                <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
                  <input value={refunds[payment.id]?.amount ?? ''} onChange={(event) => setRefunds({ ...refunds, [payment.id]: { ...(refunds[payment.id] ?? { amount: '', reason: '' }), amount: event.target.value } })} placeholder="Refund amount" inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" className="rounded-xl border border-slate-200 p-2.5 text-sm" />
                  <input value={refunds[payment.id]?.reason ?? ''} onChange={(event) => setRefunds({ ...refunds, [payment.id]: { ...(refunds[payment.id] ?? { amount: '', reason: '' }), reason: event.target.value } })} placeholder="Refund reason" maxLength={500} className="rounded-xl border border-slate-200 p-2.5 text-sm" />
                  <button disabled={busy === payment.id} onClick={() => void refundPayment(payment.id)} className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Record refund</button>
                </div>
              )}
              {payment.entry_type === 'refund' && <p className="text-xs text-slate-500">Refund reason: {payment.refund_reason}</p>}
            </article>
          ))}
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h2 className="font-extrabold">Completed trips ready for settlement</h2>
            <p className="mt-1 text-xs text-slate-500">Enter the driver’s earnings amount in the accepted quote currency. It cannot exceed the quote total.</p>
          </div>
          {settlementCandidates.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No completed assignments need a settlement.</p>
          ) : settlementCandidates.map((candidate) => (
            <article key={candidate.assignment_id} className="grid gap-3 border-b border-slate-100 p-5 sm:grid-cols-[1fr_12rem_auto] sm:items-center">
              <div>
                <b>{candidate.booking_ref}</b>
                <p className="text-xs text-slate-500">{candidate.driver_name} · quote limit {candidate.currency} {Number(candidate.quote_total).toFixed(2)}</p>
              </div>
              <input
                value={settlementAmounts[candidate.assignment_id] ?? ''}
                onChange={(event) => setSettlementAmounts({ ...settlementAmounts, [candidate.assignment_id]: event.target.value })}
                placeholder="Driver earnings"
                inputMode="decimal"
                pattern="[0-9]+([.][0-9]{1,2})?"
                aria-label={`Settlement amount for ${candidate.booking_ref}`}
                className="rounded-xl border border-slate-200 p-2.5 text-sm"
              />
              <button
                disabled={busy === candidate.assignment_id}
                onClick={() => void createSettlement(candidate)}
                className="rounded-xl bg-blue-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
              >
                Create settlement
              </button>
            </article>
          ))}
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100"><h2 className="font-extrabold">Driver settlement ledger</h2></div>
          {settlements.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No driver settlements have been recorded.</p>
          ) : settlements.map((settlement) => {
            const payout = payoutDetails[settlement.id] ?? { method: 'bank_transfer', reference: '' };
            return (
              <article key={settlement.id} className="space-y-3 border-b border-slate-100 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <b>{settlement.booking_ref}</b> · {settlement.driver_name}
                    <p className="text-xs text-slate-500">{settlement.currency} {Number(settlement.amount).toFixed(2)} · {settlement.settlement_status}</p>
                  </div>
                  {settlement.paid_at && <span className="text-xs text-slate-500">Paid {new Date(settlement.paid_at).toLocaleString()}</span>}
                </div>
                {settlement.settlement_status === 'pending' && (
                  <div className="grid gap-2 sm:grid-cols-[12rem_1fr_auto]">
                    <select
                      value={payout.method}
                      onChange={(event) => setPayoutDetails({
                        ...payoutDetails,
                        [settlement.id]: { ...payout, method: event.target.value },
                      })}
                      className="rounded-xl border border-slate-200 p-2.5 text-sm"
                    >
                      <option value="bank_transfer">Bank transfer</option>
                      <option value="cash">Cash</option>
                    </select>
                    <input
                      value={payout.reference}
                      onChange={(event) => setPayoutDetails({
                        ...payoutDetails,
                        [settlement.id]: { ...payout, reference: event.target.value },
                      })}
                      maxLength={160}
                      placeholder="Payout reference (optional)"
                      className="rounded-xl border border-slate-200 p-2.5 text-sm"
                    />
                    <button
                      disabled={busy === settlement.id}
                      onClick={() => void paySettlement(settlement.id)}
                      className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                    >
                      Record payout
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
