"use client";

import { useState } from "react";
import Image from "next/image";
import ToursNavbar from "../tours/components/ToursNavbar";
import Footer from "../components/Footer";

const whatsappNumber = "94711114901";

const activitiesData = [
  {
    id: "village-tour",
    title: "Sri Lankan Village & Food Experience",
    category: "Culture & Culinary",
    description: "Experience authentic rural life, traditional cooking in clay pots, bullock cart rides, and boat tours through lotus lagoons. Enjoy genuine hospitality from local villagers and taste organic delicacies.",
    image: "/images/village_tour.jpg",
    imageAlt: "Outdoor cooking in a Sri Lankan village",
    duration: "Half Day",
  },
  {
    id: "ella-hiking",
    title: "Ella Hiking & Mountain Adventure",
    category: "Adventure & Nature",
    description: "Hike through lush green tea plantations, climb Little Adam’s Peak and Ella Rock, and marvel at the breathtaking Nine Arches Bridge surrounded by misty mountains.",
    image: "/images/Ella_adventure.JPG",
    imageAlt: "Green hills and valleys in Ella, Sri Lanka",
    duration: "Full Day / Multi-Day",
  },
  {
    id: "yala-safari",
    title: "Yala National Park Safari",
    category: "Wildlife",
    description: "Embark on an exciting 4x4 jeep safari in Sri Lanka's premier wildlife park, famed for having one of the highest leopard densities in the world, alongside elephants and sloth bears.",
    image: "/images/yala-leopard.jpg",
    imageAlt: "Elephants in Yala National Park",
    duration: "3 - 4 Hours",
  },
  {
    id: "udawalawe-safari",
    title: "Udawalawe Elephant Transit Safari",
    category: "Wildlife",
    description: "Witness majestic wild elephant herds roaming freely across vast grasslands, plus deer, water buffaloes, and exotic bird species in their natural sanctuary.",
    image: "/images/udawalawe.jpg",
    imageAlt: "Sri Lankan elephant in Udawalawe National Park",
    duration: "3 Hours",
  },
  {
    id: "mirissa-whale",
    title: "Mirissa Whale & Dolphin Watching",
    category: "Coastal Adventure",
    description: "Sail into the Indian Ocean from Mirissa harbor to spot magnificent blue whales, sperm whales, and playful pods of dolphins in the tropical waters.",
    image: "/images/whale.jpg",
    imageAlt: "Blue whale diving in the ocean near Sri Lanka",
    duration: "4 - 5 Hours",
  },
  {
    id: "kithulgala-rafting",
    title: "Kithulgala Whitewater Rafting",
    category: "Adventure",
    description: "Navigate the thrilling rapids of the Kelani River surrounded by lush tropical rainforests. Perfect for adventure seekers looking for an adrenaline rush!",
    image: "/images/kithulgala_rafting.jpg",
    imageAlt: "Rafters navigating whitewater on a tropical river",
    duration: "2 - 3 Hours",
  },
  {
    id: "tea-plantation",
    title: "Ceylon Tea Plantation & Factory Tour",
    category: "Heritage & Nature",
    description: "Walk amidst emerald tea bushes, learn about hand-picking techniques from local pluckers, and taste world-famous Ceylon tea at a historic factory.",
    image: "/images/Tea-Plantation.jpg",
    imageAlt: "Lush tea plantation in Sri Lanka highlands",
    duration: "2 Hours",
  },
  {
    id: "madu-river",
    title: "Madu River Mangrove Boat Safari",
    category: "Nature & Relaxation",
    description: "Cruise calm river waters through dense mangrove tunnels, visit cinnamon island, and experience natural fish massage therapy in a tranquil wetland setting.",
    image: "/images/madu_river.jpg",
    imageAlt: "Boat travelling through calm mangrove waterways",
    duration: "2 Hours",
  },
];

type ActivityItem = (typeof activitiesData)[number];

export default function ActivitiesPage() {
  // 🔍 Popup state එක (რომელი activity එක click කර ඇත්ද යන්න သိගැනීමට)
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <ToursNavbar activePage="Activities" />

      {/* HERO BANNER */}
      <section className="relative flex min-h-[50vh] items-center justify-center overflow-hidden pt-28 pb-16">
        <div className="absolute inset-0 bg-[url('/images/activiyhedder.jpg')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-slate-900/65" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-slate-900/40 to-blue-900/20" />

        <div className="relative z-10 mx-auto max-w-4xl px-4 text-center">
          <span className="inline-block rounded-full border border-white/30 bg-white/20 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white backdrop-blur-md shadow-md">
            Unforgettable Experiences
          </span>

          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
            Things to Do in <br />
            <span className="text-blue-200">Sri Lanka</span>
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-base sm:text-lg text-slate-100">
            From wildlife safaris and mountain hikes to cultural village tours and whale watching across the island.
          </p>
        </div>
      </section>

      {/* ACTIVITIES GRID */}
      <section className="px-4 py-16 sm:px-6 lg:px-8 max-w-[1400px] mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-600">
            Curated Adventures
          </p>
          <h2 className="mt-2 text-3xl font-extrabold text-slate-900 sm:text-4xl">
            Explore Popular Activities
          </h2>
          <p className="mt-3 text-slate-600 text-sm">
            Click on any activity card to view full details and inquire via WhatsApp.
          </p>
        </div>

        {/* 📐 4 Cards per row on desktop */}
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {activitiesData.map((act) => (
            <article
              key={act.id}
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
              className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md shadow-slate-200/40 transition duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:border-blue-300 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <div className="relative aspect-[16/11] overflow-hidden bg-slate-100">
                <Image
                  src={act.image}
                  alt={act.imageAlt}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="object-cover transition duration-500 group-hover:scale-105"
                />
                <span className="absolute top-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-slate-800 shadow-sm backdrop-blur-md">
                  {act.category}
                </span>
                <span className="absolute bottom-3 left-3 rounded-full bg-slate-950/80 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
                  ⏱️ {act.duration}
                </span>
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
          ))}
        </div>
      </section>

      {/* 🔍 POPUP MODAL (කාඩ් එකක් ක්ලික් කළ විට පෙන්වන කොටස) */}
      {selectedActivity && (
        <div
          onClick={() => setSelectedActivity(null)}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200"
          >
            {/* ❌ Close Button */}
            <button
              type="button"
              aria-label="Close modal"
              onClick={() => setSelectedActivity(null)}
              className="absolute top-4 right-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-slate-900/70 text-lg text-white shadow-md transition hover:bg-red-600"
            >
              ✕
            </button>

            {/* Modal Image */}
            <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
              <Image
                src={selectedActivity.image}
                alt={selectedActivity.imageAlt}
                fill
                sizes="(max-width: 640px) 100vw, 600px"
                className="object-cover"
              />
              <span className="absolute top-4 left-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-slate-800 shadow backdrop-blur-md">
                {selectedActivity.category}
              </span>
              <span className="absolute bottom-4 left-4 rounded-full bg-slate-950/80 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
                ⏱️ {selectedActivity.duration}
              </span>
            </div>

            {/* Modal Content */}
            <div className="p-6 sm:p-8">
              <h3 className="text-2xl font-bold text-slate-900">
                {selectedActivity.title}
              </h3>
              <p className="mt-4 text-sm sm:text-base text-slate-600 leading-relaxed">
                {selectedActivity.description}
              </p>

              {/* WhatsApp Inquire Button inside Popup */}
              <div className="mt-8">
                <a
                  href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
                    `Hello Chama Travels, I am interested in including "${selectedActivity.title}" in my Sri Lanka trip plan!`
                  )}`}
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