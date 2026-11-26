"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import ScrollReveal from "../components/ScrollReveal";
import {
  FALLBACK_GALLERY_PHOTOS,
  GALLERY_CATEGORIES,
  type GalleryPhotoRecord,
  isOptimizableImageUrl,
  normalizeGalleryPhoto,
} from "@/lib/gallery-activities";

export default function GalleryPage() {
  const [photos, setPhotos] = useState<GalleryPhotoRecord[]>(FALLBACK_GALLERY_PHOTOS);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [activeGalleryIndex, setActiveGalleryIndex] = useState<number | null>(null);
  const galleryIsOpen = activeGalleryIndex !== null;

  useEffect(() => {
    let cancelled = false;
    async function loadGallery() {
      try {
        const response = await fetch("/api/gallery", { cache: "no-store" });
        const result = (await response.json()) as {
          success?: boolean;
          data?: GalleryPhotoRecord[];
        };
        if (!cancelled && response.ok && result.success && Array.isArray(result.data) && result.data.length > 0) {
          setPhotos(result.data.map(normalizeGalleryPhoto));
        }
      } catch {
        // Keep graceful static fallback if database query fails
      }
    }
    void loadGallery();
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(() => {
    const present = new Set<string>(photos.map((p) => p.category).filter(Boolean));
    const ordered = GALLERY_CATEGORIES.filter((c) => present.has(c));
    const extras = Array.from(present).filter(
      (c) => !(GALLERY_CATEGORIES as readonly string[]).includes(c),
    );
    return ["All", ...ordered, ...extras];
  }, [photos]);

  const visiblePhotos = useMemo(() => {
    if (selectedCategory === "All") return photos;
    return photos.filter((p) => p.category === selectedCategory);
  }, [photos, selectedCategory]);

  useEffect(() => {
    if (!galleryIsOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveGalleryIndex(null);
      } else if (event.key === "ArrowLeft") {
        setActiveGalleryIndex((idx) => (idx === null ? null : Math.max(0, idx - 1)));
      } else if (event.key === "ArrowRight") {
        setActiveGalleryIndex((idx) =>
          idx === null ? null : Math.min(visiblePhotos.length - 1, idx + 1),
        );
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [galleryIsOpen, visiblePhotos.length]);

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col justify-between py-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl w-full pt-12">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-700 animate-hero-badge">
            CHAMA TRAVELS GALLERY
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl animate-hero-title">
            Photo Collection
          </h1>
          <p className="mt-4 text-base leading-7 text-zinc-600 sm:text-lg animate-hero-subtitle">
            Explore our collection of memories, breathtaking landscapes, and unforgettable journeys across Sri Lanka.
          </p>
        </div>

        {/* Category Filter Pills */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setSelectedCategory(cat);
                setActiveGalleryIndex(null);
              }}
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

        {/* Photos Grid */}
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visiblePhotos.map((photo, index) => (
            <ScrollReveal
              key={photo.id || `${photo.image_url}-${index}`}
              variant="zoom-in"
              delay={(index % 3) * 80}
            >
              <div
                role="button"
                tabIndex={0}
                aria-label={`View photo ${index + 1}: ${photo.alt_text}`}
                onClick={() => setActiveGalleryIndex(index)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setActiveGalleryIndex(index);
                  }
                }}
                className="group relative overflow-hidden rounded-2xl bg-white shadow-md transition duration-300 hover:-translate-y-1 hover:shadow-xl cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <div className="h-72 w-full overflow-hidden">
                  <Image
                    src={photo.image_url}
                    alt={photo.alt_text}
                    width={800}
                    height={600}
                    unoptimized={!isOptimizableImageUrl(photo.image_url)}
                    priority={index === 0}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                </div>
                {photo.title && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/75 via-slate-950/25 to-transparent px-4 py-3 opacity-0 transition duration-300 group-hover:opacity-100">
                    <p className="text-sm font-bold text-white">{photo.title}</p>
                  </div>
                )}
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>

      {/* Back to Home Button */}
      <div className="mt-16 mb-8 text-center w-full">
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-full bg-blue-600 px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-700 hover:scale-105"
        >
          ← Back to Home
        </Link>
      </div>

      {/* Lightbox Modal */}
      {galleryIsOpen && activeGalleryIndex !== null && visiblePhotos[activeGalleryIndex] && (
        <div
          onClick={() => setActiveGalleryIndex(null)}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="relative flex max-h-[90vh] max-w-[94vw] items-center justify-center"
          >
            <button
              type="button"
              aria-label="Close image preview"
              onClick={() => setActiveGalleryIndex(null)}
              className="absolute -right-3 -top-3 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-xl text-white shadow-lg transition hover:bg-red-600"
            >
              ✕
            </button>

            <button
              type="button"
              aria-label="Previous image"
              onClick={() =>
                setActiveGalleryIndex((index) =>
                  index === null ? null : Math.max(0, index - 1),
                )
              }
              disabled={activeGalleryIndex === 0}
              className="absolute left-2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-slate-900/80 text-xl text-white shadow transition hover:bg-slate-800 disabled:opacity-30"
            >
              ‹
            </button>

            <Image
              src={visiblePhotos[activeGalleryIndex].image_url}
              alt={visiblePhotos[activeGalleryIndex].alt_text}
              width={1200}
              height={900}
              unoptimized={!isOptimizableImageUrl(visiblePhotos[activeGalleryIndex].image_url)}
              className="h-auto max-h-[82vh] w-auto max-w-[90vw] rounded-lg object-contain shadow-2xl"
            />

            <button
              type="button"
              aria-label="Next image"
              onClick={() =>
                setActiveGalleryIndex((index) =>
                  index === null
                    ? null
                    : Math.min(visiblePhotos.length - 1, index + 1),
                )
              }
              disabled={activeGalleryIndex === visiblePhotos.length - 1}
              className="absolute right-2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-slate-900/80 text-xl text-white shadow transition hover:bg-slate-800 disabled:opacity-30"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
