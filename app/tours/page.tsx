"use client";

import { useMemo, useState } from "react";
import Footer from "../components/Footer";
import CustomTourCTA from "./components/CustomTourCTA";
import TourCard from "./components/TourCard";
import TourFilters from "./components/TourFilters";
import TourModal from "./components/TourModal";
import ToursNavbar from "./components/ToursNavbar";
import { toursData } from "./toursData";
import { Tour, TourCategory } from "./types";

const categories: TourCategory[] = [
  "All",
  "Multi-Day Round Tours",
  "Day Trips",
  "Coastal Escapes",
  "Tailor-Made Itineraries",
];

const faqs = [
  {
    question: "Are all Chama Travels tours private?",
    answer:
      "Yes, 100%! All our tours are strictly private for you and your travel companions. You will have your own dedicated, comfortable air-conditioned vehicle and an experienced English-speaking chauffeur guide who travels exclusively with your party.",
  },
  {
    question: "Can we customize or adjust any itinerary?",
    answer:
      "Absolutely. Any itinerary you see can be tailored to match your arrival and departure flight times, favorite attractions, preferred pace, and accommodation choices. You can add extra days, change stops, or ask your driver for spontaneous local recommendations.",
  },
  {
    question: "What is included in the vehicle pricing?",
    answer:
      "Our vehicle rates are completely transparent and all-inclusive of the private vehicle, dedicated English-speaking driver guide, all fuel, highway expressway tolls, parking fees, driver accommodation, and driver meals. There are zero hidden fuel surcharges or surprise costs.",
  },
  {
    question: "How do we pay or confirm our booking?",
    answer:
      "You can book directly via our online booking form or via WhatsApp. We do not require rigid upfront deposits for standard private driver arrangements; you can confirm your reservation and settle payments comfortably when you arrive in Sri Lanka.",
  },
  {
    question: "Can Chama Travels book our hotels and safari jeeps?",
    answer:
      "Yes! While you are free to book your own hotels through Booking.com or Airbnb, we also partner with verified 3-star, 4-star, and 5-star boutique hotels and resorts across Sri Lanka at wholesale trade rates. We also arrange private 4x4 open-top safari jeeps in Yala, Udawalawe, and Minneriya.",
  },
];

export default function ToursPage() {
  const [activeCategory, setActiveCategory] = useState<TourCategory>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTour, setSelectedTour] = useState<Tour | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  // Calculate total counts per category
  const totalCounts = useMemo(() => {
    const counts: Record<TourCategory, number> = {
      All: toursData.length,
      "Multi-Day Round Tours": 0,
      "Day Trips": 0,
      "Coastal Escapes": 0,
      "Tailor-Made Itineraries": 0,
    };

    toursData.forEach((tour) => {
      if (counts[tour.category] !== undefined) {
        counts[tour.category] += 1;
      }
    });

    return counts;
  }, []);

  // Filter tours based on active category and search query
  const filteredTours = useMemo(() => {
    return toursData.filter((tour) => {
      // Category filter
      const matchesCategory =
        activeCategory === "All" || tour.category === activeCategory;

      // Search query filter
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        tour.title.toLowerCase().includes(q) ||
        tour.shortDescription.toLowerCase().includes(q) ||
        tour.routeHighlights.some((stop) => stop.toLowerCase().includes(q)) ||
        tour.keyHighlights.some((kh) => kh.toLowerCase().includes(q));

      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  const handleOpenModal = (tour: Tour) => {
    setSelectedTour(tour);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-white text-zinc-900 flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Glassmorphic Navigation Header */}
      <ToursNavbar />

      {/* LIGHT DESIGN HERO BANNER */}
      <section className="relative flex min-h-[50vh] items-center justify-center overflow-hidden pt-28 pb-16">
        <div className="absolute inset-0 bg-[url('https://images.pexels.com/photos/34128249/pexels-photo-34128249.jpeg?auto=compress&cs=tinysrgb&w=2000')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-slate-900/60" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-slate-900/40 to-blue-900/20" />

        <div className="relative z-10 mx-auto max-w-4xl px-4 text-center">
          <span className="inline-block rounded-full border border-white/30 bg-white/20 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white backdrop-blur-md shadow-md">
            Customizable Tour Packages
          </span>

          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
            Sri Lanka Tour <br />
            <span className="text-blue-200">Itineraries</span>
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-base sm:text-lg text-slate-100">
            Carefully designed private chauffeur tour packages covering Sri Lanka’s top highlights. Fully customizable to match your schedule.
          </p>
        </div>
      </section>

      {/* Tours Main Section */}
      <main
        id="tours-grid"
        className="flex-1 bg-[radial-gradient(ellipse_at_top,rgba(219,234,254,0.45),transparent_65%)] px-4 py-16 sm:px-6 sm:py-20 lg:px-8"
      >
        <div className="mx-auto max-w-7xl">
          {/* Section Header */}
          <div className="max-w-3xl text-left">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-600 sm:text-sm">
              Discover Sri Lanka
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-zinc-900 sm:text-4xl lg:text-5xl">
              Explore Our Curated Tour Packages
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600 sm:text-base">
              Choose from classic multi-day circuits, cultural heritage day
              trips, sun-drenched coastal getaways, or let us custom-craft a
              journey for your travel group.
            </p>
          </div>

          {/* Filter and Search Bar */}
          <div className="mt-10">
            <TourFilters
              categories={categories}
              activeCategory={activeCategory}
              onSelectCategory={setActiveCategory}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              totalCounts={totalCounts}
            />
          </div>

          {/* Results Count & Active Category Indicator */}
          <div className="mt-6 flex items-center justify-between border-b border-zinc-200/80 pb-4 text-xs font-semibold text-zinc-500">
            <div>
              Showing{" "}
              <span className="font-bold text-zinc-900">
                {filteredTours.length}
              </span>{" "}
              {filteredTours.length === 1 ? "tour package" : "tour packages"}
              {activeCategory !== "All" && (
                <span>
                  {" "}
                  in{" "}
                  <span className="text-blue-600 font-bold">
                    {activeCategory}
                  </span>
                </span>
              )}
              {searchQuery && (
                <span>
                  {" "}
                  matching &quot;
                  <span className="text-zinc-900 font-bold">{searchQuery}</span>
                  &quot;
                </span>
              )}
            </div>

            {(activeCategory !== "All" || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setActiveCategory("All");
                  setSearchQuery("");
                }}
                className="text-blue-600 hover:text-blue-800 hover:underline"
              >
                Reset filters
              </button>
            )}
          </div>

          {/* Tour Cards Grid */}
          {filteredTours.length > 0 ? (
            <div className="mt-8 grid grid-cols-1 gap-7 md:grid-cols-2 lg:grid-cols-3">
              {filteredTours.map((tour) => (
                <TourCard
                  key={tour.id}
                  tour={tour}
                  onOpenModal={handleOpenModal}
                />
              ))}
            </div>
          ) : (
            <div className="mt-12 rounded-3xl border border-dashed border-zinc-300 bg-white/70 p-12 text-center backdrop-blur-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-2xl text-blue-600">
                🔍
              </div>
              <h3 className="mt-4 text-lg font-bold text-zinc-800">
                No tours found matching &quot;{searchQuery}&quot;
              </h3>
              <p className="mt-2 text-sm text-zinc-500">
                Try searching for different keywords such as &quot;Sigiriya&quot;,
                &quot;Yala&quot;, &quot;Ella&quot;, &quot;Whale&quot;, or reset your filters.
              </p>
              <button
                type="button"
                onClick={() => {
                  setActiveCategory("All");
                  setSearchQuery("");
                }}
                className="mt-5 rounded-full bg-blue-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-blue-500"
              >
                View All Tours
              </button>
            </div>
          )}

          {/* Custom Tour CTA Banner */}
          <div className="mt-20">
            <CustomTourCTA />
          </div>

          {/* Sri Lanka Travel Trust & Quality Badges */}
          <section className="mt-20 border-t border-zinc-200/80 pt-16">
            <div className="mx-auto max-w-4xl text-center">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-600">
                Why Travel with Chama Travels?
              </p>
              <h2 className="mt-2 text-2xl font-black text-zinc-900 sm:text-3xl">
                The Chama Travels Difference
              </h2>
              <p className="mt-3 text-sm text-zinc-600">
                We are a licensed, passionate Sri Lankan local tour operator
                dedicated to giving you the warmest hospitality and safest journeys.
              </p>
            </div>

            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  icon: "🛡️",
                  title: "Safe & Licensed Drivers",
                  desc: "Government-approved, tourism-certified drivers with impeccable safety records and extensive route knowledge.",
                },
                {
                  icon: "❄️",
                  title: "Modern A/C Fleet",
                  desc: "Well-maintained, clean, air-conditioned Sedans, luxury passenger Vans, and SUVs with generous luggage capacity.",
                },
                {
                  icon: "💎",
                  title: "Transparent Fixed Rates",
                  desc: "No hidden charges, no fuel surprises, and no forced commissions. Enjoy honest, straightforward pricing.",
                },
                {
                  icon: "⭐",
                  title: "5-Star TripAdvisor Rated",
                  desc: "Ranked and reviewed by travelers worldwide for warm attentiveness, reliability, and memorable journeys.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-3xl border border-zinc-200/70 bg-white/90 p-6 shadow-xs backdrop-blur-sm transition hover:border-blue-200 hover:shadow-md"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-2xl">
                    {item.icon}
                  </div>
                  <h3 className="mt-4 text-base font-bold text-zinc-900">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-600">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Frequently Asked Questions Accordion */}
          <section className="mt-20 border-t border-zinc-200/80 pt-16">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-600">
                Have Questions?
              </p>
              <h2 className="mt-2 text-2xl font-black text-zinc-900 sm:text-3xl">
                Frequently Asked Questions
              </h2>
            </div>

            <div className="mx-auto mt-10 max-w-3xl space-y-3">
              {faqs.map((faq, idx) => {
                const isOpen = openFaqIndex === idx;

                return (
                  <div
                    key={faq.question}
                    className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-xs transition"
                  >
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() =>
                        setOpenFaqIndex(isOpen ? null : idx)
                      }
                      className="flex w-full items-center justify-between p-5 text-left text-sm font-bold text-zinc-900 hover:text-blue-600 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      <span>{faq.question}</span>
                      <span className="ml-4 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-bold text-zinc-600">
                        {isOpen ? "−" : "+"}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="border-t border-zinc-100 px-5 pt-3 pb-5 text-xs sm:text-sm leading-relaxed text-zinc-600">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </main>

      {/* Detailed Tour Modal (Crucial Feature) */}
      <TourModal
        key={selectedTour?.id || "modal"}
        tour={selectedTour}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />

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

      {/* Shared Global Footer */}
      <Footer />
    </div>
  );
}
