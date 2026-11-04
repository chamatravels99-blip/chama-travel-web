"use client";

const whatsappNumber = "94711114901";

export default function CustomTourCTA() {
  const customTripUrl = `https://wa.me/${whatsappNumber}?text=Hello%20Chama%20Travels%2C%20I%20would%20like%20to%20create%20a%20100%25%20custom%20tailor-made%20itinerary%20for%20my%20trip%20to%20Sri%20Lanka.`;

  return (
    <section className="relative overflow-hidden rounded-3xl border border-blue-200/80 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 px-6 py-12 text-white shadow-2xl sm:px-12 sm:py-16">
      {/* Decorative background glow */}
      <div
        aria-hidden="true"
        className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-blue-400/10 blur-3xl"
      />

      <div className="relative z-10 mx-auto max-w-4xl text-center">
        <span className="inline-block rounded-full border border-blue-400/30 bg-blue-500/20 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-blue-300 backdrop-blur-sm sm:text-sm">
          100% Tailor-Made For You
        </span>

        <h2 className="mt-4 text-2xl font-black tracking-tight sm:text-4xl lg:text-5xl">
          Want a Custom Sri Lanka Itinerary?
        </h2>

        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-zinc-300 sm:text-base sm:leading-8">
          Tell us your travel dates, group size, and must-see destinations.
          Chamod and our experienced team will design a personalized route
          with the best hotels, safari jeeps, scenic train tickets, and a
          dedicated private vehicle.
        </p>

        {/* Feature Highlights Grid */}
        <div className="mt-8 grid grid-cols-1 gap-4 text-left sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xs">
            <div className="text-xl">🗺️</div>
            <h3 className="mt-2 text-sm font-bold text-white">Custom Routing</h3>
            <p className="mt-1 text-xs text-zinc-400">
              Pick your stops, duration, hotel tiers, and daily rhythm.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xs">
            <div className="text-xl">🚗</div>
            <h3 className="mt-2 text-sm font-bold text-white">Private Dedicated Driver</h3>
            <p className="mt-1 text-xs text-zinc-400">
              Comfortable A/C Sedan, Van, or SUV exclusively for your party.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xs">
            <div className="text-xl">💬</div>
            <h3 className="mt-2 text-sm font-bold text-white">Direct WhatsApp Support</h3>
            <p className="mt-1 text-xs text-zinc-400">
              Quick replies, transparent pricing, and zero consultation fees.
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
          <a
            href={customTripUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-8 py-4 text-sm font-bold text-white shadow-lg shadow-[#25D366]/25 transition hover:bg-[#20bd5a] hover:scale-102 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#25D366]"
          >
            <svg
              className="h-5 w-5 fill-current"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2M12.05 3.67c2.2 0 4.26.86 5.82 2.42a8.21 8.21 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23-1.48 0-2.93-.39-4.19-1.15l-.3-.17-3.12.82.83-3.04-.2-.32a8.19 8.19 0 0 1-1.26-4.38c.01-4.54 3.7-8.24 8.25-8.24m-3.52 3.66c-.16 0-.43.06-.66.31-.22.25-.87.86-.87 2.07 0 1.22.89 2.39 1 2.56.14.17 1.76 2.67 4.25 3.73.59.27 1.05.42 1.41.53.59.19 1.13.16 1.56.1.48-.07 1.46-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.07-.1-.23-.16-.48-.29s-1.47-.72-1.69-.8c-.23-.08-.37-.12-.56.12-.16.25-.64.81-.78.97-.15.17-.29.19-.53.07-.26-.13-1.06-.39-2.02-1.23-.74-.66-1.23-1.47-1.38-1.72-.12-.24-.01-.37.11-.48.11-.11.25-.29.37-.44.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.43s-.52-1.24-.73-1.73c-.2-.48-.4-.42-.56-.43-.14 0-.3-.01-.47-.01Z" />
            </svg>
            <span>Chat with Us on WhatsApp to Plan</span>
          </a>
        </div>
      </div>
    </section>
  );
}
