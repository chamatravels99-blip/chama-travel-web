"use client";

import Image from "next/image";
import { useState } from "react";
import { coreServicesData, whatsappNumber } from "../servicesData";
import { ServiceItem } from "../types";

interface CoreServicesProps {
  onSelectServiceForQuote: (serviceType: ServiceItem["serviceType"]) => void;
}

export default function CoreServices({ onSelectServiceForQuote }: CoreServicesProps) {
  const [selectedServiceId, setSelectedServiceId] = useState<string>(coreServicesData[0].id);

  const activeService =
    coreServicesData.find((s) => s.id === selectedServiceId) || coreServicesData[0];

  return (
    <section
      id="core-services"
      className="bg-slate-50 bg-[radial-gradient(ellipse_at_top,rgba(219,234,254,0.55),transparent_65%)] px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-600 sm:text-sm">
            What We Do
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-zinc-900 sm:text-4xl lg:text-5xl">
            Core Travel & Chauffeur Services
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 sm:text-base">
            Every journey with Chama Travels is tailored around comfort, reliability,
            and safety. Choose from private airport pickups, daily vehicle rentals,
            customized islandwide round tours, or exciting day excursions.
          </p>
        </div>

        {/* Interactive Service Filter Tabs */}
        <div className="mt-8 flex flex-wrap gap-2.5 border-b border-zinc-200/80 pb-4">
          {coreServicesData.map((service) => {
            const isSelected = service.id === selectedServiceId;
            return (
              <button
                key={service.id}
                type="button"
                onClick={() => setSelectedServiceId(service.id)}
                className={`cursor-pointer rounded-full px-4 py-2 text-xs font-bold transition sm:text-sm ${
                  isSelected
                    ? "bg-blue-600 text-white shadow-md shadow-blue-900/20"
                    : "border border-zinc-200 bg-white text-zinc-700 hover:border-blue-300 hover:text-blue-600"
                }`}
              >
                {service.title.split("(")[0].trim()}
              </button>
            );
          })}
        </div>

        {/* Active Featured Spotlight Banner */}
        <div className="mt-8 overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-xl shadow-blue-900/5">
          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Image Col */}
            <div className="relative min-h-[280px] lg:col-span-5 lg:min-h-full bg-zinc-900">
              <Image
                src={activeService.image}
                alt={activeService.imageAlt}
                fill
                sizes="(max-width: 1024px) 100vw, 40vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-black/30" />
              <div className="absolute top-4 left-4 rounded-full border border-white/20 bg-black/60 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-white backdrop-blur-md">
                {activeService.badge}
              </div>
              {activeService.startingRateHint && (
                <div className="absolute bottom-4 left-4 rounded-xl border border-blue-400/40 bg-blue-600/90 px-3.5 py-1.5 text-xs font-bold text-white shadow-lg backdrop-blur-md">
                  {activeService.startingRateHint}
                </div>
              )}
            </div>

            {/* Content Col */}
            <div className="flex flex-col justify-between p-6 sm:p-8 lg:col-span-7 lg:p-10">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                  Featured Service Detail
                </span>
                <h3 className="mt-1 text-2xl font-black text-zinc-900 sm:text-3xl">
                  {activeService.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-600 sm:text-base">
                  {activeService.fullDesc}
                </p>

                {/* Key Features Bullet List */}
                <div className="mt-6">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900">
                    What Makes This Service Exceptional:
                  </h4>
                  <ul className="mt-3 space-y-2.5">
                    {activeService.highlights.map((highlight, index) => (
                      <li key={index} className="flex items-start gap-2.5 text-xs sm:text-sm text-zinc-700">
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700">
                          ✓
                        </span>
                        <span>{highlight}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Inclusions Pill Strip */}
                <div className="mt-6 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-zinc-500 mr-1">Includes:</span>
                  {activeService.inclusions.map((inc, i) => (
                    <span
                      key={i}
                      className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-700"
                    >
                      {inc}
                    </span>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="mt-8 flex flex-wrap items-center gap-3 pt-6 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => onSelectServiceForQuote(activeService.serviceType)}
                  className="cursor-pointer rounded-full bg-blue-600 px-6 py-3 text-xs font-bold text-white shadow-lg shadow-blue-900/20 transition hover:bg-blue-500 sm:text-sm"
                >
                  Book / Request Quote Now →
                </button>

                <a
                  href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
                    activeService.whatsappMessage
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-5 py-3 text-xs font-bold text-zinc-800 transition hover:border-[#25D366] hover:text-[#25D366] sm:text-sm"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-4 w-4 text-[#25D366]"
                  >
                    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2M12.05 3.67c2.2 0 4.26.86 5.82 2.42a8.21 8.21 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23-1.48 0-2.93-.39-4.19-1.15l-.3-.17-3.12.82.83-3.04-.2-.32a8.19 8.19 0 0 1-1.26-4.38c.01-4.54 3.7-8.24 8.25-8.24m-3.52 3.66c-.16 0-.43.06-.66.31-.22.25-.87.86-.87 2.07 0 1.22.89 2.39 1 2.56.14.17 1.76 2.67 4.25 3.73.59.27 1.05.42 1.41.53.59.19 1.13.16 1.56.1.48-.07 1.46-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.07-.1-.23-.16-.48-.29s-1.47-.72-1.69-.8c-.23-.08-.37-.12-.56.12-.16.25-.64.81-.78.97-.15.17-.29.19-.53.07-.26-.13-1.06-.39-2.02-1.23-.74-.66-1.23-1.47-1.38-1.72-.12-.24-.01-.37.11-.48.11-.11.25-.29.37-.44.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.43s-.52-1.24-.73-1.73c-.2-.48-.4-.42-.56-.43-.14 0-.3-.01-.47-.01Z" />
                  </svg>
                  <span>Chat on WhatsApp</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* 4 Detailed Interactive Feature Cards Grid */}
        <div className="mt-12 grid grid-cols-1 gap-7 md:grid-cols-2 lg:grid-cols-4">
          {coreServicesData.map((service) => {
            const isHighlighted = service.id === selectedServiceId;
            return (
              <div
                key={service.id}
                onClick={() => setSelectedServiceId(service.id)}
                className={`group flex flex-col justify-between overflow-hidden rounded-3xl border bg-white p-6 shadow-sm transition duration-300 cursor-pointer ${
                  isHighlighted
                    ? "border-blue-500 ring-2 ring-blue-500/20 shadow-md -translate-y-1"
                    : "border-zinc-200/80 hover:-translate-y-1 hover:border-blue-300 hover:shadow-lg"
                }`}
              >
                <div>
                  {/* Card Thumbnail Image */}
                  <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-zinc-100">
                    <Image
                      src={service.image}
                      alt={service.imageAlt}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                      className="object-cover transition duration-500 group-hover:scale-105"
                    />
                    <div className="absolute top-2.5 left-2.5 rounded-full bg-black/60 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
                      {service.badge}
                    </div>
                  </div>

                  <h3 className="mt-4 text-lg font-bold leading-tight text-zinc-900 group-hover:text-blue-600 transition">
                    {service.title}
                  </h3>

                  <p className="mt-2 text-xs leading-relaxed text-zinc-600 line-clamp-3">
                    {service.shortDesc}
                  </p>

                  {/* Highlights Mini List */}
                  <div className="mt-4 space-y-1.5 border-t border-zinc-100 pt-3">
                    {service.highlights.slice(0, 3).map((h, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-[11px] text-zinc-700">
                        <span className="text-blue-600 font-bold shrink-0">✓</span>
                        <span className="truncate">{h}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Card Bottom CTA */}
                <div className="mt-5 pt-4 border-t border-zinc-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-600 group-hover:underline">
                    View Details →
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectServiceForQuote(service.serviceType);
                    }}
                    className="cursor-pointer rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-bold text-blue-700 hover:bg-blue-600 hover:text-white transition"
                  >
                    Quick Quote
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
