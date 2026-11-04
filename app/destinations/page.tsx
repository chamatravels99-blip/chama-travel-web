"use client";

import Image from "next/image";
import { useState } from "react";
import ToursNavbar from "../tours/components/ToursNavbar";
import Footer from "../components/Footer";
import { destinationsData, Destination } from "./destinationsData";

const whatsappNumber = "94711114901";

export default function DestinationsPage() {
  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Navbar */}
      <ToursNavbar activePage="destinations" />

      {/* HERO SECTION (Bright Cinematic Banner) */}
      <section className="relative flex min-h-[55vh] items-center justify-center overflow-hidden pt-28 pb-16">
        {/* Background Image */}
        <div className="absolute inset-0 bg-[url('/images/elephants_are_walking.jpg?auto=compress&cs=tinysrgb&w=2000')] bg-cover bg-center" />
        
        {/* Light Overlay Gradients */}
        <div className="absolute inset-0 bg-slate-900/50" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-slate-900/30 to-blue-900/20" />

        <div className="relative z-10 mx-auto max-w-5xl px-4 text-center">
          <span className="inline-block rounded-full border border-white/30 bg-white/20 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white backdrop-blur-md shadow-md">
            Sri Lanka Destination Guide
          </span>

          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-white sm:text-6xl drop-shadow-md">
            Explore Paradise <br />
            <span className="text-blue-200">Destinations</span>
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-base sm:text-lg text-slate-100 drop-shadow">
            From ancient royal rock fortresses and misty tea highlands to wild elephant safaris and sun-kissed beaches.
          </p>
        </div>
      </section>

      {/* DESTINATIONS CARDS GRID (Clean Light Theme) */}
      <section className="px-6 py-16 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-600">
            Handpicked Locations
          </p>
          <h2 className="mt-2 text-3xl font-extrabold text-slate-900 sm:text-4xl">
            Where Do You Want to Go?
          </h2>
          <p className="mt-3 text-slate-600 text-sm">
            Select a destination to view highlights, best visiting seasons, and tour connections.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {destinationsData.map((dest) => (
            <article
              key={dest.id}
              className="group flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50 transition duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:border-blue-300"
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                <Image
                  src={dest.image}
                  alt={dest.imageAlt}
                  fill
                  className="object-cover transition duration-500 group-hover:scale-105"
                />
                <span className="absolute top-4 left-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-slate-800 shadow-md backdrop-blur-md">
                  📍 {dest.region}
                </span>
              </div>

              <div className="flex flex-1 flex-col p-6">
                <h3 className="text-2xl font-bold text-slate-900 group-hover:text-blue-600 transition">
                  {dest.name}
                </h3>
                <p className="mt-1 text-xs font-semibold text-blue-600">{dest.tagline}</p>
                <p className="mt-3 text-sm text-slate-600 leading-relaxed line-clamp-3">
                  {dest.description}
                </p>

                {/* Key Highlights */}
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Top Experiences
                  </p>
                  <ul className="space-y-1.5 text-xs text-slate-700">
                    {dest.highlights.slice(0, 2).map((item, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-600">
                          ✓
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-auto pt-6 flex items-center justify-between gap-3">
                  <button
                    onClick={() => setSelectedDestination(dest)}
                    className="flex-1 rounded-xl border border-slate-300 bg-slate-50 py-2.5 text-center text-xs font-bold text-slate-800 transition hover:bg-slate-900 hover:text-white hover:border-slate-900"
                  >
                    View Details
                  </button>

                  <a
                    href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
                      `Hello Chama Travels, I would like to visit ${dest.name} in my Sri Lanka tour!`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-600/20 transition hover:bg-blue-700"
                  >
                    Inquire
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* DESTINATION MODAL (Clean Light Dialog) */}
      {selectedDestination && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 text-slate-900 shadow-2xl">
            <button
              onClick={() => setSelectedDestination(null)}
              className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200"
            >
              ✕
            </button>

            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl mb-6 bg-slate-100">
              <Image
                src={selectedDestination.image}
                alt={selectedDestination.imageAlt}
                fill
                className="object-cover"
              />
            </div>

            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
              📍 {selectedDestination.region}
            </span>
            <h2 className="mt-1 text-3xl font-extrabold text-slate-900">{selectedDestination.name}</h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">{selectedDestination.description}</p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 border-t border-b border-slate-100 py-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl">
                <span className="font-bold text-slate-400 block mb-1">Best Time to Visit:</span>
                <p className="text-slate-800 font-bold">{selectedDestination.bestTimeToVisit}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl">
                <span className="font-bold text-slate-400 block mb-1">Recommended Duration:</span>
                <p className="text-slate-800 font-bold">{selectedDestination.recommendedDays}</p>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Must-Do Experiences
              </h3>
              <ul className="space-y-2 text-xs text-slate-700">
                {selectedDestination.highlights.map((h, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-600">
                      ✓
                    </span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8">
              <a
                href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
                  `Hello Chama Travels, I am interested in exploring ${selectedDestination.name}. Please share tour package details.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full rounded-xl bg-blue-600 py-3.5 text-center text-xs font-bold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-700"
              >
                Book Tour Including {selectedDestination.name} →
              </a>
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
      {/* Footer */}
      <Footer />
    </main>
  );
}