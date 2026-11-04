'use client';

import { useEffect, useRef, useState } from 'react';

export function GuestQuoteAcceptance({ quoteId }: { quoteId: string }) {
  const submitted = useRef(false);
  const [message, setMessage] = useState('Checking your secure acceptance link…');
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (submitted.current) return;
    submitted.current = true;
    const token = window.location.hash.slice(1);
    window.history.replaceState(null, '', window.location.pathname);
    if (!token) {
      void Promise.resolve().then(() => setMessage('This acceptance link is invalid or has already been used.'));
      return;
    }

    void fetch('/api/guest/quotes/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ quote_id: quoteId, token }),
    }).then(async (response) => {
      const result = await response.json();
      if (!response.ok || !result.success) {
        setMessage(result.error || 'This acceptance link is invalid or expired.');
        return;
      }
      setConfirmed(true);
      setMessage('Your quote has been accepted and your booking is confirmed.');
    }).catch(() => {
      setMessage('We could not confirm the quote right now. Please contact Chama Travels before trying again.');
    });
  }, [quoteId]);

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <section
        className="max-w-lg w-full bg-white rounded-3xl border border-slate-200 shadow-lg p-8 text-center"
      >
        <h1 className="text-xl font-black text-slate-900">Chama Travels</h1>
        <p className={`mt-4 text-sm ${confirmed ? 'text-emerald-700' : 'text-slate-600'}`} aria-live="polite">
          {message}
        </p>
        {confirmed && (
          <p className="mt-3 text-xs text-slate-500">
            Our team will contact you with the next steps.
          </p>
        )}
      </section>
    </main>
  );
}
