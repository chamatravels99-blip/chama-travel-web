"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

// 📸 සියලුම ඡායාරූප ලැයිස්තුව (මෙම පිටුවට අවශ්‍ය වැඩිපුර photos ද මෙහි එකතු කළ හැක)
const allGalleryPhotos = [
  { src: "/images/1307254.jpg", alt: "Chama Travels Journey 1" },
  { src: "/images/beach.jpg", alt: "Sri Lanka Beach Tour" },
  { src: "/images/2024_03_30_11_21_19_IMG_1200.jpg", alt: "Chama Travels Tour" },
  { src: "/images/2024_07_26_21_27_56_47FA4CFD-FCDD-4AC3-94BF-AC5FD4CE820F.jpg", alt: "Chama Travels Tour" },
  { src: "/images/2024_10_12_15_22_52_IMG_3436.jpg", alt: "Chama Travels Tour" },
  { src: "/images/2024_11_06_10_35_25_IMG_3959.jpg", alt: "Chama Travels Tour" },
  { src: "/images/2024_11_07_00_48_21_IMG_4030.jpg", alt: "Chama Travels Tour" },
  { src: "/images/2024_11_28_09_44_28_IMG_4455.jpg", alt: "Chama Travels Tour" },
  { src: "/images/2024_11_30_06_50_30_IMG_4470.jpg", alt: "Chama Travels Tour" },
  { src: "/images/2024_12_18_10_08_44_IMG_4962.jpg", alt: "Chama Travels Tour" },
  { src: "/images/2025_05_27_10_49_29_IMG_9935.jpg", alt: "Chama Travels Tour" },
  { src: "/images/2025_07_23_06_19_23_IMG_0757.jpg", alt: "Chama Travels Tour" },
  { src: "/images/2025_09_06_13_09_56_IMG_2081.jpg", alt: "Chama Travels Tour" },
  { src: "/images/2025_10_01_10_59_58_IMG_2604(1).jpg", alt: "Chama Travels Tour" },
  { src: "/images/2025_10_10_12_45_43_IMG_2800.jpg", alt: "Chama Travels Tour" },
  { src: "/images/2025_10_11_08_51_11_IMG_2829.jpg", alt: "Chama Travels Tour" },
  { src: "/images/2026_01_11_18_33_10_IMG_5149.jpg", alt: "Chama Travels Tour" },
  { src: "/images/2026_02_27_10_52_34_IMG_5805.jpg", alt: "Chama Travels Tour" },
  { src: "/images/2026_03_05_17_43_47_IMG_5910.jpg", alt: "Chama Travels Tour" },
  { src: "/images/1307254.jpg", alt: "Chama Travels Tour" },
  { src: "/images/aboutimage.jpg", alt: "About Chama Travels" },
  { src: "/images/beach.jpg", alt: "Sri Lanka Beach Tour" },
  { src: "/images/WhatsApp Image 2024-12-29 at 13.02.42_b9b4dbaa.jpg", alt: "Chama Travels Tour" },
  { src: "/images/WhatsApp Image 2024-12-29 at 13.03.27_9da2629c.jpg", alt: "Chama Travels Tour" },
  { src: "/images/WhatsApp Image 2024-12-29 at 13.05.37_9e691c01.jpg", alt: "Chama Travels Tour" },
  { src: "/images/WhatsApp Image 2024-12-29 at 13.05.48_c650a197.jpg", alt: "Chama Travels Tour" },
  // අවශ්‍ය නම් තවත් photos මෙහි එකතු කරන්න:
  // { src: "/images/photo3.jpg", alt: "Description 3" },
];

export default function GalleryPage() {
  const [activeGalleryIndex, setActiveGalleryIndex] = useState<number | null>(null);
  const galleryIsOpen = activeGalleryIndex !== null;

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col justify-between py-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl w-full pt-12">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-700">
            CHAMA TRAVELS GALLERY
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">
            Photo Collection
          </h1>
          <p className="mt-4 text-base leading-7 text-zinc-600 sm:text-lg">
            Explore our collection of memories, breathtaking landscapes, and unforgettable journeys across Sri Lanka.
          </p>
        </div>

        {/* Photos Grid (Click කළ විට Popup විවෘත වේ) */}
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {allGalleryPhotos.map((photo, index) => (
            <div
              key={index}
              role="button"
              tabIndex={0}
              aria-label={`View photo ${index + 1}: ${photo.alt}`}
              onClick={() => setActiveGalleryIndex(index)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setActiveGalleryIndex(index);
                }
              }}
              className="group relative overflow-hidden rounded-2xl bg-white shadow-md transition hover:shadow-xl cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <div className="h-72 w-full overflow-hidden">
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  width={800}
                  height={600}
                  priority={index === 0}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 🔙 Back to Home Button (තිරයේ පහළම කොටසට නිසි ලෙස සකසා ඇත) */}
      <div className="mt-16 mb-8 text-center w-full">
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-full bg-blue-600 px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-700 hover:scale-105"
        >
          ← Back to Home
        </Link>
      </div>

      {/* 🔍 POPUP / LIGHTBOX MODAL */}
      {galleryIsOpen && activeGalleryIndex !== null && (
        <div
          onClick={() => setActiveGalleryIndex(null)}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="relative flex max-h-[90vh] max-w-[94vw] items-center justify-center"
          >
            {/* ❌ Close Button */}
            <button
              type="button"
              aria-label="Close image preview"
              onClick={() => setActiveGalleryIndex(null)}
              className="absolute -right-3 -top-3 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-xl text-white shadow-lg transition hover:bg-red-600"
            >
              ✕
            </button>

            {/* 👈 Previous Arrow */}
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

            {/* Popup Image */}
            <Image
              src={allGalleryPhotos[activeGalleryIndex].src}
              alt={allGalleryPhotos[activeGalleryIndex].alt}
              width={1200}
              height={900}
              className="h-auto max-h-[82vh] w-auto max-w-[90vw] rounded-lg object-contain shadow-2xl"
            />

            {/* 👉 Next Arrow */}
            <button
              type="button"
              aria-label="Next image"
              onClick={() =>
                setActiveGalleryIndex((index) =>
                  index === null
                    ? null
                    : Math.min(allGalleryPhotos.length - 1, index + 1),
                )
              }
              disabled={activeGalleryIndex === allGalleryPhotos.length - 1}
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