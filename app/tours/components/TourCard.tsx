"use client";

import Image from "next/image";
import { Tour } from "../types";

interface TourCardProps {
  tour: Tour;
  onOpenModal: (tour: Tour) => void;
}

const whatsappNumber = "94711114901";

export default function TourCard({ tour, onOpenModal }: TourCardProps) {
  const whatsappInquiryUrl = `https://wa.me/${whatsappNumber}?text=Hello%20Chama%20Travels%2C%20I%20am%20interested%20in%20the%20${encodeURIComponent(
    tour.title
  )}%20(${encodeURIComponent(
    tour.duration
  )}).%20Could%20you%20please%20provide%20more%20details%20and%20availability%3F`;

  return (
    <article
      tabIndex={0}
      role="button"
      aria-label={`View full itinerary for ${tour.title}`}
      onClick={() => onOpenModal(tour)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenModal(tour);
        }
      }}
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-blue-100/90 bg-white/95 text-left shadow-[0_12px_36px_rgba(15,23,42,0.07)] backdrop-blur-sm transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-blue-300 hover:shadow-[0_24px_50px_rgba(37,99,235,0.16)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
    >
      {/* Tour Image & Badges */}
      <div className="relative aspect-16/10 w-full overflow-hidden bg-slate-100">
        <Image
          src={tour.image}
          alt={tour.imageAlt}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover transition duration-700 ease-out group-hover:scale-105"
        />

        {/* Gradient Overlay on bottom of image */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-slate-950/15 to-transparent"
        />

        {/* Top Badges */}
        <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between gap-2">
          {/* Duration Badge */}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-3 py-1 text-xs font-bold text-white shadow-sm backdrop-blur-md">
            <svg
              className="h-3.5 w-3.5 text-blue-300"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {tour.duration}
          </span>

          {/* Special Badge (e.g. Popular, Bestseller) */}
          {tour.badge && (
            <span className="inline-flex items-center rounded-full bg-blue-600 px-3 py-1 text-xs font-extrabold tracking-wide text-white shadow-md shadow-blue-900/30">
              ★ {tour.badge}
            </span>
          )}
        </div>

        {/* Route Highlights overlay at bottom of image */}
        <div className="absolute bottom-3 left-3 right-3">
          <div className="flex flex-wrap items-center gap-1 text-[11px] font-semibold text-white/95">
            <span className="text-blue-300">Route:</span>
            {tour.routeHighlights.slice(0, 4).map((stop, i) => (
              <span key={stop} className="inline-flex items-center">
                {stop}
                {i < Math.min(3, tour.routeHighlights.length - 1) && (
                  <span className="mx-1 text-white/50">•</span>
                )}
              </span>
            ))}
            {tour.routeHighlights.length > 4 && (
              <span className="text-blue-200">+{tour.routeHighlights.length - 4} more</span>
            )}
          </div>
        </div>
      </div>

      {/* Card Body */}
      <div className="flex flex-1 flex-col p-6 sm:p-7">
        {/* Category Tag */}
        <p className="text-xs font-bold tracking-wider uppercase text-blue-600">
          {tour.category}
        </p>

        {/* Title */}
        <h3 className="mt-2 text-xl font-extrabold leading-snug text-zinc-900 transition group-hover:text-blue-600 sm:text-2xl">
          {tour.title}
        </h3>

        {/* Short Description */}
        <p className="mt-3 text-sm leading-relaxed text-zinc-600 line-clamp-2">
          {tour.shortDescription}
        </p>

        {/* Key Highlights with Checkmarks */}
        <div className="mt-5 border-t border-zinc-100 pt-4">
          <p className="text-xs font-bold tracking-wider uppercase text-zinc-400">
            Key Highlights
          </p>
          <ul className="mt-2.5 space-y-2">
            {tour.keyHighlights.slice(0, 3).map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 text-xs font-medium text-zinc-700"
              >
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">
                  ✓
                </span>
                <span className="line-clamp-1">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Pricing indicator */}
        <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-semibold text-zinc-500">
              Private Tour Rate:
            </span>
            <span className="text-xs font-bold text-blue-700">
              All Fuel & Driver Included
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xs font-medium text-zinc-500">Starting from</span>
            <span className="text-2xl font-black tracking-tight text-zinc-900">
              ${tour.startingPriceUSD}
            </span>
            <span className="text-xs font-bold text-zinc-500">
              USD {tour.pricingUnit}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">
            Comfort Sedan (up to 3 pax) • Larger vans available
          </p>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:items-center">
          {/* View Full Itinerary Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenModal(tour);
            }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-blue-600 px-4 py-3 text-xs font-bold text-white shadow-md shadow-blue-600/20 transition hover:bg-blue-500 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-400 sm:text-sm"
          >
            <span>View Full Itinerary</span>
            <span aria-hidden="true">→</span>
          </button>

          {/* Quick WhatsApp Inquiry Button */}
          <a
            href={whatsappInquiryUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            aria-label={`Quick WhatsApp inquiry for ${tour.title}`}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[#25D366]/40 bg-[#25D366]/10 px-4 py-3 text-xs font-bold text-[#128C7E] transition hover:bg-[#25D366] hover:text-white focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#25D366] sm:text-sm"
          >
            <svg
              className="h-4 w-4 shrink-0 fill-current"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2M12.05 3.67c2.2 0 4.26.86 5.82 2.42a8.21 8.21 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23-1.48 0-2.93-.39-4.19-1.15l-.3-.17-3.12.82.83-3.04-.2-.32a8.19 8.19 0 0 1-1.26-4.38c.01-4.54 3.7-8.24 8.25-8.24m-3.52 3.66c-.16 0-.43.06-.66.31-.22.25-.87.86-.87 2.07 0 1.22.89 2.39 1 2.56.14.17 1.76 2.67 4.25 3.73.59.27 1.05.42 1.41.53.59.19 1.13.16 1.56.1.48-.07 1.46-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.07-.1-.23-.16-.48-.29s-1.47-.72-1.69-.8c-.23-.08-.37-.12-.56.12-.16.25-.64.81-.78.97-.15.17-.29.19-.53.07-.26-.13-1.06-.39-2.02-1.23-.74-.66-1.23-1.47-1.38-1.72-.12-.24-.01-.37.11-.48.11-.11.25-.29.37-.44.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.43s-.52-1.24-.73-1.73c-.2-.48-.4-.42-.56-.43-.14 0-.3-.01-.47-.01Z" />
            </svg>
            <span>WhatsApp</span>
          </a>
        </div>
      </div>
    </article>
  );
}
