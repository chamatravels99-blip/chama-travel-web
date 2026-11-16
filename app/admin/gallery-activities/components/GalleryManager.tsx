'use client';

import { useMemo, useRef, useState } from 'react';
import {
  Edit3,
  Eye,
  EyeOff,
  Home,
  ImageIcon,
  ImagePlus,
  Layers,
  Plus,
  Search,
  Sparkles,
  Star,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import {
  GALLERY_CATEGORIES,
  GALLERY_LAYOUT_LABELS,
  type GalleryLayoutSize,
  type GalleryPhotoRecord,
} from '@/lib/gallery-activities';
import {
  ACCEPTED_IMAGE_TYPES,
  type ApiResult,
  ConfirmDeleteDialog,
  fileNameToAlt,
  inputClass,
  KpiCard,
  type StatusFilter,
  StatusTabs,
  ToggleField,
  uploadImageFile,
} from './shared';

type PhotoFormState = {
  id: string;
  title: string;
  alt_text: string;
  categoryMode: 'preset' | 'custom';
  category: string;
  customCategory: string;
  image_url: string;
  layout_size: GalleryLayoutSize;
  display_order: string;
  is_featured_home: boolean;
  is_active: boolean;
};

type QueuedUpload = {
  tempId: string;
  image_url: string;
  title: string;
  alt_text: string;
};

function createEmptyPhotoForm(nextOrder = 1): PhotoFormState {
  return {
    id: '',
    title: '',
    alt_text: '',
    categoryMode: 'preset',
    category: 'Journeys',
    customCategory: '',
    image_url: '',
    layout_size: 'standard',
    display_order: String(nextOrder),
    is_featured_home: true,
    is_active: true,
  };
}

export default function GalleryManager({
  photos,
  loading,
  onReload,
  onNotice,
  onError,
  onSetPhotos,
}: {
  photos: GalleryPhotoRecord[];
  loading: boolean;
  onReload: () => Promise<void>;
  onNotice: (msg: string) => void;
  onError: (msg: string) => void;
  onSetPhotos: React.Dispatch<React.SetStateAction<GalleryPhotoRecord[]>>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('All');

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<PhotoFormState>(() => createEmptyPhotoForm(1));
  const [queuedUploads, setQueuedUploads] = useState<QueuedUpload[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<GalleryPhotoRecord | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const kpis = useMemo(() => {
    const total = photos.length;
    const active = photos.filter((p) => p.is_active).length;
    const featured = photos.filter((p) => p.is_featured_home).length;
    const hidden = photos.filter((p) => !p.is_active).length;
    return { total, active, featured, hidden };
  }, [photos]);

  const availableCategories = useMemo(() => {
    const set = new Set<string>(GALLERY_CATEGORIES);
    for (const p of photos) {
      if (p.category?.trim()) set.add(p.category.trim());
    }
    return ['All', ...Array.from(set)];
  }, [photos]);

  const filteredPhotos = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return photos.filter((p) => {
      if (statusFilter === 'featured' && !p.is_featured_home) return false;
      if (statusFilter === 'active' && !p.is_active) return false;
      if (statusFilter === 'hidden' && p.is_active) return false;
      if (categoryFilter !== 'All' && p.category !== categoryFilter) return false;
      if (!query) return true;
      return [p.title ?? '', p.alt_text, p.category].some((f) => f.toLowerCase().includes(query));
    });
  }, [photos, searchQuery, statusFilter, categoryFilter]);

  function openAddModal() {
    const maxOrder = photos.reduce((max, p) => Math.max(max, p.display_order || 0), 0);
    setForm(createEmptyPhotoForm(maxOrder + 1));
    setQueuedUploads([]);
    onError('');
    setModalOpen(true);
  }

  function openEditModal(photo: GalleryPhotoRecord) {
    const cat = photo.category.trim();
    const isPreset = !cat || (GALLERY_CATEGORIES as readonly string[]).includes(cat);
    setForm({
      id: photo.id,
      title: photo.title ?? '',
      alt_text: photo.alt_text,
      categoryMode: isPreset ? 'preset' : 'custom',
      category: isPreset ? cat || 'Journeys' : 'Journeys',
      customCategory: isPreset ? '' : cat,
      image_url: photo.image_url,
      layout_size: photo.layout_size,
      display_order: String(photo.display_order ?? 0),
      is_featured_home: Boolean(photo.is_featured_home),
      is_active: Boolean(photo.is_active),
    });
    setQueuedUploads([]);
    onError('');
    setModalOpen(true);
  }

  async function handleToggle(photo: GalleryPhotoRecord, action: 'toggle_featured' | 'toggle_active') {
    setBusyId(photo.id);
    onError('');
    onNotice('');
    try {
      const payload =
        action === 'toggle_featured'
          ? { action, id: photo.id, is_featured_home: !photo.is_featured_home }
          : { action, id: photo.id, is_active: !photo.is_active };

      const response = await fetch('/api/admin/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as ApiResult<GalleryPhotoRecord>;
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || 'Could not update photo status.');
      }
      onSetPhotos((prev) => prev.map((item) => (item.id === photo.id ? result.data! : item)));
      onNotice(result.message || 'Updated photo status.');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not update photo status.');
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
      const response = await fetch(`/api/admin/gallery?id=${encodeURIComponent(target.id)}`, {
        method: 'DELETE',
      });
      const result = (await response.json()) as ApiResult<unknown>;
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Photo could not be deleted.');
      }
      onSetPhotos((prev) => prev.filter((item) => item.id !== target.id));
      onNotice(`"${target.title || target.alt_text}" deleted from gallery.`);
      setDeleteTarget(null);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Photo could not be deleted.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    setUploading(true);
    onError('');

    try {
      if (form.id || (list.length === 1 && queuedUploads.length === 0)) {
        const file = list[0];
        const publicUrl = await uploadImageFile(file, 'gallery');
        setForm((prev) => ({
          ...prev,
          image_url: publicUrl,
          alt_text: prev.alt_text.trim() ? prev.alt_text : fileNameToAlt(file.name),
        }));
        onNotice('Image uploaded to Supabase Storage.');
        return;
      }

      const uploaded: QueuedUpload[] = [];
      for (const file of list) {
        const publicUrl = await uploadImageFile(file, 'gallery');
        const cleanedTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim();
        uploaded.push({
          tempId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          image_url: publicUrl,
          title: cleanedTitle.slice(0, 120),
          alt_text: fileNameToAlt(file.name),
        });
      }
      setQueuedUploads((prev) => [...prev, ...uploaded]);
      onNotice(`${uploaded.length} photo${uploaded.length === 1 ? '' : 's'} uploaded and ready to save.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Image upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    onError('');
    onNotice('');

    const finalCategory =
      (form.categoryMode === 'custom' ? form.customCategory : form.category).trim() || 'Journeys';
    const baseOrder = Number(form.display_order) || 0;

    try {
      if (!form.id && queuedUploads.length > 0) {
        const photosPayload = queuedUploads.map((item, idx) => ({
          title: item.title.trim() || null,
          alt_text: item.alt_text.trim() || 'Chama Travels journey in Sri Lanka',
          category: finalCategory,
          image_url: item.image_url,
          layout_size: form.layout_size,
          is_featured_home: form.is_featured_home,
          is_active: form.is_active,
          display_order: baseOrder + idx,
        }));

        const response = await fetch('/api/admin/gallery', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'bulk_create', photos: photosPayload }),
        });
        const result = (await response.json()) as ApiResult<GalleryPhotoRecord[]>;
        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Photos could not be saved.');
        }
        onNotice(result.message || 'Photos added to gallery.');
      } else {
        const response = await fetch('/api/admin/gallery', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'save',
            id: form.id || null,
            title: form.title.trim(),
            alt_text: form.alt_text.trim(),
            category: finalCategory,
            image_url: form.image_url.trim(),
            layout_size: form.layout_size,
            display_order: baseOrder,
            is_featured_home: form.is_featured_home,
            is_active: form.is_active,
          }),
        });
        const result = (await response.json()) as ApiResult<GalleryPhotoRecord>;
        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Photo could not be saved.');
        }
        onNotice(result.message || 'Photo saved successfully.');
      }

      setModalOpen(false);
      await onReload();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Photo could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section aria-label="Photo gallery summary metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Photos" value={kpis.total} hint="All photos in gallery database" icon={<Layers className="h-5 w-5" />} tone="slate" />
        <KpiCard label="Published (Active)" value={kpis.active} hint="Visible on /gallery page" icon={<Eye className="h-5 w-5" />} tone="emerald" />
        <KpiCard label="Home Page Gallery" value={kpis.featured} hint="Shown in Home mosaic grid" icon={<Star className="h-5 w-5" />} tone="blue" />
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
              placeholder="Search by caption, alt text, or category..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <StatusTabs value={statusFilter} onChange={setStatusFilter} counts={kpis} />

            <select
              aria-label="Filter photos by category"
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
              <Plus className="h-4 w-4" /> + Add Photo(s)
            </button>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-sm font-medium text-slate-500">
          Loading gallery photos…
        </div>
      ) : filteredPhotos.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <ImageIcon className="mx-auto h-10 w-10 text-slate-400" />
          <h2 className="mt-3 text-base font-bold text-slate-900">No photos found</h2>
          <p className="mt-1 text-xs text-slate-500">
            Try adjusting your search or filters, or upload new travel photos.
          </p>
          <button
            type="button"
            onClick={openAddModal}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> + Add Photo(s)
          </button>
        </div>
      ) : (
        <section aria-label="Gallery photos grid" className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredPhotos.map((photo) => {
            const isBusy = busyId === photo.id;
            return (
              <article
                key={photo.id}
                className={`group flex flex-col overflow-hidden rounded-3xl border bg-white shadow-xs transition duration-200 hover:shadow-md ${
                  photo.is_active ? 'border-slate-200/90' : 'border-amber-200 bg-slate-50/60 opacity-85'
                }`}
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.image_url}
                    alt={photo.alt_text}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent" />

                  <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold text-slate-800 shadow-xs backdrop-blur-md">
                      {photo.category}
                    </span>
                    <span className="rounded-full bg-slate-900/80 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-md">
                      #{photo.display_order}
                    </span>
                  </div>

                  <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
                    <span className="rounded-full bg-indigo-600/90 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-xs">
                      {GALLERY_LAYOUT_LABELS[photo.layout_size]}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white shadow-xs ${
                        photo.is_active ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                    >
                      {photo.is_active ? 'Active' : 'Hidden'}
                    </span>
                  </div>

                  {photo.title && (
                    <p className="absolute bottom-2.5 left-3 right-3 truncate text-sm font-bold text-white drop-shadow-xs">
                      {photo.title}
                    </p>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <p className="line-clamp-2 text-xs leading-relaxed text-slate-600">{photo.alt_text}</p>

                  <div className="mt-auto space-y-2 pt-3">
                    <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-2.5">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleToggle(photo, 'toggle_featured')}
                        className={`inline-flex items-center justify-center gap-1 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold transition disabled:opacity-50 ${
                          photo.is_featured_home
                            ? 'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Home className="h-3 w-3" />
                        {photo.is_featured_home ? 'On Home' : 'Add Home'}
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleToggle(photo, 'toggle_active')}
                        className={`inline-flex items-center justify-center gap-1 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold transition disabled:opacity-50 ${
                          photo.is_active
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                            : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                        }`}
                      >
                        {photo.is_active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        {photo.is_active ? 'Published' : 'Hidden'}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => openEditModal(photo)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-600 disabled:opacity-50"
                      >
                        <Edit3 className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => setDeleteTarget(photo)}
                        aria-label={`Delete ${photo.title || photo.alt_text}`}
                        className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 p-2 text-rose-700 transition hover:bg-rose-600 hover:text-white disabled:opacity-50"
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
          aria-labelledby="photo-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
        >
          <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-600">
                  <Sparkles className="h-3.5 w-3.5" />
                  {form.id ? 'Update Gallery Photo' : 'Add Gallery Photo(s)'}
                </span>
                <h2 id="photo-modal-title" className="mt-1 text-xl font-black text-slate-950">
                  {form.id ? `Edit "${form.title || form.alt_text}"` : 'Upload or Link Gallery Photo(s)'}
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
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800">
                    Photo File{!form.id ? '(s)' : ''} <span className="text-rose-600">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-2xs hover:bg-blue-700 disabled:opacity-50"
                  >
                    <ImagePlus className="h-3.5 w-3.5" />
                    {uploading ? 'Uploading…' : form.id ? 'Upload Replacement' : 'Select Photo(s)'}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple={!form.id}
                    accept={ACCEPTED_IMAGE_TYPES}
                    className="hidden"
                    onChange={(e) => {
                      void handleFilesSelected(e.target.files);
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
                    void handleFilesSelected(e.dataTransfer.files);
                  }}
                  onClick={() => {
                    if (!form.image_url && queuedUploads.length === 0) fileInputRef.current?.click();
                  }}
                  className={`relative flex min-h-36 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition ${
                    isDragging ? 'border-blue-500 bg-blue-50/60' : 'border-slate-300 bg-white hover:border-blue-400'
                  }`}
                >
                  {queuedUploads.length > 0 ? (
                    <div className="w-full space-y-2 p-3" onClick={(e) => e.stopPropagation()}>
                      <p className="text-xs font-bold text-slate-700">
                        {queuedUploads.length} photos queued (edit captions/alt text below):
                      </p>
                      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                        {queuedUploads.map((item, idx) => (
                          <div key={item.tempId} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={item.image_url} alt={item.alt_text} className="h-14 w-16 shrink-0 rounded-lg object-cover" />
                            <div className="min-w-0 flex-1 space-y-1">
                              <input
                                type="text"
                                value={item.title}
                                placeholder="Optional caption"
                                onChange={(e) =>
                                  setQueuedUploads((prev) =>
                                    prev.map((q, i) => (i === idx ? { ...q, title: e.target.value } : q))
                                  )
                                }
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-900"
                              />
                              <input
                                type="text"
                                required
                                value={item.alt_text}
                                placeholder="Descriptive alt text (required)"
                                onChange={(e) =>
                                  setQueuedUploads((prev) =>
                                    prev.map((q, i) => (i === idx ? { ...q, alt_text: e.target.value } : q))
                                  )
                                }
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-700"
                              />
                            </div>
                            <button
                              type="button"
                              aria-label="Remove queued photo"
                              onClick={() => setQueuedUploads((prev) => prev.filter((_, i) => i !== idx))}
                              className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : form.image_url ? (
                    <div className="relative aspect-[16/9] w-full max-h-52 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={form.image_url} alt="Gallery preview" className="h-full w-full object-cover" />
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
                        {uploading ? 'Uploading to Supabase Storage…' : 'Drag & drop photo(s) here, or click to browse'}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Uploads to website-assets/gallery/ (JPG, PNG, WebP up to 10 MB)
                      </p>
                    </div>
                  )}
                </div>

                {queuedUploads.length === 0 && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500">
                      Or paste an Image URL / local path:
                    </label>
                    <input
                      type="text"
                      required
                      value={form.image_url}
                      onChange={(e) => setForm((prev) => ({ ...prev, image_url: e.target.value }))}
                      placeholder="https://... or /images/beach.jpg"
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {queuedUploads.length === 0 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700">Title / Caption (Optional)</label>
                    <input
                      type="text"
                      value={form.title}
                      onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                      placeholder="e.g., Sunset at Sigiriya"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      Descriptive Alt Text <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={form.alt_text}
                      onChange={(e) => setForm((prev) => ({ ...prev, alt_text: e.target.value }))}
                      placeholder="e.g., Travelers overlooking Sigiriya Rock at sunrise"
                      className={inputClass}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700">Category</label>
                  <select
                    value={form.categoryMode === 'custom' ? '__custom__' : form.category}
                    onChange={(e) =>
                      e.target.value === '__custom__'
                        ? setForm((prev) => ({ ...prev, categoryMode: 'custom' }))
                        : setForm((prev) => ({ ...prev, categoryMode: 'preset', category: e.target.value }))
                    }
                    className={inputClass}
                  >
                    {GALLERY_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    <option value="__custom__">Custom Category...</option>
                  </select>
                  {form.categoryMode === 'custom' && (
                    <input
                      type="text"
                      value={form.customCategory}
                      onChange={(e) => setForm((prev) => ({ ...prev, customCategory: e.target.value }))}
                      placeholder="Enter category"
                      className={inputClass}
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">Home Grid Layout</label>
                  <select
                    value={form.layout_size}
                    onChange={(e) => setForm((prev) => ({ ...prev, layout_size: e.target.value as GalleryLayoutSize }))}
                    className={inputClass}
                  >
                    <option value="standard">Standard (1x1)</option>
                    <option value="wide">Wide (2x1)</option>
                    <option value="featured">Featured (2x2)</option>
                  </select>
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

              <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
                <ToggleField
                  checked={form.is_featured_home}
                  onChange={(val) => setForm((prev) => ({ ...prev, is_featured_home: val }))}
                  title="Show on Home Page"
                  hint="Include in the Home Page mosaic gallery"
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
                  {saving
                    ? 'Saving…'
                    : form.id
                      ? 'Save Changes'
                      : queuedUploads.length > 0
                        ? `Save ${queuedUploads.length} Photo${queuedUploads.length === 1 ? '' : 's'}`
                        : 'Add Photo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDeleteDialog
          title={`Delete "${deleteTarget.title || deleteTarget.alt_text}"?`}
          description={
            <>
              This will permanently remove this photo from both the Home Page and the public Gallery page. Use the{' '}
              <b>Published / Hidden</b> toggle if you only want to hide it temporarily.
            </>
          }
          confirmLabel="Yes, Delete Photo"
          busy={busyId === deleteTarget.id}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void handleConfirmDelete()}
        />
      )}
    </div>
  );
}
