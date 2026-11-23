'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock, FileText, MessageSquarePlus, ShieldAlert } from 'lucide-react';

type BookingEvent = {
  id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  actor_name: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

type InternalNote = {
  id: string;
  note: string;
  author_name: string;
  created_at: string;
};

type ActivityResponse = {
  success?: boolean;
  error?: string;
  data?: { events: BookingEvent[]; internal_notes: InternalNote[] };
};

function formatActivityDate(value: string) {
  return new Date(value).toLocaleString('en-GB', {
    timeZone: 'Asia/Colombo',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatEventTitle(item: BookingEvent): string {
  const type = item.event_type;
  switch (type) {
    case 'booking_created':
      return 'Booking Received';
    case 'booking_status_changed':
      if (item.to_status === 'reviewing') return 'Marked Under Review';
      if (item.to_status === 'quoted') return 'Quotation Sent to Customer';
      if (item.to_status === 'confirmed') return 'Booking Confirmed';
      if (item.to_status === 'assigned') return 'Driver & Vehicle Assigned';
      if (item.to_status === 'in_progress') return 'Trip Started (In Progress)';
      if (item.to_status === 'completed') return 'Trip Completed';
      if (item.to_status === 'cancelled') return 'Booking Cancelled';
      return `Status changed: ${item.from_status ?? ''} → ${item.to_status ?? ''}`.replaceAll('_', ' ');
    case 'quote_status_changed':
      if (item.to_status === 'sent') return 'Quotation Issued';
      if (item.to_status === 'accepted') return 'Customer Accepted Quotation';
      if (item.to_status === 'rejected') return 'Customer Declined Quotation';
      if (item.to_status === 'expired') return 'Quotation Expired';
      return `Quote ${item.to_status ?? 'updated'}`.replaceAll('_', ' ');
    case 'whatsapp_quote_acceptance_recorded':
      return 'Quotation Confirmed via WhatsApp (Admin Override)';
    case 'assignment_status_changed':
      if (item.to_status === 'offered') return 'Driver Assigned to Trip';
      if (item.to_status === 'accepted') return 'Driver Assignment Confirmed';
      if (item.to_status === 'in_progress') return 'Driver Started Trip';
      if (item.to_status === 'completed') return 'Driver Completed Trip';
      if (item.to_status === 'released') return 'Driver Assignment Released';
      return `Driver assignment: ${item.to_status ?? ''}`.replaceAll('_', ' ');
    case 'payment_receipt_recorded': {
      const currency = typeof item.details?.currency === 'string' ? item.details.currency : '';
      const amount = item.details?.amount != null ? Number(item.details.amount).toFixed(2) : '';
      return `Customer Payment Recorded ${currency && amount ? `(${currency} ${amount})` : ''}`.trim();
    }
    case 'payment_refund_recorded':
      return 'Payment Refund Recorded';
    case 'invoice_issued':
      return 'Official Invoice Issued';
    case 'invoice_replaced':
      return 'Replacement Invoice Issued';
    case 'invoice_cancelled':
      return 'Invoice Cancelled';
    case 'receipt_document_issued':
      return 'Official Payment Receipt PDF Generated';
    case 'booking_internal_note_added':
      return 'Admin Internal Note Recorded';
    default:
      return type.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

export default function BookingActivity({ bookingId }: { bookingId: string }) {
  const [events, setEvents] = useState<BookingEvent[]>([]);
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [note, setNote] = useState('');
  const [filter, setFilter] = useState<'all' | 'notes' | 'events'>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadActivity = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/operations/bookings?booking_id=${encodeURIComponent(bookingId)}`,
        { cache: 'no-store' }
      );
      const result = (await response.json()) as ActivityResponse;
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || 'Booking activity could not be loaded.');
      }
      setEvents(result.data.events);
      setNotes(result.data.internal_notes);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Booking activity could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    void Promise.resolve().then(loadActivity);
  }, [loadActivity]);

  async function addNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedNote = note.trim();
    if (!normalizedNote) {
      setError('Enter an internal note before saving.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/operations/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_internal_note',
          booking_id: bookingId,
          note: normalizedNote,
        }),
      });
      const result = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Internal note could not be saved.');
      }
      setNote('');
      setMessage('Internal note saved to booking timeline.');
      await loadActivity();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Internal note could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  const unifiedTimeline = useMemo(() => {
    type TimelineEntry =
      | { kind: 'note'; id: string; created_at: string; author: string; text: string }
      | { kind: 'event'; id: string; created_at: string; actor: string; title: string; subtitle: string | null };

    const items: TimelineEntry[] = [];

    if (filter === 'all' || filter === 'notes') {
      for (const n of notes) {
        items.push({
          kind: 'note',
          id: `note-${n.id}`,
          created_at: n.created_at,
          author: n.author_name || 'Admin',
          text: n.note,
        });
      }
    }

    if (filter === 'all' || filter === 'events') {
      for (const e of events) {
        if (filter === 'all' && e.event_type === 'booking_internal_note_added') {
          continue;
        }
        const statusDiff =
          e.from_status && e.to_status
            ? `${e.from_status.replaceAll('_', ' ')} → ${e.to_status.replaceAll('_', ' ')}`
            : null;
        items.push({
          kind: 'event',
          id: `event-${e.id}`,
          created_at: e.created_at,
          actor: e.actor_name || 'System',
          title: formatEventTitle(e),
          subtitle: statusDiff,
        });
      }
    }

    items.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    return items;
  }, [events, notes, filter]);

  return (
    <section className="space-y-5">
      {/* Top Quick Internal Note Form */}
      <form
        onSubmit={addNote}
        className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label
            className="flex items-center gap-2 text-xs font-extrabold text-slate-900"
            htmlFor={`internal-note-${bookingId}`}
          >
            <MessageSquarePlus className="h-4 w-4 text-amber-700" /> Add Confidential Admin Note
          </label>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800">
            <ShieldAlert className="h-3.5 w-3.5" /> Visible only to Admin &amp; Super Admin
          </span>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <textarea
            id={`internal-note-${bookingId}`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={2000}
            rows={2}
            placeholder="Write an internal operational note (e.g. flight delayed, special child seat requested, customer called)..."
            required
            className="flex-1 rounded-xl border border-amber-300 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-100"
          />
          <button
            type="submit"
            disabled={saving || !note.trim()}
            className="shrink-0 self-end rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 transition sm:self-stretch"
          >
            {saving ? 'Saving…' : 'Save Note'}
          </button>
        </div>
      </form>

      {message && (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
          {error}
        </p>
      )}

      {/* Chronological Timeline */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-600" /> Chronological Booking Timeline
          </h4>
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all', label: `All (${notes.length + events.length})` },
                { id: 'notes', label: `Internal Notes (${notes.length})` },
                { id: 'events', label: `System Events (${events.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  filter === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="py-6 text-center text-xs text-slate-500">Loading booking timeline…</p>
        ) : unifiedTimeline.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-500">No timeline entries recorded yet.</p>
        ) : (
          <ol className="relative border-l-2 border-slate-200 ml-3 space-y-3 pl-5">
            {unifiedTimeline.map((item) =>
              item.kind === 'note' ? (
                <li key={item.id} className="relative rounded-xl border border-amber-200 bg-amber-50/70 p-3.5">
                  <span className="absolute -left-[27px] top-4 h-3 w-3 rounded-full border-2 border-white bg-amber-500" />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-extrabold uppercase text-amber-950">
                      <FileText className="h-3 w-3" /> Internal Note · {item.author}
                    </span>
                    <time dateTime={item.created_at} className="text-[11px] font-medium text-slate-500">
                      {formatActivityDate(item.created_at)}
                    </time>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap break-words text-xs font-medium text-slate-800">
                    {item.text}
                  </p>
                </li>
              ) : (
                <li key={item.id} className="relative rounded-xl border border-slate-200/80 bg-slate-50/70 p-3">
                  <span className="absolute -left-[27px] top-4 h-3 w-3 rounded-full border-2 border-white bg-blue-600" />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-extrabold text-slate-900">{item.title}</p>
                    <time dateTime={item.created_at} className="text-[11px] font-medium text-slate-500">
                      {formatActivityDate(item.created_at)}
                    </time>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    <span>By {item.actor}</span>
                    {item.subtitle && (
                      <span className="rounded bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-700">
                        {item.subtitle}
                      </span>
                    )}
                  </div>
                </li>
              )
            )}
          </ol>
        )}
      </div>
    </section>
  );
}
