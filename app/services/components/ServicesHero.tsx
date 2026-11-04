"use client";

import { whatsappNumber } from "../servicesData";

interface ServicesHeroProps {
  onOpenQuoteDrawer: (serviceName?: string) => void;
}

export default function ServicesHero({ onOpenQuoteDrawer }: ServicesHeroProps) {
  return (
    <section className="relative flex min-h-[560px] items-center overflow-hidden bg-black sm:min-h-[620px] lg:min-h-[680px]">
      {/* Background Image - High-res scenic highway / coastal backdrop */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000 scale-105"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=2400&q=85')",
        }}
      />

      {/* Dark & Deep Blue Glassmorphic Gradients */}
      <div className="absolute inset-0 bg-black/65" />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-blue-950/50 to-slate-950/30" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.25),transparent_60%)]" />

      {/* Hero Content Container */}
      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pt-32 pb-16 sm:px-6 sm:pt-40 sm:pb-20 lg:px-8">
        <div className="mx-auto w-full max-w-[1150px] rounded-3xl border border-white/20 bg-white/10 px-6 py-8 text-left text-white shadow-2xl shadow-black/40 backdrop-blur-md sm:p-10 lg:p-12">
          {/* Eyebrow Badge */}
          <div className="inline-flex items-center gap-2.5 rounded-full border border-blue-300/35 bg-blue-500/25 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.22em] text-blue-200 backdrop-blur-md sm:text-sm">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-400 animate-pulse" />
            Our Fleet & Travel Services
          </div>

          {/* Main Title */}
          <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            Premium Travel Services
            <span className="block font-light text-blue-300">
              & Private Fleet in Sri Lanka
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-4 max-w-3xl text-base leading-7 text-white/90 sm:mt-5 sm:text-lg sm:leading-8 lg:text-xl">
            From 24/7 express airport transfers to custom islandwide round tours
            and comfortable chauffeur-driven vehicle rentals — travel with Sri
            Lanka’s trusted, government-certified tourist drivers.
          </p>

          {/* Trust Guarantees Quick Strip */}
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2.5 text-xs font-medium text-blue-100 sm:text-sm">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/30 text-blue-200 font-bold">
                ✓
              </span>
              <span>24/7 Airport Flight Radar Tracking</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/30 text-blue-200 font-bold">
                ✓
              </span>
              <span>All Fuel & Highway Tolls Included</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/30 text-blue-200 font-bold">
                ✓
              </span>
              <span>Certified SLTDA English Drivers</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/30 text-blue-200 font-bold">
                ✓
              </span>
              <span>Fully Insured A/C Fleet</span>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="mt-8 flex flex-col gap-3.5 sm:flex-row sm:items-center sm:gap-4">
            {/* Direct Request / Quote Drawer Trigger */}
            <button
              type="button"
              onClick={() => onOpenQuoteDrawer()}
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-blue-400/40 bg-blue-600 px-8 py-3.5 text-center font-bold text-white shadow-xl shadow-blue-900/40 transition hover:-translate-y-0.5 hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
            >
              <span>Request Transfer / Rent Vehicle</span>
              <span aria-hidden="true">→</span>
            </button>

            {/* View Fleet Scroll */}
            <a
              href="#fleet-showcase"
              className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/10 px-7 py-3.5 text-center font-bold text-white backdrop-blur-md transition hover:bg-white/20 hover:border-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
            >
              View Available Fleet ↓
            </a>

            {/* Direct WhatsApp Instant Quote */}
            <a
              href={`https://wa.me/${whatsappNumber}?text=Hello%20Chama%20Travels%2C%20I%20would%20like%20to%20get%20an%20instant%20quote%20for%20your%20transport%20and%20travel%20services.`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[#25D366]/40 bg-[#25D366]/90 px-6 py-3.5 text-center font-bold text-white shadow-lg shadow-green-950/20 backdrop-blur-md transition hover:-translate-y-0.5 hover:bg-[#20bd5a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-4 w-4"
              >
                <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2M12.05 3.67c2.2 0 4.26.86 5.82 2.42a8.21 8.21 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23-1.48 0-2.93-.39-4.19-1.15l-.3-.17-3.12.82.83-3.04-.2-.32a8.19 8.19 0 0 1-1.26-4.38c.01-4.54 3.7-8.24 8.25-8.24m-3.52 3.66c-.16 0-.43.06-.66.31-.22.25-.87.86-.87 2.07 0 1.22.89 2.39 1 2.56.14.17 1.76 2.67 4.25 3.73.59.27 1.05.42 1.41.53.59.19 1.13.16 1.56.1.48-.07 1.46-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.07-.1-.23-.16-.48-.29s-1.47-.72-1.69-.8c-.23-.08-.37-.12-.56.12-.16.25-.64.81-.78.97-.15.17-.29.19-.53.07-.26-.13-1.06-.39-2.02-1.23-.74-.66-1.23-1.47-1.38-1.72-.12-.24-.01-.37.11-.48.11-.11.25-.29.37-.44.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.43s-.52-1.24-.73-1.73c-.2-.48-.4-.42-.56-.43-.14 0-.3-.01-.47-.01Z" />
              </svg>
              <span>Instant WhatsApp Quote</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
