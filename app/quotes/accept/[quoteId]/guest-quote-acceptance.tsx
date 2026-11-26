'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Briefcase,
  Calendar,
  Car,
  CheckCircle2,
  Clock,
  FileText,
  MapPin,
  MessageSquare,
  Plane,
  ShieldCheck,
  Users,
  XCircle,
} from 'lucide-react';

type QuoteLeg = {
  sequence_no: number;
  pickup_location: string;
  dropoff_location: string;
  pickup_at: string;
  planned_end_at: string | null;
  flight_number: string | null;
  trip_notes: string | null;
};

type GuestQuotePayload = {
  quote: {
    id: string;
    revision: number;
    currency: string;
    total: number | string;
    quote_status: string;
    issued_at: string | null;
    expires_at: string | null;
    accepted_at: string | null;
    customer_message: string | null;
    token_revoked_at: string | null;
    is_expired: boolean;
    can_respond: boolean;
  };
  booking: {
    booking_ref: string;
    customer_name: string;
    service_type: string;
    journey_type: string;
    booking_status: string;
    passenger_count: number;
    luggage_count: number;
    vehicle_preference: string | null;
    customer_notes: string | null;
    legs: QuoteLeg[];
  };
};

type ViewState =
  | 'loading'
  | 'ready'
  | 'confirmed'
  | 'declined'
  | 'unavailable';

function formatColomboDateTime(value: string | null): string {
  if (!value) return 'To be confirmed';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'To be confirmed';
  return parsed.toLocaleString('en-GB', {
    timeZone: 'Asia/Colombo',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatServiceLabel(serviceType: string): string {
  const map: Record<string, string> = {
    airport_transfer: 'Airport Transfer',
    day_trip: 'Day Trip',
    round_tour: 'Chauffeur Round Tour',
    vehicle_hire: 'Private Vehicle Hire',
    custom: 'Custom Journey',
  };
  return map[serviceType] ?? serviceType.replaceAll('_', ' ');
}

function formatJourneyLabel(journeyType: string): string {
  const map: Record<string, string> = {
    one_way: 'One-Way',
    return: 'Return Trip',
    multi_leg: 'Multi-Leg Itinerary',
  };
  return map[journeyType] ?? journeyType.replaceAll('_', ' ');
}

function formatMoney(currency: string, total: number | string): string {
  const num = Number(total);
  if (!Number.isFinite(num)) return `${currency} ${total}`;
  return `${currency} ${num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function GuestQuoteAcceptance({ quoteId }: { quoteId: string }) {
  const fetched = useRef(false);
  const tokenRef = useRef('');
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [details, setDetails] = useState<GuestQuotePayload | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [submitting, setSubmitting] = useState<'accept' | 'decline' | null>(null);
  const [showDeclinePrompt, setShowDeclinePrompt] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;

    const hashToken = window.location.hash.slice(1).trim();
    window.history.replaceState(null, '', window.location.pathname);

    if (!hashToken) {
      void Promise.resolve().then(() => {
        setErrorMessage(
          'This quotation link is incomplete or has already been opened. Please use the full link sent by Chama Travels or contact our team.'
        );
        setViewState('unavailable');
      });
      return;
    }

    tokenRef.current = hashToken;

    void fetch('/api/guest/quotes/details', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ quote_id: quoteId, token: hashToken }),
    })
      .then(async (response) => {
        const result = (await response.json()) as {
          success?: boolean;
          error?: string;
          data?: GuestQuotePayload;
        };
        if (!response.ok || !result.success || !result.data) {
          setErrorMessage(
            result.error || 'This quotation link is invalid, expired, or no longer available.'
          );
          setViewState('unavailable');
          return;
        }
        setDetails(result.data);
        if (result.data.quote.quote_status === 'accepted') {
          setViewState('confirmed');
        } else if (
          result.data.quote.quote_status === 'rejected' ||
          result.data.booking.booking_status === 'cancelled'
        ) {
          setViewState('declined');
        } else {
          setViewState('ready');
        }
      })
      .catch(() => {
        setErrorMessage(
          'We could not load your quotation right now. Please check your connection or contact Chama Travels.'
        );
        setViewState('unavailable');
      });
  }, [quoteId]);

  async function handleConfirmBooking() {
    const activeToken = tokenRef.current;
    if (!activeToken || submitting) return;
    setSubmitting('accept');
    setActionError('');
    try {
      const response = await fetch('/api/guest/quotes/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ quote_id: quoteId, token: activeToken }),
      });
      const result = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !result.success) {
        setActionError(
          result.error || 'This quotation could not be confirmed. It may have expired or already been processed.'
        );
        return;
      }
      setDetails((prev) =>
        prev
          ? {
              ...prev,
              quote: {
                ...prev.quote,
                quote_status: 'accepted',
                accepted_at: new Date().toISOString(),
                can_respond: false,
              },
              booking: {
                ...prev.booking,
                booking_status: 'confirmed',
              },
            }
          : prev
      );
      setViewState('confirmed');
    } catch {
      setActionError(
        'We could not confirm your booking right now. Please try again or contact Chama Travels.'
      );
    } finally {
      setSubmitting(null);
    }
  }

  async function handleDeclineQuotation() {
    const activeToken = tokenRef.current;
    if (!activeToken || submitting) return;
    setSubmitting('decline');
    setActionError('');
    try {
      const response = await fetch('/api/guest/quotes/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          quote_id: quoteId,
          token: activeToken,
          reason: declineReason.trim() || undefined,
        }),
      });
      const result = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !result.success) {
        setActionError(
          result.error || 'This quotation could not be declined. It may have already been processed or expired.'
        );
        return;
      }
      setDetails((prev) =>
        prev
          ? {
              ...prev,
              quote: {
                ...prev.quote,
                quote_status: 'rejected',
                can_respond: false,
              },
              booking: {
                ...prev.booking,
                booking_status: 'cancelled',
              },
            }
          : prev
      );
      setShowDeclinePrompt(false);
      setViewState('declined');
    } catch {
      setActionError(
        'We could not process your cancellation right now. Please try again or contact Chama Travels.'
      );
    } finally {
      setSubmitting(null);
    }
  }

  const firstLeg = details?.booking.legs[0] ?? null;
  const lastLeg = details?.booking.legs[details.booking.legs.length - 1] ?? firstLeg;
  const isExpiredOrClosed =
    viewState === 'ready' && details !== null && !details.quote.can_respond;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Brand Header */}
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest text-blue-700">
                Chama Travels · Sri Lanka
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
                {viewState === 'confirmed'
                  ? 'Booking Confirmed'
                  : viewState === 'declined'
                    ? 'Quotation Declined'
                    : 'Private Hire Quotation'}
              </h1>
            </div>
            {details && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${
                  viewState === 'confirmed'
                    ? 'bg-emerald-50 text-emerald-800 ring-emerald-600/20'
                    : viewState === 'declined'
                      ? 'bg-rose-50 text-rose-800 ring-rose-600/20'
                      : isExpiredOrClosed
                        ? 'bg-amber-50 text-amber-800 ring-amber-600/20'
                        : 'bg-blue-50 text-blue-800 ring-blue-600/20'
                }`}
              >
                {viewState === 'confirmed' && <CheckCircle2 className="h-3.5 w-3.5" />}
                {viewState === 'declined' && <XCircle className="h-3.5 w-3.5" />}
                {viewState === 'confirmed'
                  ? 'Confirmed'
                  : viewState === 'declined'
                    ? 'Declined / Cancelled'
                    : details.quote.token_revoked_at
                      ? 'Link Revoked'
                      : details.quote.is_expired || details.quote.quote_status === 'expired'
                        ? 'Quotation Expired'
                        : details.quote.quote_status === 'superseded'
                          ? 'Superseded by Newer Quote'
                          : 'Awaiting Your Confirmation'}
              </span>
            )}
          </div>
          {details && (
            <p className="mt-2 text-sm text-slate-600">
              Prepared for <span className="font-bold text-slate-900">{details.booking.customer_name}</span> · Ref{' '}
              <span className="font-mono font-bold text-slate-900">{details.booking.booking_ref}</span>
            </p>
          )}
        </header>

        {/* Loading State */}
        {viewState === 'loading' && (
          <section className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-700" />
            <p className="mt-4 text-sm font-semibold text-slate-600" aria-live="polite">
              Loading your secure quotation details…
            </p>
          </section>
        )}

        {/* Unavailable / Invalid Link State */}
        {viewState === 'unavailable' && (
          <section className="rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm">
            <AlertCircle className="mx-auto h-10 w-10 text-rose-500" />
            <h2 className="mt-3 text-lg font-extrabold text-slate-900">
              Quotation Link Unavailable
            </h2>
            <p className="mt-2 text-sm text-slate-600" aria-live="polite">
              {errorMessage}
            </p>
            <p className="mt-4 text-xs text-slate-500">
              Need a fresh quotation link? Contact Chama Travels on WhatsApp and mention your booking reference.
            </p>
          </section>
        )}

        {/* Status Banner for Confirmed / Declined / Expired */}
        {viewState === 'confirmed' && details && (
          <section
            aria-live="polite"
            className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
              <div className="space-y-1">
                <h2 className="text-base font-black text-emerald-950">
                  Thank you! Your booking is confirmed.
                </h2>
                <p className="text-sm text-emerald-900">
                  We have confirmed quotation Revision #{details.quote.revision} (
                  <strong>{formatMoney(details.quote.currency, details.quote.total)}</strong>) for booking{' '}
                  <strong className="font-mono">{details.booking.booking_ref}</strong>. Our dispatch team will assign
                  your chauffeur and send your driver &amp; vehicle details shortly.
                </p>
              </div>
            </div>
          </section>
        )}

        {viewState === 'declined' && details && (
          <section
            aria-live="polite"
            className="rounded-3xl border border-rose-200 bg-rose-50 p-6 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-rose-600" />
              <div className="space-y-1">
                <h2 className="text-base font-black text-rose-950">
                  Quotation Declined &amp; Booking Cancelled
                </h2>
                <p className="text-sm text-rose-900">
                  Quotation Revision #{details.quote.revision} for booking{' '}
                  <strong className="font-mono">{details.booking.booking_ref}</strong> has been declined. If your
                  travel plans change or you would like a revised itinerary, please message Chama Travels anytime.
                </p>
              </div>
            </div>
          </section>
        )}

        {isExpiredOrClosed && details && (
          <section
            aria-live="polite"
            className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <p className="text-sm font-medium text-amber-950">
                {details.quote.token_revoked_at
                  ? 'This quotation link has been revoked by Chama Travels. Please request an updated link.'
                  : details.quote.quote_status === 'superseded'
                    ? 'A newer revised quotation has been issued for this booking. Please use the latest link sent by Chama Travels.'
                    : 'This quotation has expired and can no longer be confirmed online. Please contact Chama Travels to request a fresh quotation.'}
              </p>
            </div>
          </section>
        )}

        {/* Full Hire / Journey Details & Price Summary Cards */}
        {details && (
          <>
            {/* Card 1: Hire / Journey Details */}
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-blue-700" />
                  Hire &amp; Journey Details
                </h2>
                <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                  {formatServiceLabel(details.booking.service_type)} ·{' '}
                  {formatJourneyLabel(details.booking.journey_type)}
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 text-sm">
                <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-100">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Booking Reference
                  </span>
                  <p className="mt-1 font-mono text-sm font-black text-slate-900">
                    {details.booking.booking_ref}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-100">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" /> Travel Date &amp; Pickup Time
                  </span>
                  <p className="mt-1 font-bold text-slate-900">
                    {formatColomboDateTime(firstLeg?.pickup_at ?? null)}
                  </p>
                  <span className="text-[11px] text-slate-500">Sri Lanka Time (IST)</span>
                </div>

                <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-100">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Pickup Location
                  </span>
                  <p className="mt-1 font-bold text-slate-900">
                    {firstLeg?.pickup_location ?? 'As agreed'}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-100">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Drop-off Location
                  </span>
                  <p className="mt-1 font-bold text-slate-900">
                    {lastLeg?.dropoff_location ?? 'As agreed'}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-100 flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-700" />
                    <div>
                      <span className="text-[11px] font-bold uppercase text-slate-400 block">
                        Passengers
                      </span>
                      <p className="font-bold text-slate-900">
                        {details.booking.passenger_count}
                      </p>
                    </div>
                  </div>
                  <div className="h-8 w-px bg-slate-200" />
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-blue-700" />
                    <div>
                      <span className="text-[11px] font-bold uppercase text-slate-400 block">
                        Luggage
                      </span>
                      <p className="font-bold text-slate-900">
                        {details.booking.luggage_count} bags
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-100">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Car className="h-3.5 w-3.5" /> Vehicle Preference
                  </span>
                  <p className="mt-1 font-bold text-slate-900">
                    {details.booking.vehicle_preference || 'Standard Private Vehicle'}
                  </p>
                </div>
              </div>

              {/* Multi-leg breakdown if > 1 leg */}
              {details.booking.legs.length > 1 && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    Full Route Itinerary ({details.booking.legs.length} Legs)
                  </h3>
                  <div className="space-y-2">
                    {details.booking.legs.map((leg) => (
                      <div
                        key={leg.sequence_no}
                        className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 text-xs space-y-1"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-extrabold text-slate-900">
                            Leg {leg.sequence_no}: {leg.pickup_location} → {leg.dropoff_location}
                          </span>
                          <span className="font-semibold text-slate-600">
                            {formatColomboDateTime(leg.pickup_at)}
                          </span>
                        </div>
                        {leg.flight_number && (
                          <p className="text-slate-600 flex items-center gap-1">
                            <Plane className="h-3 w-3 text-blue-600" /> Flight: {leg.flight_number}
                          </p>
                        )}
                        {leg.trip_notes && (
                          <p className="text-slate-600">Notes: {leg.trip_notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Single-leg flight number or customer/trip notes */}
              {(firstLeg?.flight_number ||
                details.booking.customer_notes ||
                (details.booking.legs.length === 1 && firstLeg?.trip_notes)) && (
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 space-y-2 text-xs">
                  {details.booking.legs.length === 1 && firstLeg?.flight_number && (
                    <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <Plane className="h-3.5 w-3.5 text-blue-700" />
                      Flight Number: <span className="font-bold">{firstLeg.flight_number}</span>
                    </p>
                  )}
                  {details.booking.customer_notes && (
                    <div>
                      <span className="font-bold text-slate-700 flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-slate-500" /> Trip &amp; Customer Notes
                      </span>
                      <p className="mt-1 whitespace-pre-line text-slate-600">
                        {details.booking.customer_notes}
                      </p>
                    </div>
                  )}
                  {details.booking.legs.length === 1 &&
                    firstLeg?.trip_notes &&
                    !details.booking.customer_notes?.includes(firstLeg.trip_notes) && (
                      <p className="text-slate-600">
                        <span className="font-bold text-slate-700">Leg Notes: </span>
                        {firstLeg.trip_notes}
                      </p>
                    )}
                </div>
              )}
            </section>

            {/* Card 2: Quotation & Price Summary */}
            <section className="rounded-3xl border border-blue-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <h2 className="text-base font-extrabold text-slate-900">
                  Quotation &amp; Price Summary
                </h2>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800">
                  Revision #{details.quote.revision}
                </span>
              </div>

              <div className="flex flex-wrap items-baseline justify-between gap-4 rounded-2xl bg-gradient-to-r from-blue-950 to-slate-900 p-5 text-white">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-blue-200">
                    Total Quoted Price
                  </span>
                  <p className="mt-1 text-3xl font-black tracking-tight">
                    {formatMoney(details.quote.currency, details.quote.total)}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-xs font-semibold uppercase tracking-wider text-blue-200 flex items-center sm:justify-end gap-1">
                    <Clock className="h-3.5 w-3.5" /> Valid Until
                  </span>
                  <p className="mt-1 text-sm font-bold text-white">
                    {formatColomboDateTime(details.quote.expires_at)}
                  </p>
                </div>
              </div>

              {details.quote.customer_message && (
                <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 text-sm">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" /> Inclusions &amp; Notes from Chama Travels
                  </span>
                  <p className="mt-1.5 whitespace-pre-line text-slate-800">
                    {details.quote.customer_message}
                  </p>
                </div>
              )}

              {/* Action Buttons Below the Details */}
              {viewState === 'ready' && details.quote.can_respond && (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  {actionError && (
                    <div
                      role="alert"
                      className="rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-semibold text-rose-800 flex items-start gap-2"
                    >
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{actionError}</span>
                    </div>
                  )}

                  {!showDeclinePrompt ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        disabled={submitting !== null}
                        onClick={() => void handleConfirmBooking()}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3.5 text-sm font-black text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition"
                      >
                        <CheckCircle2 className="h-5 w-5" />
                        {submitting === 'accept' ? 'Confirming Booking…' : 'Confirm Booking'}
                      </button>

                      <button
                        type="button"
                        disabled={submitting !== null}
                        onClick={() => {
                          setActionError('');
                          setShowDeclinePrompt(true);
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-rose-200 bg-white px-5 py-3.5 text-sm font-bold text-rose-700 hover:bg-rose-50 hover:border-rose-300 disabled:opacity-50 transition"
                      >
                        <XCircle className="h-5 w-5" />
                        Cancel / Decline Quotation
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 space-y-3">
                      <h3 className="text-sm font-extrabold text-rose-950">
                        Are you sure you want to decline this quotation?
                      </h3>
                      <p className="text-xs text-rose-900">
                        Declining will cancel this quotation and booking request. You can share an optional note below
                        (for example, if you prefer a different date, vehicle, or budget).
                      </p>
                      <label className="block text-xs font-bold text-rose-950">
                        Reason (Optional)
                        <textarea
                          rows={2}
                          maxLength={500}
                          value={declineReason}
                          onChange={(e) => setDeclineReason(e.target.value)}
                          placeholder="e.g. Travel dates changed, or requesting a different vehicle..."
                          className="mt-1 block w-full rounded-xl border border-rose-200 bg-white p-2.5 text-xs text-slate-900 focus:border-rose-500 focus:outline-none"
                        />
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={submitting !== null}
                          onClick={() => void handleDeclineQuotation()}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-black text-white hover:bg-rose-700 disabled:opacity-50 transition"
                        >
                          <XCircle className="h-4 w-4" />
                          {submitting === 'decline' ? 'Declining…' : 'Yes, Decline Quotation'}
                        </button>
                        <button
                          type="button"
                          disabled={submitting !== null}
                          onClick={() => setShowDeclinePrompt(false)}
                          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                        >
                          Keep Reviewing
                        </button>
                      </div>
                    </div>
                  )}

                  <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-500">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    Secure one-time link · No account or login required
                  </p>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
