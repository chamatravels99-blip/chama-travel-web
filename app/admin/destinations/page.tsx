'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  Home,
  ImagePlus,
  Layers,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

export type DestinationRecord = {
  id: string;
  name: string;
  slug: string;
  region: string | null;
  tagline: string | null;
  description: string | null;
  image_url: string;
  highlights: string[];
  best_time: string | null;
  travel_duration: string | null;
  is_featured_home: boolean;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
};

type StatusFilter = 'all' | 'featured' | 'active' | 'hidden';

const PRESET_REGIONS = [
  'Hill Country',
  'Cultural Triangle',
  'South Coast',
  'Wildlife & Nature',
  'Heritage & Cities',
];

type DestinationFormState = {
  id: string;
  name: string;
  slug: string;
  slugTouched: boolean;
  regionMode: 'preset' | 'custom';
  region: string;
  customRegion: string;
  tagline: string;
  description: string;
  image_url: string;
  highlights: string[];
  highlightInput: string;
  best_time: string;
  travel_duration: string;
  display_order: string;
  is_featured_home: boolean;
  is_active: boolean;
};

function generateSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function createEmptyForm(nextOrder = 1): DestinationFormState {
  return {
    id: '',
    name: '',
    slug: '',
    slugTouched: false,
    regionMode: 'preset',
    region: 'Hill Country',
    customRegion: '',
    tagline: '',
    description: '',
    image_url: '',
    highlights: [],
    highlightInput: '',
    best_time: '',
    travel_duration: '',
    display_order: String(nextOrder),
    is_featured_home: false,
    is_active: true,
  };
}

export default function AdminDestinationsPage() {
  const [destinations, setDestinations] = useState<DestinationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [regionFilter, setRegionFilter] = useState<string>('All');

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<DestinationFormState>(() => createEmptyForm(1));
  const [deleteTarget, setDeleteTarget] = useState<DestinationRecord | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadDestinations = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/destinations', { cache: 'no-store' });
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        data?: DestinationRecord[];
      };

      if (!response.ok || !result.success || !Array.isArray(result.data)) {
        throw new Error(result.error || 'Destinations could not be loaded.');
      }

      setDestinations(result.data);
      setError('');
    } catch (loadErr) {
      setError(loadErr instanceof Error ? loadErr.message : 'Destinations could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadDestinations);
  }, [loadDestinations]);

  const kpis = useMemo(() => {
    const total = destinations.length;
    const active = destinations.filter((d) => d.is_active).length;
    const featuredHome = destinations.filter((d) => d.is_featured_home).length;
    const hidden = destinations.filter((d) => !d.is_active).length;
    return { total, active, featuredHome, hidden };
  }, [destinations]);

  const availableRegions = useMemo(() => {
    const set = new Set<string>(PRESET_REGIONS);
    for (const dest of destinations) {
      if (dest.region && dest.region.trim()) {
        set.add(dest.region.trim());
      }
    }
    return ['All', ...Array.from(set)];
  }, [destinations]);

  const filteredDestinations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return destinations.filter((dest) => {
      if (statusFilter === 'featured' && !dest.is_featured_home) return false;
      if (statusFilter === 'active' && !dest.is_active) return false;
      if (statusFilter === 'hidden' && dest.is_active) return false;

      if (regionFilter !== 'All' && (dest.region ?? '') !== regionFilter) {
        return false;
      }

      if (!query) return true;
      return [
        dest.name,
        dest.slug,
        dest.region ?? '',
        dest.tagline ?? '',
        dest.description ?? '',
        ...(dest.highlights ?? []),
      ].some((field) => field.toLowerCase().includes(query));
    });
  }, [destinations, searchQuery, statusFilter, regionFilter]);

  function openAddModal() {
    const maxOrder = destinations.reduce((max, d) => Math.max(max, d.display_order || 0), 0);
    setForm(createEmptyForm(maxOrder + 1));
    setError('');
    setModalOpen(true);
  }

  function openEditModal(dest: DestinationRecord) {
    const currentRegion = (dest.region ?? '').trim();
    const isPreset = !currentRegion || PRESET_REGIONS.includes(currentRegion);
    setForm({
      id: dest.id,
      name: dest.name,
      slug: dest.slug,
      slugTouched: true,
      regionMode: isPreset ? 'preset' : 'custom',
      region: isPreset ? currentRegion || 'Hill Country' : 'Hill Country',
      customRegion: isPreset ? '' : currentRegion,
      tagline: dest.tagline ?? '',
      description: dest.description ?? '',
      image_url: dest.image_url,
      highlights: Array.isArray(dest.highlights) ? [...dest.highlights] : [],
      highlightInput: '',
      best_time: dest.best_time ?? '',
      travel_duration: dest.travel_duration ?? '',
      display_order: String(dest.display_order ?? 0),
      is_featured_home: Boolean(dest.is_featured_home),
      is_active: Boolean(dest.is_active),
    });
    setError('');
    setModalOpen(true);
  }

  async function handleToggleFeatured(dest: DestinationRecord) {
    setBusyId(dest.id);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin/destinations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_featured',
          id: dest.id,
          is_featured_home: !dest.is_featured_home,
        }),
      });
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        message?: string;
        data?: DestinationRecord;
      };
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || 'Could not toggle Home Featured status.');
      }
      setDestinations((prev) => prev.map((item) => (item.id === dest.id ? result.data! : item)));
      setNotice(result.message || 'Updated Home Featured status.');
    } catch (toggleErr) {
      setError(toggleErr instanceof Error ? toggleErr.message : 'Could not toggle Home Featured status.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleActive(dest: DestinationRecord) {
    setBusyId(dest.id);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin/destinations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_active',
          id: dest.id,
          is_active: !dest.is_active,
        }),
      });
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        message?: string;
        data?: DestinationRecord;
      };
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || 'Could not toggle visibility status.');
      }
      setDestinations((prev) => prev.map((item) => (item.id === dest.id ? result.data! : item)));
      setNotice(result.message || 'Updated visibility status.');
    } catch (toggleErr) {
      setError(toggleErr instanceof Error ? toggleErr.message : 'Could not toggle visibility status.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setBusyId(target.id);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/admin/destinations?id=${encodeURIComponent(target.id)}`, {
        method: 'DELETE',
      });
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        message?: string;
      };
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Destination could not be deleted.');
      }
      setDestinations((prev) => prev.filter((item) => item.id !== target.id));
      setNotice(`"${target.name}" has been deleted.`);
      setDeleteTarget(null);
    } catch (delErr) {
      setError(delErr instanceof Error ? delErr.message : 'Destination could not be deleted.');
    } finally {
      setBusyId(null);
    }
  }

  async function uploadImageFile(file: File) {
    setUploadingImage(true);
    setError('');
    try {
      // Try direct Supabase Storage upload first, with server upload route fallback
      let publicUrl = '';
      try {
        const supabase = createClient();
        const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
        const baseName =
          file.name
            .replace(/\.[^/.]+$/, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 48) || 'destination';
        const storagePath = `destinations/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${baseName}.${ext}`;

        const { error: directErr } = await supabase.storage
          .from('website-assets')
          .upload(storagePath, file, {
            contentType: file.type,
            upsert: true,
          });

        if (directErr) {
          throw directErr;
        }
        publicUrl = supabase.storage.from('website-assets').getPublicUrl(storagePath).data.publicUrl;
      } catch {
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch('/api/admin/destinations/upload', {
          method: 'POST',
          body: formData,
        });
        const result = (await response.json()) as {
          success?: boolean;
          error?: string;
          data?: { publicUrl: string };
        };
        if (!response.ok || !result.success || !result.data?.publicUrl) {
          throw new Error(result.error || 'Image upload failed.');
        }
        publicUrl = result.data.publicUrl;
      }

      setForm((prev) => ({ ...prev, image_url: publicUrl }));
      setNotice('Image uploaded to Supabase Storage.');
    } catch (uploadErr) {
      setError(uploadErr instanceof Error ? uploadErr.message : 'Image upload failed.');
    } finally {
      setUploadingImage(false);
    }
  }

  function addHighlightTag() {
    const cleaned = form.highlightInput.trim();
    if (!cleaned) return;
    const parts = cleaned
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !form.highlights.includes(s));

    if (parts.length > 0) {
      setForm((prev) => ({
        ...prev,
        highlights: [...prev.highlights, ...parts],
        highlightInput: '',
      }));
    } else {
      setForm((prev) => ({ ...prev, highlightInput: '' }));
    }
  }

  function removeHighlightTag(index: number) {
    setForm((prev) => ({
      ...prev,
      highlights: prev.highlights.filter((_, idx) => idx !== index),
    }));
  }

  async function handleSaveDestination(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');

    const pendingHighlight = form.highlightInput.trim();
    const finalHighlights =
      pendingHighlight && !form.highlights.includes(pendingHighlight)
        ? [...form.highlights, pendingHighlight]
        : form.highlights;

    const finalRegion =
      form.regionMode === 'custom' ? form.customRegion.trim() : form.region.trim();

    try {
      const response = await fetch('/api/admin/destinations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          id: form.id || null,
          name: form.name.trim(),
          slug: (form.slug.trim() || generateSlug(form.name)).toLowerCase(),
          region: finalRegion,
          tagline: form.tagline.trim(),
          description: form.description.trim(),
          image_url: form.image_url.trim(),
          highlights: finalHighlights,
          best_time: form.best_time.trim(),
          travel_duration: form.travel_duration.trim(),
          display_order: Number(form.display_order) || 0,
          is_featured_home: form.is_featured_home,
          is_active: form.is_active,
        }),
      });

      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        message?: string;
      };

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Destination could not be saved.');
      }

      setNotice(result.message || 'Destination saved successfully.');
      setModalOpen(false);
      await loadDestinations();
    } catch (saveErr) {
      setError(saveErr instanceof Error ? saveErr.message : 'Destination could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* TOP HEADER */}
        <header className="flex flex-col gap-5 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Link
                href="/admin/dashboard"
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
              </Link>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-800">
                <MapPin className="h-3.5 w-3.5" /> Website Content Manager
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              Destinations Management
            </h1>
            <p className="mt-1.5 text-sm text-slate-600">
              Add, edit, reorder, and control which Sri Lanka destinations appear on the Home Page and public Destinations Guide.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/destinations"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50"
            >
              <ExternalLink className="h-4 w-4 text-blue-600" /> View Public Page
            </Link>
            <button
              type="button"
              onClick={() => void loadDestinations()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-600/20 transition hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" /> + Add New Destination
            </button>
          </div>
        </header>

        {/* ALERTS */}
        {error && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900"
          >
            <div className="flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError('')}
              className="rounded-lg p-1 text-rose-600 hover:bg-rose-100"
              aria-label="Dismiss error"
            >
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
            <button
              type="button"
              onClick={() => setNotice('')}
              className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-100"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* TOP KPI BAR */}
        <section
          aria-label="Destinations summary metrics"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total Destinations
              </span>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <Layers className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-black text-slate-950">{kpis.total}</p>
            <p className="mt-1.5 text-xs text-slate-500">All curated locations in database</p>
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                Published (Active)
              </span>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                <Eye className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-black text-emerald-950">{kpis.active}</p>
            <p className="mt-1.5 text-xs text-emerald-800">Visible on /destinations page</p>
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-blue-200/80 bg-blue-50/40 p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-900">
                Featured on Home Page
              </span>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-800">
                <Star className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-black text-blue-950">{kpis.featuredHome}</p>
            <p className="mt-1.5 text-xs text-blue-800">Shown in Home Page carousel</p>
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-amber-200/80 bg-amber-50/40 p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-900">
                Hidden (Drafts)
              </span>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                <EyeOff className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-black text-amber-950">{kpis.hidden}</p>
            <p className="mt-1.5 text-xs text-amber-800">Hidden from public visitors</p>
          </div>
        </section>

        {/* SEARCH & FILTER BAR */}
        <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by destination name, region, or attraction..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
              />
            </div>

            {/* Status & Region Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                {(
                  [
                    { id: 'all', label: `All (${kpis.total})` },
                    { id: 'featured', label: `Home Featured (${kpis.featuredHome})` },
                    { id: 'active', label: `Active (${kpis.active})` },
                    { id: 'hidden', label: `Hidden (${kpis.hidden})` },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                      statusFilter === tab.id
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <select
                aria-label="Filter by Region"
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 focus:border-blue-500 focus:bg-white focus:outline-none"
              >
                {availableRegions.map((reg) => (
                  <option key={reg} value={reg}>
                    {reg === 'All' ? 'All Regions' : reg}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* DESTINATIONS CARDS GRID */}
        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-sm font-medium text-slate-500">
            Loading destinations…
          </div>
        ) : filteredDestinations.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <MapPin className="mx-auto h-10 w-10 text-slate-400" />
            <h2 className="mt-3 text-base font-bold text-slate-900">No destinations found</h2>
            <p className="mt-1 text-xs text-slate-500">
              Try adjusting your search or filter, or add a new destination to get started.
            </p>
            <button
              type="button"
              onClick={openAddModal}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" /> + Add New Destination
            </button>
          </div>
        ) : (
          <section
            aria-label="Destinations grid"
            className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            {filteredDestinations.map((dest) => {
              const isBusy = busyId === dest.id;
              return (
                <article
                  key={dest.id}
                  className={`group flex flex-col overflow-hidden rounded-3xl border bg-white shadow-xs transition duration-200 hover:shadow-md ${
                    dest.is_active ? 'border-slate-200/90' : 'border-amber-200 bg-slate-50/60 opacity-85'
                  }`}
                >
                  {/* Card Image & Badges */}
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={dest.image_url}
                      alt={dest.name}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-slate-950/10 to-transparent" />

                    {/* Top Left: Region & Order */}
                    <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-slate-800 shadow-xs backdrop-blur-md">
                        📍 {dest.region || 'Sri Lanka'}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-slate-900/80 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-md">
                        #{dest.display_order}
                      </span>
                    </div>

                    {/* Top Right: Status Badges */}
                    <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
                      {dest.is_featured_home && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-xs">
                          <Star className="h-3 w-3 fill-current" /> Home Featured
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold shadow-xs ${
                          dest.is_active
                            ? 'bg-emerald-500 text-white'
                            : 'bg-amber-500 text-white'
                        }`}
                      >
                        {dest.is_active ? 'Active' : 'Hidden'}
                      </span>
                    </div>

                    {/* Bottom Image Title */}
                    <div className="absolute bottom-3 left-4 right-4 text-white">
                      <h2 className="text-xl font-extrabold tracking-tight drop-shadow-xs">
                        {dest.name}
                      </h2>
                      {dest.tagline && (
                        <p className="mt-0.5 truncate text-xs font-medium text-blue-100">
                          {dest.tagline}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="flex flex-1 flex-col p-5">
                    {dest.description ? (
                      <p className="line-clamp-2 text-xs leading-relaxed text-slate-600">
                        {dest.description}
                      </p>
                    ) : (
                      <p className="text-xs italic text-slate-400">No description provided.</p>
                    )}

                    {/* Meta info: Best Time & Duration */}
                    {(dest.best_time || dest.travel_duration) && (
                      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-600">
                        {dest.best_time && (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 font-semibold">
                            <Calendar className="h-3 w-3 text-blue-600" /> {dest.best_time}
                          </span>
                        )}
                        {dest.travel_duration && (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 font-semibold">
                            <Clock className="h-3 w-3 text-blue-600" /> {dest.travel_duration}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Highlights Tags */}
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        Key Attractions ({dest.highlights?.length || 0})
                      </p>
                      {dest.highlights && dest.highlights.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {dest.highlights.slice(0, 4).map((tag, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center rounded-lg border border-blue-100 bg-blue-50/60 px-2 py-0.5 text-[11px] font-medium text-blue-900"
                            >
                              ✓ {tag}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400">No highlights added yet</p>
                      )}
                    </div>

                    {/* Quick Toggles & Action Buttons */}
                    <div className="mt-auto pt-4 space-y-2.5">
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleToggleFeatured(dest)}
                          title={
                            dest.is_featured_home
                              ? 'Remove from Home Page'
                              : 'Feature on Home Page'
                          }
                          className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition disabled:opacity-50 ${
                            dest.is_featured_home
                              ? 'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <Home className="h-3.5 w-3.5" />
                          {dest.is_featured_home ? 'On Home Page' : 'Add to Home'}
                        </button>

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleToggleActive(dest)}
                          title={dest.is_active ? 'Hide from public site' : 'Publish to public site'}
                          className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition disabled:opacity-50 ${
                            dest.is_active
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                              : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                          }`}
                        >
                          {dest.is_active ? (
                            <>
                              <Eye className="h-3.5 w-3.5" /> Published
                            </>
                          ) : (
                            <>
                              <EyeOff className="h-3.5 w-3.5" /> Hidden
                            </>
                          )}
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => openEditModal(dest)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-blue-600 disabled:opacity-50"
                        >
                          <Edit3 className="h-3.5 w-3.5" /> Edit Destination
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => setDeleteTarget(dest)}
                          aria-label={`Delete ${dest.name}`}
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
      </main>

      {/* ADD / EDIT DESTINATION MODAL */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="destination-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
        >
          <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-600">
                  <Sparkles className="h-3.5 w-3.5" />
                  {form.id ? 'Update Destination' : 'Create Destination'}
                </span>
                <h2 id="destination-modal-title" className="mt-1 text-xl font-black text-slate-950">
                  {form.id ? `Edit "${form.name}"` : 'Add New Sri Lanka Destination'}
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

            <form onSubmit={(e) => void handleSaveDestination(e)} className="mt-5 space-y-5">
              {/* Name & Slug */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Destination Name <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => {
                      const nextName = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        name: nextName,
                        slug: prev.slugTouched ? prev.slug : generateSlug(nextName),
                      }));
                    }}
                    placeholder="e.g., Ella, Sigiriya, Trincomalee"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
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
                      setForm((prev) => ({
                        ...prev,
                        slug: generateSlug(e.target.value),
                        slugTouched: true,
                      }))
                    }
                    placeholder="e.g., ella-highlands"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono text-xs text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Region & Display Order */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Region / Category
                  </label>
                  <div className="mt-1.5 flex gap-2">
                    <select
                      value={form.regionMode === 'custom' ? '__custom__' : form.region}
                      onChange={(e) => {
                        if (e.target.value === '__custom__') {
                          setForm((prev) => ({ ...prev, regionMode: 'custom' }));
                        } else {
                          setForm((prev) => ({
                            ...prev,
                            regionMode: 'preset',
                            region: e.target.value,
                          }));
                        }
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                    >
                      {PRESET_REGIONS.map((reg) => (
                        <option key={reg} value={reg}>
                          {reg}
                        </option>
                      ))}
                      <option value="__custom__">Custom Region...</option>
                    </select>

                    {form.regionMode === 'custom' && (
                      <input
                        type="text"
                        value={form.customRegion}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, customRegion: e.target.value }))
                        }
                        placeholder="Enter custom region"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Display Order
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.display_order}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, display_order: e.target.value }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Image Uploader & URL Input */}
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800">
                    Destination Cover Image <span className="text-rose-600">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-2xs hover:bg-blue-700 disabled:opacity-50"
                  >
                    <ImagePlus className="h-3.5 w-3.5" />
                    {uploadingImage ? 'Uploading…' : 'Upload Image File'}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        void uploadImageFile(file);
                      }
                      e.target.value = '';
                    }}
                  />
                </div>

                {/* Drag & Drop Zone + Live Preview */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingOver(true);
                  }}
                  onDragLeave={() => setIsDraggingOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingOver(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                      void uploadImageFile(file);
                    }
                  }}
                  onClick={() => {
                    if (!form.image_url) fileInputRef.current?.click();
                  }}
                  className={`relative flex min-h-40 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition ${
                    isDraggingOver
                      ? 'border-blue-500 bg-blue-50/60'
                      : 'border-slate-300 bg-white hover:border-blue-400'
                  }`}
                >
                  {form.image_url ? (
                    <div className="relative aspect-[16/9] w-full max-h-52 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={form.image_url}
                        alt="Destination preview"
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute bottom-2 right-2 flex gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            fileInputRef.current?.click();
                          }}
                          className="rounded-lg bg-slate-900/80 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-xs hover:bg-slate-900"
                        >
                          Replace Photo
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 text-center">
                      <UploadCloud className="mx-auto h-8 w-8 text-blue-600" />
                      <p className="mt-2 text-xs font-bold text-slate-700">
                        {uploadingImage
                          ? 'Uploading to Supabase Storage…'
                          : 'Drag & drop an image here, or click to browse'}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Uploads directly to Supabase Storage (JPG, PNG, WebP up to 10 MB)
                      </p>
                    </div>
                  )}
                </div>

                {/* Direct Image URL Input */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500">
                    Or paste an Image URL / local path:
                  </label>
                  <input
                    type="text"
                    required
                    value={form.image_url}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, image_url: e.target.value }))
                    }
                    placeholder="https://... or /images/Sigiriya.jpeg"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Short Tagline & Full Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Short Tagline (Subtitle)
                </label>
                <input
                  type="text"
                  value={form.tagline}
                  onChange={(e) => setForm((prev) => ({ ...prev, tagline: e.target.value }))}
                  placeholder="e.g., Misty Mountains, Tea Trails & Iconic Railway Bridges"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Full Description
                </label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Describe why travelers love visiting this destination..."
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs leading-relaxed text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                />
              </div>

              {/* Highlights Tag Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Key Attractions / Highlights (2–4 recommended)
                </label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    type="text"
                    value={form.highlightInput}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, highlightInput: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addHighlightTag();
                      }
                    }}
                    placeholder="e.g., Nine Arches Bridge (press Enter or click Add)"
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
                          onClick={() => removeHighlightTag(idx)}
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

              {/* Best Time to Visit & Travel Duration */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Best Time to Visit (Optional)
                  </label>
                  <input
                    type="text"
                    value={form.best_time}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, best_time: e.target.value }))
                    }
                    placeholder="e.g., December to April"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Recommended Stay / Travel Duration (Optional)
                  </label>
                  <input
                    type="text"
                    value={form.travel_duration}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, travel_duration: e.target.value }))
                    }
                    placeholder="e.g., 2 - 3 Days (4 hrs from Airport)"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Toggles: Show on Home Page & Published */}
              <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 transition hover:border-blue-300">
                  <input
                    type="checkbox"
                    checked={form.is_featured_home}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, is_featured_home: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="block text-xs font-bold text-slate-900">
                      Show on Home Page (Featured)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Include in the Popular Destinations carousel
                    </span>
                  </div>
                </label>

                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 transition hover:border-emerald-300">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, is_active: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="block text-xs font-bold text-slate-900">
                      Published (Active)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Visible to visitors on the public website
                    </span>
                  </div>
                </label>
              </div>

              {/* Submit / Cancel Footer */}
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
                  disabled={saving || uploadingImage}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving
                    ? 'Saving…'
                    : form.id
                      ? 'Save Changes'
                      : 'Create Destination'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-destination-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
              <Trash2 className="h-6 w-6" />
            </div>
            <h2 id="delete-destination-title" className="mt-4 text-lg font-black text-slate-950">
              Delete &ldquo;{deleteTarget.name}&rdquo;?
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              This will permanently remove <b>{deleteTarget.name}</b> from both the Home Page and the public Destinations page. If you only want to hide it temporarily, use the <b>Published / Hidden</b> toggle instead.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyId === deleteTarget.id}
                onClick={() => void handleConfirmDelete()}
                className="rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
              >
                {busyId === deleteTarget.id ? 'Deleting…' : 'Yes, Delete Destination'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
