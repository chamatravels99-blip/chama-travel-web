'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Compass, ExternalLink, Image as ImageIcon, RefreshCw } from 'lucide-react';
import {
  type ActivityRecord,
  type GalleryPhotoRecord,
  normalizeActivity,
  normalizeGalleryPhoto,
} from '@/lib/gallery-activities';
import ActivitiesManager from './components/ActivitiesManager';
import GalleryManager from './components/GalleryManager';
import { Alerts, type ApiResult } from './components/shared';

type ActiveTab = 'gallery' | 'activities';

export default function AdminGalleryActivitiesPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('gallery');
  const [photos, setPhotos] = useState<GalleryPhotoRecord[]>([]);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [galleryRes, activitiesRes] = await Promise.all([
        fetch('/api/admin/gallery', { cache: 'no-store' }),
        fetch('/api/admin/activities', { cache: 'no-store' }),
      ]);

      const galleryJson = (await galleryRes.json()) as ApiResult<GalleryPhotoRecord[]>;
      const activitiesJson = (await activitiesRes.json()) as ApiResult<ActivityRecord[]>;

      if (!galleryRes.ok || !galleryJson.success || !Array.isArray(galleryJson.data)) {
        throw new Error(galleryJson.error || 'Gallery photos could not be loaded.');
      }
      if (!activitiesRes.ok || !activitiesJson.success || !Array.isArray(activitiesJson.data)) {
        throw new Error(activitiesJson.error || 'Activities could not be loaded.');
      }

      setPhotos(galleryJson.data.map(normalizeGalleryPhoto));
      setActivities(activitiesJson.data.map(normalizeActivity));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Content could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadAll);
  }, [loadAll]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
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
                <ImageIcon className="h-3.5 w-3.5" /> Website Content Manager
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              Gallery &amp; Activities Management
            </h1>
            <p className="mt-1.5 text-sm text-slate-600">
              Manage the Home Page photo mosaic, <code className="text-xs font-semibold">/gallery</code> collection, Home Page &ldquo;Things to Do&rdquo; carousel, and <code className="text-xs font-semibold">/activities</code> experiences.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href={activeTab === 'gallery' ? '/gallery' : '/activities'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50"
            >
              <ExternalLink className="h-4 w-4 text-blue-600" />
              {activeTab === 'gallery' ? 'View /gallery' : 'View /activities'}
            </Link>
            <button
              type="button"
              onClick={() => void loadAll()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </header>

        {/* SUB-NAVIGATION TABS */}
        <nav aria-label="Content sections" className="flex flex-wrap gap-2 rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-xs sm:inline-flex">
          <button
            type="button"
            onClick={() => {
              setActiveTab('gallery');
              setError('');
              setNotice('');
            }}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
              activeTab === 'gallery'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <ImageIcon className="h-4 w-4" />
            Photo Gallery
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                activeTab === 'gallery' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {photos.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('activities');
              setError('');
              setNotice('');
            }}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
              activeTab === 'activities'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Compass className="h-4 w-4" />
            Activities &amp; Experiences
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                activeTab === 'activities' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {activities.length}
            </span>
          </button>
        </nav>

        <Alerts
          error={error}
          notice={notice}
          onClearError={() => setError('')}
          onClearNotice={() => setNotice('')}
        />

        {activeTab === 'gallery' ? (
          <GalleryManager
            photos={photos}
            loading={loading}
            onReload={loadAll}
            onNotice={setNotice}
            onError={setError}
            onSetPhotos={setPhotos}
          />
        ) : (
          <ActivitiesManager
            activities={activities}
            loading={loading}
            onReload={loadAll}
            onNotice={setNotice}
            onError={setError}
            onSetActivities={setActivities}
          />
        )}
      </main>
    </div>
  );
}
