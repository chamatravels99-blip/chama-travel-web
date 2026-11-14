'use client';

import { useEffect, useState } from 'react';

type DocSummary = { id: string; title: string; document_type: string; revision: number; created_at: string };

export default function GuestDocuments({ token, audience }: { token: string; audience: 'customer' | 'driver' }) {
  const [docs, setDocs] = useState<DocSummary[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void fetch('/api/guest/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ token, audience, action: 'list' }),
    }).then(async (response) => {
      const result = await response.json() as { success?: boolean; data?: DocSummary[] };
      setDocs(response.ok && result.success && Array.isArray(result.data) ? result.data : []);
    }).catch(() => setDocs([]));
  }, [token, audience]);

  async function openDocument(doc: DocSummary, view: boolean) {
    setError('');
    const viewer = view ? window.open('about:blank', '_blank') : null;
    if (view && !viewer) {
      setError('Allow pop-ups to view this document.');
      return;
    }
    if (viewer) viewer.opener = null;
    try {
      const response = await fetch('/api/guest/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ token, audience, action: view ? 'view' : 'download', document_id: doc.id }),
      });
      if (!response.ok) {
        viewer?.close();
        setError(response.status === 429 ? 'Too many requests. Please wait a moment.' : 'This document is unavailable.');
        return;
      }
      const url = URL.createObjectURL(await response.blob());
      if (viewer) {
        viewer.location.href = url;
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.download = `${doc.title.replace(/[^A-Za-z0-9._-]+/g, '_')}.pdf`;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      viewer?.close();
      setError('This document is unavailable.');
    }
  }

  return (
    <div className="space-y-2">
      <h3 className="font-extrabold text-slate-900">Documents</h3>
      {docs === null && <p className="text-xs text-slate-500">Loading documents…</p>}
      {docs?.length === 0 && <p className="text-xs text-slate-500">No downloadable documents are available yet.</p>}
      {docs?.map((doc) => (
        <div key={doc.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
          <span className="text-xs font-semibold text-slate-800">{doc.title}</span>
          <span className="flex gap-2">
            {doc.document_type !== 'booking_document' && (
              <button type="button" onClick={() => void openDocument(doc, true)} className="text-xs font-semibold text-blue-800 underline">View</button>
            )}
            <button type="button" onClick={() => void openDocument(doc, false)} className="text-xs font-semibold text-blue-800 underline">Download</button>
          </span>
        </div>
      ))}
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
