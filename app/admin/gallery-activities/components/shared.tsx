'use client';

import { AlertCircle, CheckCircle2, Trash2, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { createClient } from '@/utils/supabase/client';

export type StatusFilter = 'all' | 'featured' | 'active' | 'hidden';

export type ApiResult<T> = {
  success?: boolean;
  error?: string;
  message?: string;
  data?: T;
};

export const inputClass =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none';

export const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp,image/gif,image/avif';

const ALLOWED_TYPES = new Set(ACCEPTED_IMAGE_TYPES.split(','));
const MAX_BYTES = 10 * 1024 * 1024;

/** Uploads to website-assets/{folder}/... directly, falling back to the server upload route. */
export async function uploadImageFile(file: File, folder: 'gallery' | 'activities'): Promise<string> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error(`"${file.name}" is not a supported image (JPG, PNG, WebP, GIF, AVIF).`);
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    throw new Error(`"${file.name}" must be under 10 MB.`);
  }

  try {
    const supabase = createClient();
    const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const baseName =
      file.name
        .replace(/\.[^/.]+$/, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || 'image';
    const storagePath = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${baseName}.${ext}`;
    const { error } = await supabase.storage
      .from('website-assets')
      .upload(storagePath, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    return supabase.storage.from('website-assets').getPublicUrl(storagePath).data.publicUrl;
  } catch {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);
    const response = await fetch('/api/admin/gallery-activities/upload', { method: 'POST', body: formData });
    const result = (await response.json()) as ApiResult<{ publicUrl: string }>;
    if (!response.ok || !result.success || !result.data?.publicUrl) {
      throw new Error(result.error || 'Image upload failed.');
    }
    return result.data.publicUrl;
  }
}

export function fileNameToAlt(name: string): string {
  const cleaned = name
    .replace(/\.[^/.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length >= 2 ? `Chama Travels – ${cleaned}`.slice(0, 300) : 'Chama Travels journey in Sri Lanka';
}

export function Alerts({
  error,
  notice,
  onClearError,
  onClearNotice,
}: {
  error: string;
  notice: string;
  onClearError: () => void;
  onClearNotice: () => void;
}) {
  return (
    <>
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={onClearError} className="rounded-lg p-1 text-rose-600 hover:bg-rose-100" aria-label="Dismiss error">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{notice}</span>
          </div>
          <button type="button" onClick={onClearNotice} className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-100" aria-label="Dismiss notification">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  );
}

const KPI_TONES = {
  slate: { box: 'border-slate-200/80 bg-white', label: 'text-slate-500', icon: 'bg-slate-100 text-slate-700', value: 'text-slate-950', hint: 'text-slate-500' },
  emerald: { box: 'border-emerald-200/80 bg-emerald-50/40', label: 'text-emerald-900', icon: 'bg-emerald-100 text-emerald-800', value: 'text-emerald-950', hint: 'text-emerald-800' },
  blue: { box: 'border-blue-200/80 bg-blue-50/40', label: 'text-blue-900', icon: 'bg-blue-100 text-blue-800', value: 'text-blue-950', hint: 'text-blue-800' },
  amber: { box: 'border-amber-200/80 bg-amber-50/40', label: 'text-amber-900', icon: 'bg-amber-100 text-amber-800', value: 'text-amber-950', hint: 'text-amber-800' },
} as const;

export function KpiCard({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  icon: ReactNode;
  tone: keyof typeof KPI_TONES;
}) {
  const t = KPI_TONES[tone];
  return (
    <div className={`flex flex-col justify-between rounded-2xl border p-5 shadow-xs ${t.box}`}>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-bold uppercase tracking-wider ${t.label}`}>{label}</span>
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${t.icon}`}>{icon}</span>
      </div>
      <p className={`mt-3 text-3xl font-black ${t.value}`}>{value}</p>
      <p className={`mt-1.5 text-xs ${t.hint}`}>{hint}</p>
    </div>
  );
}

export function StatusTabs({
  value,
  onChange,
  counts,
}: {
  value: StatusFilter;
  onChange: (value: StatusFilter) => void;
  counts: { total: number; featured: number; active: number; hidden: number };
}) {
  const tabs: { id: StatusFilter; label: string }[] = [
    { id: 'all', label: `All (${counts.total})` },
    { id: 'featured', label: `Home Featured (${counts.featured})` },
    { id: 'active', label: `Active (${counts.active})` },
    { id: 'hidden', label: `Hidden (${counts.hidden})` },
  ];
  return (
    <div className="inline-flex flex-wrap rounded-xl border border-slate-200 bg-slate-50 p-1" role="group" aria-label="Filter by status">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          aria-pressed={value === tab.id}
          onClick={() => onChange(tab.id)}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
            value === tab.id ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function ConfirmDeleteDialog({
  title,
  description,
  confirmLabel,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
          <Trash2 className="h-6 w-6" />
        </div>
        <h2 id="confirm-delete-title" className="mt-4 text-lg font-black text-slate-950">
          {title}
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-slate-600">{description}</p>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
          >
            {busy ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ToggleField({
  checked,
  onChange,
  title,
  hint,
  tone = 'blue',
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  title: string;
  hint: string;
  tone?: 'blue' | 'emerald';
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 transition ${
        tone === 'blue' ? 'hover:border-blue-300' : 'hover:border-emerald-300'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={`h-4 w-4 rounded border-slate-300 ${tone === 'blue' ? 'text-blue-600' : 'text-emerald-600'}`}
      />
      <div>
        <span className="block text-xs font-bold text-slate-900">{title}</span>
        <span className="text-[11px] text-slate-500">{hint}</span>
      </div>
    </label>
  );
}
