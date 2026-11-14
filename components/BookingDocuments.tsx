'use client';

import { useEffect, useState } from 'react';

type Doc = { id: string; title: string; document_type: string; created_at: string };

export default function BookingDocuments({ bookingId }: { bookingId: string }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/documents?booking_id=${encodeURIComponent(bookingId)}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const result = await response.json() as { success?: boolean; error?: string; data?: Doc[] };
        if (!response.ok || !result.success || !Array.isArray(result.data)) {
          throw new Error(result.error || 'Documents could not be loaded.');
        }
        setDocs(result.data);
        setError('');
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('Documents could not be loaded.');
      });
    return () => controller.abort();
  }, [bookingId]);

  if (docs.length === 0 && !error) return null;
  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-bold uppercase text-slate-500">Documents</p>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
      {docs.map((doc) => (
        <div key={doc.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-2 text-xs">
          <span>
            <b>{doc.title}</b> · {doc.document_type.replaceAll('_', ' ')} · Available ·
            {' '}{new Date(doc.created_at).toLocaleDateString('en-GB')}
          </span>
          <span className="flex gap-2">
            {doc.document_type !== 'booking_document' && (
              <a target="_blank" rel="noopener noreferrer" href={`/api/documents/download?id=${doc.id}&view=1`} className="font-semibold text-blue-800 underline">View</a>
            )}
            <a href={`/api/documents/download?id=${doc.id}`} className="font-semibold text-blue-800 underline">Download</a>
          </span>
        </div>
      ))}
    </div>
  );
}
