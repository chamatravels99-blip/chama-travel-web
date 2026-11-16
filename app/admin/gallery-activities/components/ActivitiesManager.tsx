'use client';

import { useMemo, useRef, useState } from 'react';
import {
  Clock,
  Compass,
  Edit3,
  Eye,
  EyeOff,
  Home,
  ImagePlus,
  Layers,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Star,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { ACTIVITY_CATEGORIES, type ActivityRecord, toSlug } from '@/lib/gallery-activities';
import {
  ACCEPTED_IMAGE_TYPES,
  type ApiResult,
  ConfirmDeleteDialog,
  inputClass,
  KpiCard,
  type StatusFilter,
  StatusTabs,
  ToggleField,
  uploadImageFile,
} from './shared';

type ActivityFormState = {
  id: string;
  title: string;
  slug: string;
  slugTouched: boolean;
  categoryMode: 'preset' | 'custom';
  category: string;
  customCategory: string;
  location: string;
  duration: string;
  price_usd: string;
  price_lkr: string;
  description: string;
  image_url: string;
  image_alt: string;
  highlights: string[];
  highlightInput: string;
  display_order: string;
  is_featured_home: boolean;
  is_active: boolean;
};

function createEmptyActivityForm(nextOrder = 1): ActivityFormState {
  return {
    id: '',
    title: '',
    slug: '',
    slugTouched: false,
    categoryMode: 'preset',
    category: 'Wildlife',
    customCategory: '',
    location: '',
    duration: '',
    price_usd: '',
    price_lkr: '',
    description: '',
    image_url: '',
    image_alt: '',
    highlights: [],
    highlightInput: '',
    display_order: String(nextOrder),
    is_featured_home: true,
    is_active: true,
  };
}

export default function ActivitiesManager({
  activities,
  loading,
  onReload,
  onNotice,
  onError,
  onSetActivities,
}: {
  activities: ActivityRecord[];
  loading: boolean;
  onReload: () => Promise<void>;
  onNotice: (msg: string) => void;
  onError: (msg: string) => void;
  onSetActivities: React.Dispatch<React.SetStateAction<ActivityRecord[]>>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('All');

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<ActivityFormState>(() => createEmptyActivityForm(1));
  const [deleteTarget, setDeleteTarget] = useState<ActivityRecord | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const kpis = useMemo(() => {
    const total = activities.length;
    const active = activities.filter((a) => a.is_active).length;
    const featured = activities.filter((a) => a.is_featured_home).length;
    const hidden = activities.filter((a) => !a.is_active).length;
    return { total, active, featured, hidden };
  }, [activities]);

  const availableCategories = useMemo(() => {
    const set = new Set<string>(ACTIVITY_CATEGORIES);
    for (const a of activities) {
      if (a.category?.trim()) set.add(a.category.trim());
    }
    return ['All', ...Array.from(set)];
  }, [activities]);

  const filteredActivities = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return activities.filter((a) => {
      if (statusFilter === 'featured' && !a.is_featured_home) return false;
      if (statusFilter === 'active' && !a.is_active) return false;
      if (statusFilter === 'hidden' && a.is_active) return false;
      if (categoryFilter !== 'All' && a.category !== categoryFilter) return false;
      if (!query) return true;
      return [a.title, a.category, a.location ?? '', a.description].some((f) =>
        f.toLowerCase().includes(query)
      );
    });
  }, [activities, searchQuery, statusFilter, categoryFilter]);

  function openAddModal() {
    const maxOrder = activities.reduce((max, a) => Math.max(max, a.display_order || 0), 0);
    setForm(createEmptyActivityForm(maxOrder + 1));
    onError('');
    setModalOpen(true);
  }

  function openEditModal(act: ActivityRecord) {
    const cat = act.category.trim();
    const isPreset = !cat || (ACTIVITY_CATEGORIES as readonly string[]).includes(cat);
    setForm({
      id: act.id,
      title: act.title,
      slug: act.slug,
      slugTouched: true,
      categoryMode: isPreset ? 'preset' : 'custom',
      category: isPreset ? cat || 'Wildlife' : 'Wildlife',
      customCategory: isPreset ? '' : cat,
      location: act.location ?? '',
      duration: act.duration ?? '',
      price_usd: act.price_usd !== null && act.price_usd !== undefined ? String(act.price_usd) : '',
      price_lkr: act.price_lkr !== null && act.price_lkr !== undefined ? String(act.price_lkr) : '',
      description: act.description,
      image_url: act.image_url,
      image_alt: act.image_alt ?? '',
      highlights: Array.isArray(act.highlights) ? [...act.highlights] : [],
      highlightInput: '',
      display_order: String(act.display_order ?? 0),
      is_featured_home: Boolean(act.is_featured_home),
      is_active: Boolean(act.is_active),
    });
    onError('');
    setModalOpen(true);
  }

  async function handleToggle(act: ActivityRecord, action: 'toggle_featured' | 'toggle_active') {
    setBusyId(act.id);
    onError('');
    onNotice('');
    try {
      const payload =
        action === 'toggle_featured'
          ? { action, id: act.id, is_featured_home: !act.is_featured_home }
          : { action, id: act.id, is_active: !act.is_active };

      const response = await fetch('/api/admin/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as ApiResult<ActivityRecord>;
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || 'Could not update activity status.');
      }
      onSetActivities((prev) => prev.map((item) => (item.id === act.id ? result.data! : item)));
      onNotice(result.message || 'Updated activity status.');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not update activity status.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setBusyId(target.id);
    onError('');
    onNotice('');
    try {
      const response = await fetch(`/api/admin/activities?id=${encodeURIComponent(target.id)}`, {
        method: 'DELETE',
      });
      const result = (await response.json()) as ApiResult<unknown>;
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Activity could not be deleted.');
      }
      onSetActivities((prev) => prev.filter((item) => item.id !== target.id));
      onNotice(`"${target.title}" deleted from activities.`);
      setDeleteTarget(null);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Activity could not be deleted.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleFileUpload(file: File) {
    setUploading(true);
    onError('');
    try {
      const publicUrl = await uploadImageFile(file, 'activities');
      setForm((prev) => ({ ...prev, image_url: publicUrl }));
      onNotice('Cover image uploaded to Supabase Storage.');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Image upload failed.');
    } finally {
      setUploading(false);
    }
  }

  function addHighlightTag() {
    const cleaned = form.highlightInput.trim();
    if (!cleaned) return;
    const parts = cleaned
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !form.highlights.includes(s));
    setForm((prev) => ({
      ...prev,
      highlights: parts.length > 0 ? [...prev.highlights, ...parts] : prev.highlights,
      highlightInput: '',
    }));
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    onError('');
    onNotice('');

    const pending = form.highlightInput.trim();
    const finalHighlights =
      pending && !form.highlights.includes(pending) ? [...form.highlights, pending] : form.highlights;
    const finalCategory =
      (form.categoryMode === 'custom' ? form.customCategory : form.category).trim() || 'Wildlife';

    try {
      const response = await fetch('/api/admin/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          id: form.id || null,
          title: form.title.trim(),
          slug: (form.slug.trim() || toSlug(form.title)).toLowerCase(),
          category: finalCategory,
          location: form.location.trim(),
          duration: form.duration.trim(),
          price_usd: form.price_usd.trim() === '' ? null : Number(form.price_usd),
          price_lkr: form.price_lkr.trim() === '' ? null : Number(form.price_lkr),
          description: form.description.trim(),
          image_url: form.image_url.trim(),
          image_alt: form.image_alt.trim(),
          highlights: finalHighlights,
          display_order: Number(form.display_order) || 0,
          is_featured_home: form.is_featured_home,
          is_active: form.is_active,
        }),
      });
      const result = (await response.json()) as ApiResult<ActivityRecord>;
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Activity could not be saved.');
      }
      onNotice(result.message || 'Activity saved successfully.');
      setModalOpen(false);
      await onReload();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Activity could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section aria-label="Activities summary metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Activities" value={kpis.total} hint="All experiences in database" icon={<Layers className="h-5 w-5" />} tone="slate" />
        <KpiCard label="Published (Active)" value={kpis.active} hint="Visible on /activities page" icon={<Eye className="h-5 w-5" />} tone="emerald" />
        <KpiCard label="Featured on Home Page" value={kpis.featured} hint="Shown in Things to Do carousel" icon={<Star className="h-5 w-5" />} tone="blue" />
        <KpiCard label="Hidden" value={kpis.hidden} hint="Hidden from public visitors" icon={<EyeOff className="h-5 w-5" />} tone="amber" />
      </section>

      <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, category, or location..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <StatusTabs value={statusFilter} onChange={setStatusFilter} counts={kpis} />

            <select
              aria-label="Filter activities by category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 focus:border-blue-500 focus:bg-white focus:outline-none"
            >
              {availableCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'All' ? 'All Categories' : cat}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-600/20 transition hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" /> + Add New Activity
            </button>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-sm font-medium text-slate-500">
          Loading activities…
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Compass className="mx-auto h-10 w-10 text-slate-400" />
          <h2 className="mt-3 text-base font-bold text-slate-900">No activities found</h2>
          <p className="mt-1 text-xs text-slate-500">
            Try adjusting your search or filter, or add a new activity experience.
          </p>
          <button
            type="button"
            onClick={openAddModal}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> + Add New Activity
          </button>
        </div>
      ) : (
        <section aria-label="Activities grid" className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredActivities.map((act) => {
            const isBusy = busyId === act.id;
            return (
              <article
                key={act.id}
                className={`group flex flex-col overflow-hidden rounded-3xl border bg-white shadow-xs transition duration-200 hover:shadow-md ${
                  act.is_active ? 'border-slate-200/90' : 'border-amber-200 bg-slate-50/60 opacity-85'
                }`}
              >
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={act.image_url}
                    alt={act.image_alt || act.title}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/15 to-transparent" />

                  <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-slate-800 shadow-xs backdrop-blur-md">
                      {act.category}
                    </span>
                    <span className="rounded-full bg-slate-900/80 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-md">
                      #{act.display_order}
                    </span>
                  </div>

                  <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
                    {act.is_featured_home && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-xs">
                        <Star className="h-3 w-3 fill-current" /> Home Featured
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold text-white shadow-xs ${
                        act.is_active ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                    >
                      {act.is_active ? 'Active' : 'Hidden'}
                    </span>
                  </div>

                  <div className="absolute bottom-3 left-4 right-4 text-white">
                    <h2 className="text-lg font-extrabold tracking-tight drop-shadow-xs">{act.title}</h2>
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <p className="line-clamp-2 text-xs leading-relaxed text-slate-600">{act.description}</p>

                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-600">
                    {act.duration && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 font-semibold">
                        <Clock className="h-3 w-3 text-blue-600" /> {act.duration}
                      </span>
                    )}
                    {act.location && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 font-semibold">
                        <MapPin className="h-3 w-3 text-blue-600" /> {act.location}
                      </span>
                    )}
                    {(act.price_usd !== null || act.price_lkr !== null) && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 font-bold text-blue-800">
                        {act.price_usd !== null ? `$${act.price_usd} USD` : ''}
                        {act.price_usd !== null && act.price_lkr !== null ? ' · ' : ''}
                        {act.price_lkr !== null ? `LKR ${act.price_lkr.toLocaleString()}` : ''}
                      </span>
                    )}
                  </div>

                  {act.highlights && act.highlights.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
                      {act.highlights.slice(0, 3).map((tag, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center rounded-lg border border-blue-100 bg-blue-50/60 px-2 py-0.5 text-[11px] font-medium text-blue-900"
                        >
                          ✓ {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-auto space-y-2.5 pt-4">
                    <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-2.5">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleToggle(act, 'toggle_featured')}
                        className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition disabled:opacity-50 ${
                          act.is_featured_home
                            ? 'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Home className="h-3.5 w-3.5" />
                        {act.is_featured_home ? 'On Home Page' : 'Add to Home'}
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleToggle(act, 'toggle_active')}
                        className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition disabled:opacity-50 ${
                          act.is_active
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                            : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                        }`}
                      >
                        {act.is_active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        {act.is_active ? 'Published' : 'Hidden'}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => openEditModal(act)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-blue-600 disabled:opacity-50"
                      >
                        <Edit3 className="h-3.5 w-3.5" /> Edit Activity
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => setDeleteTarget(act)}
                        aria-label={`Delete ${act.title}`}
                        className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-rose-700 transition hover:bg-rose-600 hover:text-white disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="activity-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
        >
          <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-600">
                  <Sparkles className="h-3.5 w-3.5" />
                  {form.id ? 'Update Activity' : 'Create Activity'}
                </span>
                <h2 id="activity-modal-title" className="mt-1 text-xl font-black text-slate-950">
                  {form.id ? `Edit "${form.title}"` : 'Add New Sri Lanka Activity'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-full bg-slate-100 p-2 text-slate-600 hover:bg-slate-200"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={(e) => void handleSave(e)} className="mt-5 space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Activity Title <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.title}
                    onChange={(e) => {
                      const next = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        title: next,
                        slug: prev.slugTouched ? prev.slug : toSlug(next),
                      }));
                    }}
                    placeholder="e.g., Yala National Park Safari"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    URL Slug <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.slug}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, slug: toSlug(e.target.value), slugTouched: true }))
                    }
                    placeholder="e.g., yala-national-park-safari"
                    className={`${inputClass} font-mono`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Category <span className="text-rose-600">*</span>
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={form.categoryMode === 'custom' ? '__custom__' : form.category}
                      onChange={(e) =>
                        e.target.value === '__custom__'
                          ? setForm((prev) => ({ ...prev, categoryMode: 'custom' }))
                          : setForm((prev) => ({ ...prev, categoryMode: 'preset', category: e.target.value }))
                      }
                      className={inputClass}
                    >
                      {ACTIVITY_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                      <option value="__custom__">Custom Category...</option>
                    </select>
                    {form.categoryMode === 'custom' && (
                      <input
                        type="text"
                        required
                        value={form.customCategory}
                        onChange={(e) => setForm((prev) => ({ ...prev, customCategory: e.target.value }))}
                        placeholder="Enter category"
                        className={inputClass}
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">Display Order</label>
                  <input
                    type="number"
                    min={0}
                    value={form.display_order}
                    onChange={(e) => setForm((prev) => ({ ...prev, display_order: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700">Location (Optional)</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
                    placeholder="e.g., Yala, Ella, Mirissa"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">Duration (Optional)</label>
                  <input
                    type="text"
                    value={form.duration}
                    onChange={(e) => setForm((prev) => ({ ...prev, duration: e.target.value }))}
                    placeholder="e.g., 3 - 4 Hours, Half Day"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700">Optional Price (USD)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.price_usd}
                    onChange={(e) => setForm((prev) => ({ ...prev, price_usd: e.target.value }))}
                    placeholder="e.g., 65"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">Optional Price (LKR)</label>
                  <input
                    type="number"
                    min={0}
                    step="1"
                    value={form.price_lkr}
                    onChange={(e) => setForm((prev) => ({ ...prev, price_lkr: e.target.value }))}
                    placeholder="e.g., 19500"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Image Uploader */}
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800">
                    Activity Cover Image <span className="text-rose-600">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-2xs hover:bg-blue-700 disabled:opacity-50"
                  >
                    <ImagePlus className="h-3.5 w-3.5" />
                    {uploading ? 'Uploading…' : 'Upload Image File'}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_IMAGE_TYPES}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleFileUpload(file);
                      e.target.value = '';
                    }}
                  />
                </div>

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) void handleFileUpload(file);
                  }}
                  onClick={() => {
                    if (!form.image_url) fileInputRef.current?.click();
                  }}
                  className={`relative flex min-h-36 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition ${
                    isDragging ? 'border-blue-500 bg-blue-50/60' : 'border-slate-300 bg-white hover:border-blue-400'
                  }`}
                >
                  {form.image_url ? (
                    <div className="relative aspect-[16/9] w-full max-h-52 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={form.image_url} alt="Activity preview" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                        className="absolute bottom-2 right-2 rounded-lg bg-slate-900/80 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-xs hover:bg-slate-900"
                      >
                        Replace Photo
                      </button>
                    </div>
                  ) : (
                    <div className="p-6 text-center">
                      <UploadCloud className="mx-auto h-8 w-8 text-blue-600" />
                      <p className="mt-2 text-xs font-bold text-slate-700">
                        {uploading ? 'Uploading to Supabase Storage…' : 'Drag & drop an image here, or click to browse'}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Uploads to website-assets/activities/ (JPG, PNG, WebP up to 10 MB)
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500">
                      Or paste an Image URL / local path:
                    </label>
                    <input
                      type="text"
                      required
                      value={form.image_url}
                      onChange={(e) => setForm((prev) => ({ ...prev, image_url: e.target.value }))}
                      placeholder="https://... or /images/yala-leopard.jpg"
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500">
                      Image Alt Text (Optional)
                    </label>
                    <input
                      type="text"
                      value={form.image_alt}
                      onChange={(e) => setForm((prev) => ({ ...prev, image_alt: e.target.value }))}
                      placeholder="Defaults to activity title"
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Description <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe this experience for travelers..."
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs leading-relaxed text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                />
              </div>

              {/* Highlights Tag Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Key Highlights (Optional)
                </label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    type="text"
                    value={form.highlightInput}
                    onChange={(e) => setForm((prev) => ({ ...prev, highlightInput: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addHighlightTag();
                      }
                    }}
                    placeholder="e.g., 4x4 Jeep Safari (press Enter or click Add)"
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={addHighlightTag}
                    className="rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-600"
                  >
                    + Add
                  </button>
                </div>

                {form.highlights.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {form.highlights.map((item, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-900"
                      >
                        ✓ {item}
                        <button
                          type="button"
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              highlights: prev.highlights.filter((_, i) => i !== idx),
                            }))
                          }
                          className="rounded-full p-0.5 text-blue-700 hover:bg-blue-200"
                          aria-label={`Remove ${item}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
                <ToggleField
                  checked={form.is_featured_home}
                  onChange={(val) => setForm((prev) => ({ ...prev, is_featured_home: val }))}
                  title="Show on Home Page"
                  hint='Include in the "Things to Do" carousel'
                  tone="blue"
                />
                <ToggleField
                  checked={form.is_active}
                  onChange={(val) => setForm((prev) => ({ ...prev, is_active: val }))}
                  title="Published (Active)"
                  hint="Visible to visitors on the public website"
                  tone="emerald"
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || uploading}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : form.id ? 'Save Changes' : 'Create Activity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDeleteDialog
          title={`Delete "${deleteTarget.title}"?`}
          description={
            <>
              This will permanently remove <b>{deleteTarget.title}</b> from both the Home Page and the public Activities page. Use the{' '}
              <b>Published / Hidden</b> toggle if you only want to hide it temporarily.
            </>
          }
          confirmLabel="Yes, Delete Activity"
          busy={busyId === deleteTarget.id}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void handleConfirmDelete()}
        />
      )}
    </div>
  );
}
