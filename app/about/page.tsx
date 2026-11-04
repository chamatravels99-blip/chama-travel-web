"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import ToursNavbar from "../tours/components/ToursNavbar";
import Footer from "../components/Footer";

const whatsappNumber = "94711114901";

// Gallery images with varying aspect ratios for Masonry layout
const galleryImages = [
    "/images/2024_03_30_11_21_19_IMG_1200.jpg",
    "/images/2024_07_26_21_27_56_47FA4CFD-FCDD-4AC3-94BF-AC5FD4CE820F.jpg",
    "/images/2024_03_30_11_21_19_IMG_1200.jpg",
    "/images/2026_02_27_10_52_34_IMG_5805.jpg",
    "/images/2025_10_01_10_59_58_IMG_2604(1).jpg",
    "/images/2025_07_23_06_19_23_IMG_0757.jpg",
    "/images/2024_12_18_10_08_44_IMG_4962.jpg",
    "/images/2024_11_28_09_44_28_IMG_4455.jpg",
    "/images/WhatsApp Image 2024-12-29 at 13.05.48_c650a197.jpg",
    "/images/WhatsApp Image 2024-12-29 at 13.05.37_9e691c01.jpg",
    "/images/WhatsApp Image 2024-12-29 at 13.03.27_9da2629c.jpg",
    "/images/WhatsApp Image 2024-12-29 at 13.02.42_b9b4dbaa.jpg",
];

// Customer Reviews Data
const customerReviews = [
  {
    author: "Sonia",
    location: "Germany",
    title: "Friendly and trustworthy driver",
    text: "I would highly recommend Chamod if you are looking for a driver for your holiday in Sri Lanka. The best place to travel with a friendly and trustworthy person like a friend. We really enjoyed our trip around Sri Lanka.",
    url: "https://www.tripadvisor.com/ShowUserReviews-g293962-d32748314-r1031218407-Chama_Travel_Tours-Colombo_Western_Province.html",
  },
  {
    author: "Gill & Family",
    location: "United Kingdom",
    title: "Fantastic Sri Lankan experience",
    text: "Our experience with Chamod was first class. An excellent driver, always felt safe. Chamod was a kind, helpful, and thoughtful man who was always prepared to go the extra mile. The tour was superb.",
    url: "https://www.tripadvisor.com/ShowUserReviews-g293962-d32748314-r1034474433-Chama_Travel_Tours-Colombo_Western_Province.html",
  },
  {
    author: "Andrew",
    location: "United Kingdom",
    title: "Superb trip and highly organized",
    text: "Simply a great caring and attentive guy. Just what you need in Sri Lanka. Would highly recommend. We had a full planned day, everyday. He knows all the best spots and booked everything ahead.",
    url: "https://www.tripadvisor.com/ShowUserReviews-g293962-d32748314-r1034457788-Chama_Travel_Tours-Colombo_Western_Province.html",
  },
  {
    author: "Nick",
    location: "Leeds, UK",
    title: "Warm welcome & amazing memories",
    text: "Choosing Chamod was one of the best decisions we made during our entire journey. After a long flight, he welcomed us at the airport with such warmth and positivity.",
    url: "https://www.tripadvisor.com/ShowUserReviews-g293962-d32748314-r1067946228-Chama_Travel_Tours-Colombo_Western_Province.html",
  },
];

export default function AboutPage() {
  // Lightbox Modal State
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const openLightbox = (index: number) => setSelectedIndex(index);
  const closeLightbox = () => setSelectedIndex(null);

  const showNext = () => {
    if (selectedIndex !== null) {
      setSelectedIndex((selectedIndex + 1) % galleryImages.length);
    }
  };

  const showPrev = () => {
    if (selectedIndex !== null) {
      setSelectedIndex((selectedIndex - 1 + galleryImages.length) % galleryImages.length);
    }
  };

  // Keyboard Navigation Support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedIndex === null) return;
      if (e.key === "Escape") setSelectedIndex(null);
      if (e.key === "ArrowRight") {
        setSelectedIndex((prev) => (prev === null ? null : (prev + 1) % galleryImages.length));
      }
      if (e.key === "ArrowLeft") {
        setSelectedIndex((prev) => (prev === null ? null : (prev - 1 + galleryImages.length) % galleryImages.length));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIndex]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <ToursNavbar activePage="About Us" />

      {/* HERO BANNER */}
      <section className="relative flex min-h-[50vh] items-center justify-center overflow-hidden pt-28 pb-16">
        <div className="absolute inset-0 bg-[url('/images/places_to_visit.jpg')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-slate-900/70" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-slate-900/40 to-blue-900/20" />

        <div className="relative z-10 mx-auto max-w-4xl px-4 text-center">
          <span className="inline-block rounded-full border border-white/30 bg-white/20 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white backdrop-blur-md shadow-md">
            SLTDA Certified Private Chauffeur
          </span>

          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
            About <br />
            <span className="text-blue-200">Chama Travel & Tours</span>
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-base sm:text-lg text-slate-100">
            Your trusted friend and expert private driver-guide for a safe, comfortable, and unforgettable holiday across Sri Lanka.
          </p>
        </div>
      </section>

      {/* ABOUT CONTENT */}
      <section className="px-6 py-20 lg:px-8 max-w-7xl mx-auto">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          
          <div className="lg:col-span-6 space-y-6">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-600">
              Welcome to Our Story
            </p>
            <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
              Travel Sri Lanka with Comfort, Safety & True Local Hospitality
            </h2>
            <p className="text-slate-600 text-base leading-relaxed">
              Operated by Chamod Nuwantha, <strong>Chama Travel & Tours</strong> is a premier private chauffeur and islandwide tour service based in Gampaha / Colombo, Sri Lanka. Fully certified by the Sri Lanka Tourism Development Authority (SLTDA), we specialize in customized round tours, airport transfers, and reliable vehicle rentals.
            </p>
            <p className="text-slate-600 text-base leading-relaxed">
              Our guests from Germany, the United Kingdom, and around the world consistently rate us 5-stars on TripAdvisor for our warm airport welcomes, deep local knowledge, flexibility, and unwavering commitment to safety on the road.
            </p>

            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-3xl font-black text-blue-600">5.0 ★</p>
                <p className="text-xs font-bold text-slate-700 mt-1">TripAdvisor Rated</p>
                <p className="text-[11px] text-slate-500">100% Recommended by travelers</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-3xl font-black text-emerald-600">SLTDA</p>
                <p className="text-xs font-bold text-slate-700 mt-1">Certified Guide</p>
                <p className="text-[11px] text-slate-500">Official Tourist Driver ID</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-slate-200 shadow-2xl bg-slate-100">
              <Image
                src="/images/WhatsApp Image 2024-12-29 at 13.03.27_9da2629c.jpg"
                alt="Sri Lanka scenic tour travel"
                fill
                className="object-cover"
              />
            </div>
          </div>

        </div>
      </section>

      {/* MASONRY PHOTO GALLERY (NO LABELS) */}
      <section className="bg-slate-100 px-6 py-20 lg:px-8 border-t border-b border-slate-200">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-600">
              Captures from Our Trips
            </p>
            <h2 className="mt-2 text-3xl font-extrabold text-slate-900 sm:text-4xl">
              Tour Photo Gallery
            </h2>
            <p className="mt-2 text-slate-500 text-xs sm:text-sm">
              Click any photo to expand and slide through our travel moments.
            </p>
          </div>

          {/* Masonry Layout: columns-1 sm:columns-2 lg:columns-3 */}
          <div className="columns-1 gap-1 sm:columns-2 lg:columns-3 space-y-1">
            {galleryImages.map((src, idx) => (
              <div
                key={idx}
                role="button"
                tabIndex={0}
                aria-label={`View tour moment ${idx + 1}`}
                onClick={() => openLightbox(idx)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openLightbox(idx);
                  }
                }}
                className="break-inside-avoid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md cursor-pointer group transition-all duration-300 hover:shadow-xl hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <Image
                  src={src}
                  alt={`Chama Travels tour moment ${idx + 1}`}
                  width={600}
                  height={450}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="w-full h-auto object-cover transition duration-500 group-hover:brightness-105"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </div>
        <div className="mt-10 flex justify-center">
            <a
              href="/gallery"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-blue-200 bg-white px-6 py-2.5 text-sm font-bold text-blue-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              More Photos →
            </a>
          </div>
      </section>

      {/* LIGHTBOX SLIDER MODAL */}
      {selectedIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
          {/* Close Button */}
          <button
            type="button"
            onClick={closeLightbox}
            className="absolute top-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-2xl text-white transition hover:bg-white/20 hover:scale-110 focus:outline-none"
            aria-label="Close modal"
          >
            ✕
          </button>

          {/* Left Arrow Button */}
          <button
            type="button"
            onClick={showPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-white/15 text-3xl text-white shadow-xl backdrop-blur-md transition hover:bg-white/30 hover:scale-110 focus:outline-none"
            aria-label="Previous photo"
          >
            ‹
          </button>

          {/* Image Container */}
          <div className="relative max-h-[85vh] max-w-[90vw] overflow-hidden rounded-2xl shadow-2xl">
            <Image
              src={galleryImages[selectedIndex]}
              alt={`Expanded view ${selectedIndex + 1}`}
              width={1200}
              height={900}
              className="max-h-[85vh] max-w-[90vw] object-contain rounded-2xl transition duration-300"
            />
          </div>

          {/* Right Arrow Button */}
          <button
            type="button"
            onClick={showNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-white/15 text-3xl text-white shadow-xl backdrop-blur-md transition hover:bg-white/30 hover:scale-110 focus:outline-none"
            aria-label="Next photo"
          >
            ›
          </button>

          {/* Counter Indicator */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
            {selectedIndex + 1} / {galleryImages.length}
          </div>
          
        </div>
        
      )}

      {/* REVIEWS & TESTIMONIALS SECTION */}
      <section className="bg-slate-900 px-6 py-20 text-white lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-400">
              Verified Feedback
            </p>
            <h2 className="mt-2 text-3xl font-extrabold sm:text-4xl">
              What Guests Say About Chama Travels
            </h2>
            <p className="mt-3 text-zinc-400 text-sm">
              Read authentic reviews left by foreign travelers on our official TripAdvisor page.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {customerReviews.map((rev, index) => (
              <div
                key={index}
                className="flex flex-col justify-between rounded-3xl border border-white/10 bg-slate-950/80 p-6 shadow-xl backdrop-blur-md"
              >
                <div>
                  <div className="text-amber-400 text-sm mb-3">★★★★★</div>
                  <h3 className="font-bold text-base text-white">&ldquo;{rev.title}&rdquo;</h3>
                  <p className="mt-3 text-xs text-zinc-300 leading-relaxed italic">
                    &ldquo;{rev.text}&rdquo;
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-white">{rev.author}</p>
                    <p className="text-[10px] text-zinc-400">{rev.location}</p>
                  </div>
                  <a
                    href={rev.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-semibold text-blue-400 hover:underline"
                  >
                    TripAdvisor
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY CHOOSE US */}
      <section className="bg-slate-950 px-6 py-20 text-white lg:px-8 border-t border-white/10">
        <div className="mx-auto max-w-7xl">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-400">
              Our Core Values
            </p>
            <h2 className="mt-2 text-3xl font-extrabold sm:text-4xl">
              Why Travelers Choose Chama Travels
            </h2>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-xl backdrop-blur-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white text-xl font-bold mb-6">
                🛡️
              </div>
              <h3 className="text-xl font-bold text-white">Safety & Reliability</h3>
              <p className="mt-3 text-sm text-zinc-300 leading-relaxed">
                Fully insured, air-conditioned modern vehicles maintained to the highest standards with an experienced, cautious driver.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-xl backdrop-blur-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white text-xl font-bold mb-6">
                🤝
              </div>
              <h3 className="text-xl font-bold text-white">Friendly Personal Service</h3>
              <p className="mt-3 text-sm text-zinc-300 leading-relaxed">
                Travel like with a trusted friend. We go the extra mile to ensure your family or couple trip is comfortable and memorable.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-xl backdrop-blur-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-600 text-white text-xl font-bold mb-6">
                🗺️
              </div>
              <h3 className="text-xl font-bold text-white">Flexible Custom Itineraries</h3>
              <p className="mt-3 text-sm text-zinc-300 leading-relaxed">
                No rigid schedules. We tailor every day according to your pace, preferences, and hidden gem discoveries across the island.
              </p>
            </div>
          </div>

          <div className="mt-12 text-center">
            <a
              href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Hello Chama Travels, I would like to discuss a custom trip in Sri Lanka.")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full bg-blue-600 px-8 py-4 font-bold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-500"
            >
              Plan Your Trip via WhatsApp →
            </a>
          </div>
        </div>
      </section>
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