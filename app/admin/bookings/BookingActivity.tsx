'use client';

import { useCallback, useEffect, useState } from 'react';

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

export default function BookingActivity({ bookingId }: { bookingId: string }) {
  const [events, setEvents] = useState<BookingEvent[]>([]);
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [note, setNote] = useState('');
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
      const result = await response.json() as ActivityResponse;
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

  useEffect(() => { void Promise.resolve().then(loadActivity); }, [loadActivity]);

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
      const result = await response.json() as { success?: boolean; error?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Internal note could not be saved.');
      }
      setNote('');
      setMessage('Internal note saved.');
      await loadActivity();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Internal note could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div>
        <h3 className="font-extrabold text-slate-900">Booking activity and internal notes</h3>
        <p className="mt-1 text-xs text-slate-500">Internal notes are visible only to Admin and Super Admin users.</p>
      </div>

      <form onSubmit={addNote} className="space-y-2">
        <label className="block text-xs font-semibold text-slate-700" htmlFor={`internal-note-${bookingId}`}>
          Add an internal note
        </label>
        <textarea
          id={`internal-note-${bookingId}`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={2000}
          rows={3}
          required
          className="w-full rounded-xl border border-slate-300 p-3 text-sm"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">{note.trim().length}/2000</span>
          <button
            type="submit"
            disabled={saving || !note.trim()}
            className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save note'}
          </button>
        </div>
      </form>

      {message && <p role="status" className="text-xs text-emerald-700">{message}</p>}
      {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}

      {loading ? (
        <p className="text-xs text-slate-500">Loading booking activity…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <section aria-label="Internal notes">
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-600">Internal notes</h4>
            {notes.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">No internal notes yet.</p>
            ) : (
              <ol className="mt-2 space-y-2">
                {notes.map((item) => (
                  <li key={item.id} className="rounded-xl bg-amber-50 p-3 text-sm text-slate-800">
                    <p className="whitespace-pre-wrap break-words">{item.note}</p>
                    <p className="mt-2 text-[10px] text-slate-500">
                      {item.author_name} · <time dateTime={item.created_at}>{formatActivityDate(item.created_at)}</time>
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section aria-label="Booking event history">
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-600">Event history</h4>
            {events.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">No events recorded.</p>
            ) : (
              <ol className="mt-2 space-y-2">
                {events.map((item) => (
                  <li key={item.id} className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-800">
                      {item.event_type.replaceAll('_', ' ')}
                      {item.from_status && item.to_status ? ` · ${item.from_status} → ${item.to_status}` : ''}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-500">
                      {item.actor_name || 'System'} · <time dateTime={item.created_at}>{formatActivityDate(item.created_at)}</time>
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
