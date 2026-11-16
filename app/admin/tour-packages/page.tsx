'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  Home,
  ImagePlus,
  Layers,
  Map,
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

export type AdminItineraryDay = {
  day: number;
  title: string;
  route?: string;
  description: string;
  activities?: string[];
  overnightLocation?: string;
  travelTime?: string;
};

export type TourPackageRecord = {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  duration: string;
  days_count: number;
  price_usd: number | null;
  price_lkr: number | null;
  price_note: string | null;
  tagline: string | null;
  description: string | null;
  image_url: string;
  destinations_covered: string[];
  highlights: string[];
  included: string[];
  itinerary: AdminItineraryDay[];
  is_featured_home: boolean;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
};

type StatusFilter = 'all' | 'featured' | 'active' | 'hidden';

const PRESET_CATEGORIES = [
  'Multi-Day Round Tours',
  'Day Trips',
  'Coastal Escapes',
  'Tailor-Made Itineraries',
  'Cultural & Heritage',
  'Hill Country',
  'Wildlife & Beach',
];

type TourPackageFormState = {
  id: string;
  title: string;
  slug: string;
  slugTouched: boolean;
  categoryMode: 'preset' | 'custom';
  category: string;
  customCategory: string;
  duration: string;
  days_count: string;
  price_usd: string;
  price_lkr: string;
  price_note: string;
  tagline: string;
  description: string;
  image_url: string;
  destinations_covered: string[];
  destinationInput: string;
  highlights: string[];
  highlightInput: string;
  included: string[];
  includedInput: string;
  itinerary: AdminItineraryDay[];
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

function createEmptyForm(nextOrder = 1): TourPackageFormState {
  return {
    id: '',
    title: '',
    slug: '',
    slugTouched: false,
    categoryMode: 'preset',
    category: 'Multi-Day Round Tours',
    customCategory: '',
    duration: '5 Days / 4 Nights',
    days_count: '5',
    price_usd: '450',
    price_lkr: '',
    price_note: 'per vehicle',
    tagline: '',
    description: '',
    image_url: '',
    destinations_covered: [],
    destinationInput: '',
    highlights: [],
    highlightInput: '',
    included: [
      'Private air-conditioned vehicle exclusively for your party',
      'Experienced English-speaking chauffeur guide',
      'All fuel, highway tolls, and parking fees',
    ],
    includedInput: '',
    itinerary: [
      {
        day: 1,
        title: 'Arrival & Journey to First Destination',
        route: 'Airport (CMB) → Sigiriya',
        description: 'Meet your dedicated Chama Travels driver at the airport and begin your private journey across Sri Lanka.',
      },
    ],
    display_order: String(nextOrder),
    is_featured_home: false,
    is_active: true,
  };
}

export default function AdminTourPackagesPage() {
  const [packages, setPackages] = useState<TourPackageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<TourPackageFormState>(() => createEmptyForm(1));
  const [deleteTarget, setDeleteTarget] = useState<TourPackageRecord | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadPackages = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/tour-packages', { cache: 'no-store' });
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        data?: TourPackageRecord[];
      };

      if (!response.ok || !result.success || !Array.isArray(result.data)) {
        throw new Error(result.error || 'Tour packages could not be loaded.');
      }

      setPackages(result.data);
      setError('');
    } catch (loadErr) {
      setError(loadErr instanceof Error ? loadErr.message : 'Tour packages could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadPackages);
  }, [loadPackages]);

  const kpis = useMemo(() => {
    const total = packages.length;
    const active = packages.filter((p) => p.is_active).length;
    const featuredHome = packages.filter((p) => p.is_featured_home).length;
    const hidden = packages.filter((p) => !p.is_active).length;
    return { total, active, featuredHome, hidden };
  }, [packages]);

  const availableCategories = useMemo(() => {
    const set = new Set<string>(PRESET_CATEGORIES);
    for (const pkg of packages) {
      if (pkg.category && pkg.category.trim()) {
        set.add(pkg.category.trim());
      }
    }
    return ['All', ...Array.from(set)];
  }, [packages]);

  const filteredPackages = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return packages.filter((pkg) => {
      if (statusFilter === 'featured' && !pkg.is_featured_home) return false;
      if (statusFilter === 'active' && !pkg.is_active) return false;
      if (statusFilter === 'hidden' && pkg.is_active) return false;

      if (categoryFilter !== 'All' && (pkg.category ?? '') !== categoryFilter) {
        return false;
      }

      if (!query) return true;
      return [
        pkg.title,
        pkg.slug,
        pkg.category ?? '',
        pkg.duration,
        pkg.tagline ?? '',
        pkg.description ?? '',
        ...(pkg.destinations_covered ?? []),
        ...(pkg.highlights ?? []),
      ].some((field) => field.toLowerCase().includes(query));
    });
  }, [packages, searchQuery, statusFilter, categoryFilter]);

  function openAddModal() {
    const maxOrder = packages.reduce((max, p) => Math.max(max, p.display_order || 0), 0);
    setForm(createEmptyForm(maxOrder + 1));
    setError('');
    setModalOpen(true);
  }

  function openEditModal(pkg: TourPackageRecord) {
    const currentCat = (pkg.category ?? '').trim();
    const isPreset = !currentCat || PRESET_CATEGORIES.includes(currentCat);
    const parsedItinerary = Array.isArray(pkg.itinerary)
      ? pkg.itinerary.map((d, idx) => ({
          day: Number(d.day) || idx + 1,
          title: d.title ?? '',
          route: d.route ?? '',
          description: d.description ?? '',
          activities: Array.isArray(d.activities) ? [...d.activities] : undefined,
          overnightLocation: d.overnightLocation,
          travelTime: d.travelTime,
        }))
      : [];

    setForm({
      id: pkg.id,
      title: pkg.title,
      slug: pkg.slug,
      slugTouched: true,
      categoryMode: isPreset ? 'preset' : 'custom',
      category: isPreset ? currentCat || 'Multi-Day Round Tours' : 'Multi-Day Round Tours',
      customCategory: isPreset ? '' : currentCat,
      duration: pkg.duration,
      days_count: String(pkg.days_count ?? 1),
      price_usd: pkg.price_usd !== null && pkg.price_usd !== undefined ? String(pkg.price_usd) : '',
      price_lkr: pkg.price_lkr !== null && pkg.price_lkr !== undefined ? String(pkg.price_lkr) : '',
      price_note: pkg.price_note ?? 'per vehicle',
      tagline: pkg.tagline ?? '',
      description: pkg.description ?? '',
      image_url: pkg.image_url,
      destinations_covered: Array.isArray(pkg.destinations_covered) ? [...pkg.destinations_covered] : [],
      destinationInput: '',
      highlights: Array.isArray(pkg.highlights) ? [...pkg.highlights] : [],
      highlightInput: '',
      included: Array.isArray(pkg.included) ? [...pkg.included] : [],
      includedInput: '',
      itinerary: parsedItinerary,
      display_order: String(pkg.display_order ?? 0),
      is_featured_home: Boolean(pkg.is_featured_home),
      is_active: Boolean(pkg.is_active),
    });
    setError('');
    setModalOpen(true);
  }

  async function handleToggleFeatured(pkg: TourPackageRecord) {
    setBusyId(pkg.id);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin/tour-packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_featured',
          id: pkg.id,
          is_featured_home: !pkg.is_featured_home,
        }),
      });
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        message?: string;
        data?: TourPackageRecord;
      };
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || 'Could not toggle Home Featured status.');
      }
      setPackages((prev) => prev.map((item) => (item.id === pkg.id ? result.data! : item)));
      setNotice(result.message || 'Updated Home Featured status.');
    } catch (toggleErr) {
      setError(toggleErr instanceof Error ? toggleErr.message : 'Could not toggle Home Featured status.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleActive(pkg: TourPackageRecord) {
    setBusyId(pkg.id);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin/tour-packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_active',
          id: pkg.id,
          is_active: !pkg.is_active,
        }),
      });
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        message?: string;
        data?: TourPackageRecord;
      };
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || 'Could not toggle visibility status.');
      }
      setPackages((prev) => prev.map((item) => (item.id === pkg.id ? result.data! : item)));
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
      const response = await fetch(`/api/admin/tour-packages?id=${encodeURIComponent(target.id)}`, {
        method: 'DELETE',
      });
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        message?: string;
      };
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Tour package could not be deleted.');
      }
      setPackages((prev) => prev.filter((item) => item.id !== target.id));
      setNotice(`"${target.title}" has been deleted.`);
      setDeleteTarget(null);
    } catch (delErr) {
      setError(delErr instanceof Error ? delErr.message : 'Tour package could not be deleted.');
    } finally {
      setBusyId(null);
    }
  }

  async function uploadImageFile(file: File) {
    setUploadingImage(true);
    setError('');
    try {
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
            .slice(0, 48) || 'tour-package';
        const storagePath = `tour-packages/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${baseName}.${ext}`;

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
        const response = await fetch('/api/admin/tour-packages/upload', {
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
      setNotice('Cover image uploaded to Supabase Storage.');
    } catch (uploadErr) {
      setError(uploadErr instanceof Error ? uploadErr.message : 'Image upload failed.');
    } finally {
      setUploadingImage(false);
    }
  }

  function addTagItem(
    field: 'destinations_covered' | 'highlights' | 'included',
    inputField: 'destinationInput' | 'highlightInput' | 'includedInput'
  ) {
    const cleaned = form[inputField].trim();
    if (!cleaned) return;
    const parts = cleaned
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !form[field].includes(s));

    setForm((prev) => ({
      ...prev,
      [field]: parts.length > 0 ? [...prev[field], ...parts] : prev[field],
      [inputField]: '',
    }));
  }

  function removeTagItem(field: 'destinations_covered' | 'highlights' | 'included', index: number) {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].filter((_, idx) => idx !== index),
    }));
  }

  function addItineraryDay() {
    setForm((prev) => {
      const nextDayNum =
        prev.itinerary.reduce((max, item) => Math.max(max, item.day || 0), 0) + 1;
      return {
        ...prev,
        itinerary: [
          ...prev.itinerary,
          {
            day: nextDayNum,
            title: `Day ${nextDayNum} Exploration`,
            route: '',
            description: '',
          },
        ],
      };
    });
  }

  function updateItineraryDay(index: number, patch: Partial<AdminItineraryDay>) {
    setForm((prev) => ({
      ...prev,
      itinerary: prev.itinerary.map((item, idx) => (idx === index ? { ...item, ...patch } : item)),
    }));
  }

  function removeItineraryDay(index: number) {
    setForm((prev) => ({
      ...prev,
      itinerary: prev.itinerary
        .filter((_, idx) => idx !== index)
        .map((item, idx) => ({ ...item, day: idx + 1 })),
    }));
  }

  async function handleSavePackage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');

    const finalDestinations =
      form.destinationInput.trim() && !form.destinations_covered.includes(form.destinationInput.trim())
        ? [...form.destinations_covered, form.destinationInput.trim()]
        : form.destinations_covered;

    const finalHighlights =
      form.highlightInput.trim() && !form.highlights.includes(form.highlightInput.trim())
        ? [...form.highlights, form.highlightInput.trim()]
        : form.highlights;

    const finalIncluded =
      form.includedInput.trim() && !form.included.includes(form.includedInput.trim())
        ? [...form.included, form.includedInput.trim()]
        : form.included;

    const finalCategory =
      form.categoryMode === 'custom' ? form.customCategory.trim() : form.category.trim();

    try {
      const response = await fetch('/api/admin/tour-packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          id: form.id || null,
          title: form.title.trim(),
          slug: (form.slug.trim() || generateSlug(form.title)).toLowerCase(),
          category: finalCategory,
          duration: form.duration.trim(),
          days_count: Number(form.days_count) || 1,
          price_usd: form.price_usd.trim() ? Number(form.price_usd) : null,
          price_lkr: form.price_lkr.trim() ? Number(form.price_lkr) : null,
          price_note: form.price_note.trim(),
          tagline: form.tagline.trim(),
          description: form.description.trim(),
          image_url: form.image_url.trim(),
          destinations_covered: finalDestinations,
          highlights: finalHighlights,
          included: finalIncluded,
          itinerary: form.itinerary,
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
        throw new Error(result.error || 'Tour package could not be saved.');
      }

      setNotice(result.message || 'Tour package saved successfully.');
      setModalOpen(false);
      await loadPackages();
    } catch (saveErr) {
      setError(saveErr instanceof Error ? saveErr.message : 'Tour package could not be saved.');
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
                <Map className="h-3.5 w-3.5" /> Website Content Manager
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              Tour Packages Management
            </h1>
            <p className="mt-1.5 text-sm text-slate-600">
              Create, edit, price, and manage multi-day itineraries and day tours across the Home Page and public Tours catalog.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/tours"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50"
            >
              <ExternalLink className="h-4 w-4 text-blue-600" /> View Public Tours
            </Link>
            <button
              type="button"
              onClick={() => void loadPackages()}
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
              <Plus className="h-4 w-4" /> + Add New Tour Package
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
          aria-label="Tour packages summary metrics"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total Packages
              </span>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <Layers className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-black text-slate-950">{kpis.total}</p>
            <p className="mt-1.5 text-xs text-slate-500">All tour itineraries in database</p>
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
            <p className="mt-1.5 text-xs text-emerald-800">Visible on /tours page</p>
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
            <p className="mt-1.5 text-xs text-blue-800">Shown in Home Page Featured Tours</p>
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
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by package title, category, or destination..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
              />
            </div>

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
                aria-label="Filter by Category"
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
            </div>
          </div>
        </section>

        {/* TOUR PACKAGES GRID */}
        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-sm font-medium text-slate-500">
            Loading tour packages…
          </div>
        ) : filteredPackages.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <Map className="mx-auto h-10 w-10 text-slate-400" />
            <h2 className="mt-3 text-base font-bold text-slate-900">No tour packages found</h2>
            <p className="mt-1 text-xs text-slate-500">
              Try adjusting your search or filter, or add a new tour package to get started.
            </p>
            <button
              type="button"
              onClick={openAddModal}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" /> + Add New Tour Package
            </button>
          </div>
        ) : (
          <section
            aria-label="Tour packages grid"
            className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            {filteredPackages.map((pkg) => {
              const isBusy = busyId === pkg.id;
              return (
                <article
                  key={pkg.id}
                  className={`group flex flex-col overflow-hidden rounded-3xl border bg-white shadow-xs transition duration-200 hover:shadow-md ${
                    pkg.is_active ? 'border-slate-200/90' : 'border-amber-200 bg-slate-50/60 opacity-85'
                  }`}
                >
                  {/* Cover Image & Badges */}
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={pkg.image_url}
                      alt={pkg.title}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/20 to-transparent" />

                    {/* Top Left: Category, Duration & Order */}
                    <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-slate-800 shadow-xs backdrop-blur-md">
                        {pkg.category || 'Tour Package'}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-600/90 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-md">
                        <Clock className="h-3 w-3" /> {pkg.duration}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-slate-900/80 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-md">
                        #{pkg.display_order}
                      </span>
                    </div>

                    {/* Top Right: Status Badges */}
                    <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
                      {pkg.is_featured_home && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-xs">
                          <Star className="h-3 w-3 fill-current" /> Home Featured
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold shadow-xs ${
                          pkg.is_active ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
                        }`}
                      >
                        {pkg.is_active ? 'Active' : 'Hidden'}
                      </span>
                    </div>

                    {/* Bottom Image Title */}
                    <div className="absolute bottom-3 left-4 right-4 text-white">
                      <h2 className="text-lg font-extrabold leading-snug tracking-tight drop-shadow-xs">
                        {pkg.title}
                      </h2>
                      {pkg.tagline && (
                        <p className="mt-0.5 truncate text-[11px] font-medium text-blue-100">
                          {pkg.tagline}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="flex flex-1 flex-col p-5">
                    {/* Price Banner */}
                    <div className="flex items-center justify-between rounded-2xl border border-blue-100 bg-blue-50/50 px-3.5 py-2.5">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Starting Rate ({pkg.price_note || 'per vehicle'})
                        </span>
                        <div className="flex items-baseline gap-2">
                          <span className="text-lg font-black text-slate-950">
                            {pkg.price_usd ? `$${Number(pkg.price_usd).toLocaleString()}` : 'Custom'}
                          </span>
                          {pkg.price_lkr && (
                            <span className="text-xs font-semibold text-slate-500">
                              · LKR {Number(pkg.price_lkr).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-blue-700 shadow-2xs">
                        {pkg.itinerary?.length || pkg.days_count || 1} Days Plan
                      </span>
                    </div>

                    {pkg.description ? (
                      <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-slate-600">
                        {pkg.description}
                      </p>
                    ) : (
                      <p className="mt-3 text-xs italic text-slate-400">No description provided.</p>
                    )}

                    {/* Destinations Covered Tags */}
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        Destinations Covered ({pkg.destinations_covered?.length || 0})
                      </p>
                      {pkg.destinations_covered && pkg.destinations_covered.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {pkg.destinations_covered.slice(0, 5).map((dest, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700"
                            >
                              <MapPin className="h-2.5 w-2.5 text-blue-600" /> {dest}
                            </span>
                          ))}
                          {pkg.destinations_covered.length > 5 && (
                            <span className="text-[11px] font-semibold text-blue-600">
                              +{pkg.destinations_covered.length - 5} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400">No route stops listed</p>
                      )}
                    </div>

                    {/* Quick Toggles & Action Buttons */}
                    <div className="mt-auto pt-4 space-y-2.5">
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleToggleFeatured(pkg)}
                          title={
                            pkg.is_featured_home
                              ? 'Remove from Home Page'
                              : 'Feature on Home Page'
                          }
                          className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition disabled:opacity-50 ${
                            pkg.is_featured_home
                              ? 'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <Home className="h-3.5 w-3.5" />
                          {pkg.is_featured_home ? 'On Home Page' : 'Add to Home'}
                        </button>

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleToggleActive(pkg)}
                          title={pkg.is_active ? 'Hide from public site' : 'Publish to public site'}
                          className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition disabled:opacity-50 ${
                            pkg.is_active
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                              : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                          }`}
                        >
                          {pkg.is_active ? (
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
                          onClick={() => openEditModal(pkg)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-blue-600 disabled:opacity-50"
                        >
                          <Edit3 className="h-3.5 w-3.5" /> Edit Package
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => setDeleteTarget(pkg)}
                          aria-label={`Delete ${pkg.title}`}
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

      {/* ADD / EDIT TOUR PACKAGE MODAL */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="package-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
        >
          <div className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-600">
                  <Sparkles className="h-3.5 w-3.5" />
                  {form.id ? 'Update Tour Package' : 'Create Tour Package'}
                </span>
                <h2 id="package-modal-title" className="mt-1 text-xl font-black text-slate-950">
                  {form.id ? `Edit "${form.title}"` : 'Add New Sri Lanka Tour Package'}
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

            <form onSubmit={(e) => void handleSavePackage(e)} className="mt-5 space-y-5">
              {/* Title & Slug */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Package Title <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.title}
                    onChange={(e) => {
                      const nextTitle = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        title: nextTitle,
                        slug: prev.slugTouched ? prev.slug : generateSlug(nextTitle),
                      }));
                    }}
                    placeholder="e.g., 8-Day Highlights of Sri Lanka"
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
                    placeholder="e.g., 8-day-highlights-of-sri-lanka"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono text-xs text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Category, Duration, Days Count & Display Order */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Category
                  </label>
                  <div className="mt-1.5 flex gap-2">
                    <select
                      value={form.categoryMode === 'custom' ? '__custom__' : form.category}
                      onChange={(e) => {
                        if (e.target.value === '__custom__') {
                          setForm((prev) => ({ ...prev, categoryMode: 'custom' }));
                        } else {
                          setForm((prev) => ({
                            ...prev,
                            categoryMode: 'preset',
                            category: e.target.value,
                          }));
                        }
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                    >
                      {PRESET_CATEGORIES.map((cat) => (
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
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, customCategory: e.target.value }))
                        }
                        placeholder="Custom category"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Duration Text <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.duration}
                    onChange={(e) => setForm((prev) => ({ ...prev, duration: e.target.value }))}
                    placeholder="e.g., 7 Days / 6 Nights"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      Days
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={form.days_count}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, days_count: e.target.value }))
                      }
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      Order #
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.display_order}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, display_order: e.target.value }))
                      }
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Pricing Row */}
              <div className="grid grid-cols-1 gap-4 rounded-2xl border border-blue-100 bg-blue-50/40 p-4 sm:grid-cols-3">
                <div>
                  <label className="flex items-center gap-1 text-xs font-bold text-slate-700">
                    <DollarSign className="h-3.5 w-3.5 text-blue-600" /> Price (USD)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={form.price_usd}
                    onChange={(e) => setForm((prev) => ({ ...prev, price_usd: e.target.value }))}
                    placeholder="e.g., 550"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Price (LKR, Optional)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={form.price_lkr}
                    onChange={(e) => setForm((prev) => ({ ...prev, price_lkr: e.target.value }))}
                    placeholder="e.g., 165000"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Price Note / Unit
                  </label>
                  <input
                    type="text"
                    value={form.price_note}
                    onChange={(e) => setForm((prev) => ({ ...prev, price_note: e.target.value }))}
                    placeholder="e.g., per vehicle or per person"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Cover Image Uploader */}
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800">
                    Tour Package Cover Image <span className="text-rose-600">*</span>
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
                        alt="Package preview"
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
                          : 'Drag & drop a cover image here, or click to browse'}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Uploads directly to website-assets/tour-packages/ (JPG, PNG, WebP up to 10 MB)
                      </p>
                    </div>
                  )}
                </div>

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
                    placeholder="https://... or /images/Ella_adventure.JPG"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Tagline & Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Short Tagline / Badge Summary
                </label>
                <input
                  type="text"
                  value={form.tagline}
                  onChange={(e) => setForm((prev) => ({ ...prev, tagline: e.target.value }))}
                  placeholder="e.g., Bestseller • Ancient Sigiriya, Royal Kandy, Scenic Ella Train & Yala Safari"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Full Tour Overview Description
                </label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Describe the tour highlights, pace, and experience..."
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs leading-relaxed text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                />
              </div>

              {/* Destinations Covered (Tag Input) */}
              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Destinations Covered (Route Stops)
                </label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    type="text"
                    value={form.destinationInput}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, destinationInput: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTagItem('destinations_covered', 'destinationInput');
                      }
                    }}
                    placeholder="e.g., Sigiriya, Kandy, Ella, Yala (press Enter or click Add)"
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => addTagItem('destinations_covered', 'destinationInput')}
                    className="rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-600"
                  >
                    + Add Stop
                  </button>
                </div>
                {form.destinations_covered.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {form.destinations_covered.map((stop, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800"
                      >
                        📍 {stop}
                        <button
                          type="button"
                          onClick={() => removeTagItem('destinations_covered', idx)}
                          className="rounded-full p-0.5 text-slate-500 hover:bg-slate-200"
                          aria-label={`Remove ${stop}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Key Highlights (Tag Input) */}
              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Key Tour Highlights
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
                        addTagItem('highlights', 'highlightInput');
                      }
                    }}
                    placeholder="e.g., Climb UNESCO Sigiriya Lion Rock Fortress (press Enter or Add)"
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => addTagItem('highlights', 'highlightInput')}
                    className="rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-600"
                  >
                    + Add Highlight
                  </button>
                </div>
                {form.highlights.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {form.highlights.map((item, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-900"
                      >
                        ✓ {item}
                        <button
                          type="button"
                          onClick={() => removeTagItem('highlights', idx)}
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

              {/* What's Included (Tag Input) */}
              <div>
                <label className="block text-xs font-bold text-slate-700">
                  What&apos;s Included
                </label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    type="text"
                    value={form.includedInput}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, includedInput: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTagItem('included', 'includedInput');
                      }
                    }}
                    placeholder="e.g., Private A/C Vehicle, Fuel & Expressway Tolls"
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => addTagItem('included', 'includedInput')}
                    className="rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-600"
                  >
                    + Add Included
                  </button>
                </div>
                {form.included.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {form.included.map((item, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900"
                      >
                        ✓ {item}
                        <button
                          type="button"
                          onClick={() => removeTagItem('included', idx)}
                          className="rounded-full p-0.5 text-emerald-700 hover:bg-emerald-200"
                          aria-label={`Remove ${item}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Day-by-Day Itinerary Builder */}
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-blue-600" />
                      Day-by-Day Itinerary Builder ({form.itinerary.length} Days)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Add each day&apos;s title, route, and description for the Tour Details modal.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addItineraryDay}
                    className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-blue-700"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Day
                  </button>
                </div>

                {form.itinerary.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-xs text-slate-500">
                    No itinerary days added yet. Click &ldquo;+ Add Day&rdquo; to build the daily schedule.
                  </p>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {form.itinerary.map((dayItem, index) => (
                      <div
                        key={index}
                        className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center rounded-lg bg-blue-600 px-2.5 py-0.5 text-[11px] font-black text-white">
                            Day {dayItem.day}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeItineraryDay(index)}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="h-3 w-3" /> Remove Day
                          </button>
                        </div>

                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600">
                              Day Title
                            </label>
                            <input
                              type="text"
                              value={dayItem.title}
                              onChange={(e) =>
                                updateItineraryDay(index, { title: e.target.value })
                              }
                              placeholder="e.g., Sigiriya Lion Rock & Village Safari"
                              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600">
                              Route (Optional)
                            </label>
                            <input
                              type="text"
                              value={dayItem.route ?? ''}
                              onChange={(e) =>
                                updateItineraryDay(index, { route: e.target.value })
                              }
                              placeholder="e.g., Sigiriya → Matale → Kandy"
                              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600">
                            Day Description
                          </label>
                          <textarea
                            rows={2}
                            value={dayItem.description}
                            onChange={(e) =>
                              updateItineraryDay(index, { description: e.target.value })
                            }
                            placeholder="Describe the day's activities and stops..."
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
                      Include in the Home Page Featured Tours section
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
                      : 'Create Tour Package'}
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
          aria-labelledby="delete-package-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
              <Trash2 className="h-6 w-6" />
            </div>
            <h2 id="delete-package-title" className="mt-4 text-lg font-black text-slate-950">
              Delete &ldquo;{deleteTarget.title}&rdquo;?
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              This will permanently remove <b>{deleteTarget.title}</b> from both the Home Page and the public Tours catalog. If you only want to hide it temporarily, use the <b>Published / Hidden</b> toggle instead.
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
                {busyId === deleteTarget.id ? 'Deleting…' : 'Yes, Delete Package'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
