"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import ToursNavbar from "../tours/components/ToursNavbar";
import Footer from "../components/Footer";
import ScrollReveal from "../components/ScrollReveal";
import {
  ACTIVITY_CATEGORIES,
  type ActivityRecord,
  FALLBACK_ACTIVITIES,
  isOptimizableImageUrl,
  normalizeActivity,
  whatsappActivityLink,
} from "@/lib/gallery-activities";

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<ActivityRecord[]>(FALLBACK_ACTIVITIES);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedActivity, setSelectedActivity] = useState<ActivityRecord | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadActivities() {
      try {
        const response = await fetch("/api/activities", { cache: "no-store" });
        const result = (await response.json()) as {
          success?: boolean;
          data?: ActivityRecord[];
        };
        if (!cancelled && response.ok && result.success && Array.isArray(result.data) && result.data.length > 0) {
          setActivities(result.data.map(normalizeActivity));
        }
      } catch {
        // Keep graceful static fallback if database query fails
      }
    }
    void loadActivities();
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(() => {
    const present = new Set<string>(activities.map((a) => a.category).filter(Boolean));
    const ordered = ACTIVITY_CATEGORIES.filter((c) => present.has(c));
    const extras = Array.from(present).filter(
      (c) => !(ACTIVITY_CATEGORIES as readonly string[]).includes(c),
    );
    return ["All", ...ordered, ...extras];
  }, [activities]);

  const visibleActivities = useMemo(() => {
    if (selectedCategory === "All") return activities;
    return activities.filter((a) => a.category === selectedCategory);
  }, [activities, selectedCategory]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <ToursNavbar activePage="Activities" />

      {/* HERO BANNER */}
      <section className="relative flex min-h-[50vh] items-center justify-center overflow-hidden pt-28 pb-16">
        <div className="absolute inset-0 bg-[url('/images/activiyhedder.jpg')] bg-cover bg-center animate-hero-bg" />
        <div className="absolute inset-0 bg-slate-900/65" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-slate-900/40 to-blue-900/20" />

        <div className="relative z-10 mx-auto max-w-4xl px-4 text-center">
          <span className="inline-block rounded-full border border-white/30 bg-white/20 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white backdrop-blur-md shadow-md animate-hero-badge">
            Unforgettable Experiences
          </span>

          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-white sm:text-6xl animate-hero-title">
            Things to Do in <br />
            <span className="text-blue-200">Sri Lanka</span>
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-base sm:text-lg text-slate-100 animate-hero-subtitle">
            From wildlife safaris and mountain hikes to cultural village tours and whale watching across the island.
          </p>
        </div>
      </section>

      {/* ACTIVITIES GRID */}
      <section className="px-4 py-16 sm:px-6 lg:px-8 max-w-[1400px] mx-auto">
        <ScrollReveal variant="fade-up" className="text-center max-w-2xl mx-auto mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-600">
            Curated Adventures
          </p>
          <h2 className="mt-2 text-3xl font-extrabold text-slate-900 sm:text-4xl">
            Explore Popular Activities
          </h2>
          <p className="mt-3 text-slate-600 text-sm">
            Click on any activity card to view full details and inquire via WhatsApp.
          </p>
        </ScrollReveal>

        {/* Category Filter Pills */}
        <div className="mb-10 flex flex-wrap items-center justify-center gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                selectedCategory === cat
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                  : "border border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* 4 Cards per row on desktop */}
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {visibleActivities.map((act, idx) => (
            <ScrollReveal key={act.id || act.slug} variant="fade-up" delay={(idx % 4) * 70} className="h-full">
              <article
                role="button"
                tabIndex={0}
                aria-label={`View details for ${act.title}`}
                onClick={() => setSelectedActivity(act)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedActivity(act);
                  }
                }}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md shadow-slate-200/40 transition duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:border-blue-300 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
              <div className="relative aspect-[16/11] overflow-hidden bg-slate-100">
                <Image
                  src={act.image_url}
                  alt={act.image_alt || act.title}
                  fill
                  unoptimized={!isOptimizableImageUrl(act.image_url)}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="object-cover transition duration-500 group-hover:scale-105"
                />
                <span className="absolute top-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-slate-800 shadow-sm backdrop-blur-md">
                  {act.category}
                </span>
                {act.duration && (
                  <span className="absolute bottom-3 left-3 rounded-full bg-slate-950/80 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
                    ⏱️ {act.duration}
                  </span>
                )}
              </div>

              <div className="flex flex-1 flex-col p-4 sm:p-5">
                <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition leading-snug">
                  {act.title}
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed line-clamp-3">
                  {act.description}
                </p>
              </div>
              </article>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* Activity Details Popup Modal */}
      {selectedActivity && (
        <div
          onClick={() => setSelectedActivity(null)}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200"
          >
            <button
              type="button"
              aria-label="Close modal"
              onClick={() => setSelectedActivity(null)}
              className="absolute top-4 right-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-slate-900/70 text-lg text-white shadow-md transition hover:bg-red-600"
            >
              ✕
            </button>

            <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
              <Image
                src={selectedActivity.image_url}
                alt={selectedActivity.image_alt || selectedActivity.title}
                fill
                unoptimized={!isOptimizableImageUrl(selectedActivity.image_url)}
                sizes="(max-width: 640px) 100vw, 600px"
                className="object-cover"
              />
              <span className="absolute top-4 left-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-slate-800 shadow backdrop-blur-md">
                {selectedActivity.category}
              </span>
              {selectedActivity.duration && (
                <span className="absolute bottom-4 left-4 rounded-full bg-slate-950/80 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
                  ⏱️ {selectedActivity.duration}
                </span>
              )}
            </div>

            <div className="p-6 sm:p-8">
              <h3 className="text-2xl font-bold text-slate-900">
                {selectedActivity.title}
              </h3>

              {(selectedActivity.location ||
                selectedActivity.price_usd !== null ||
                selectedActivity.price_lkr !== null) && (
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {selectedActivity.location && (
                    <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                      📍 {selectedActivity.location}
                    </span>
                  )}
                  {selectedActivity.price_usd !== null && (
                    <span className="rounded-full bg-blue-50 px-3 py-1 font-bold text-blue-700">
                      From ${selectedActivity.price_usd} USD
                    </span>
                  )}
                  {selectedActivity.price_lkr !== null && (
                    <span className="rounded-full bg-blue-50 px-3 py-1 font-bold text-blue-700">
                      LKR {selectedActivity.price_lkr.toLocaleString()}
                    </span>
                  )}
                </div>
              )}

              <p className="mt-4 text-sm sm:text-base text-slate-600 leading-relaxed">
                {selectedActivity.description}
              </p>

              {selectedActivity.highlights && selectedActivity.highlights.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-2">
                  {selectedActivity.highlights.map((item, idx) => (
                    <li
                      key={idx}
                      className="rounded-full border border-blue-100 bg-blue-50/70 px-3 py-1 text-xs font-semibold text-blue-900"
                    >
                      ✓ {item}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-8">
                <a
                  href={whatsappActivityLink(selectedActivity.title)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center rounded-2xl bg-green-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-green-600/30 transition hover:bg-green-700"
                >
                  Inquire →
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating WhatsApp Quick Action Button */}
      <a
        href="https://wa.me/94711114901?text=Hello%20Chama%20Travels%2C%20I%20am%20browsing%20your%20tours%20page%20and%20would%20like%20to%20inquire."
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Direct WhatsApp message to Chama Travels"
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 rounded-full border border-white/30 bg-[#25D366] px-4 py-3 text-xs font-bold text-white shadow-xl shadow-green-950/20 backdrop-blur-md transition duration-300 hover:scale-105 hover:bg-[#20bd5a] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-green-400 sm:text-sm"
      >
        <svg
          className="h-5 w-5 fill-current"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2M12.05 3.67c2.2 0 4.26.86 5.82 2.42a8.21 8.21 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23-1.48 0-2.93-.39-4.19-1.15l-.3-.17-3.12.82.83-3.04-.2-.32a8.19 8.19 0 0 1-1.26-4.38c.01-4.54 3.7-8.24 8.25-8.24m-3.52 3.66c-.16 0-.43.06-.66.31-.22.25-.87.86-.87 2.07 0 1.22.89 2.39 1 2.56.14.17 1.76 2.67 4.25 3.73.59.27 1.05.42 1.41.53.59.19 1.13.16 1.56.1.48-.07 1.46-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.07-.1-.23-.16-.48-.29s-1.47-.72-1.69-.8c-.23-.08-.37-.12-.56.12-.16.25-.64.81-.78.97-.15.17-.29.19-.53.07-.26-.13-1.06-.39-2.02-1.23-.74-.66-1.23-1.47-1.38-1.72-.12-.24-.01-.37.11-.48.11-.11.25-.29.37-.44.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.43s-.52-1.24-.73-1.73c-.2-.48-.4-.42-.56-.43-.14 0-.3-.01-.47-.01Z" />
        </svg>
        <span className="hidden sm:inline">WhatsApp Inquiries</span>
        <span className="sm:hidden">Chat</span>
      </a>
      <Footer />
    </main>
  );
}
