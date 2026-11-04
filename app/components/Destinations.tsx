"use client";

import Image from "next/image";
import { useRef } from "react";

const destinations = [
  {
    name: "Colombo",
    image:
      "/images/colombo-sri-lanka.jpg",
    description: "The bustling capital city",
  },
  {
    name: "Negombo",
    image:
      "/images/negombo-heritance.jpg",
    description: "Coastal charm & fish markets",
  },
  {
    name: "Kandy",
    image:
      "/images/temple-of-the-tooth.jpg",
    description: "Cultural heart of Sri Lanka",
  },
  {
    name: "Sigiriya",
    image:
      "/images/Sigiriya.jpeg",
    description: "The ancient rock fortress",
  },
  {
    name: "Ella",
    image:
      "/images/ella_railway.JPG",
    description: "Misty mountains & waterfalls",
  },
  {
    name: "Nuwara Eliya",
    image:
      "/images/nuwaraeliya.jpg",
    description: "Little England & tea estates",
  },
  {
    name: "Galle",
    image:
      "/images/galle_fort.JPG",
    description: "Historic Dutch Fort",
  },
  {
    name: "Bentota",
    image:
      "/images/benthota_water_sport.jpg",
    description: "Golden beaches & water sports",
  },
  {
    name: "Yala",
    image:
      "/images/leopard-yala-national-park.jpg",
    description: "Wildlife & leopard safaris",
  },
  {
    name: "Mirissa",
    image:
      "/images/mirissa_turtle.jpg",
    description: "Whale watching & surf breaks",
  },
];

export default function Destinations() {
  const carouselRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: -1 | 1) => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    const firstCard = carousel.firstElementChild as HTMLElement | null;
    if (!firstCard) return;

    const gap = Number.parseFloat(getComputedStyle(carousel).columnGap) || 0;
    const cardWidth = firstCard.getBoundingClientRect().width;
    
    // Scroll by slightly less than the fully visible width to show continuity
    const visibleWidth = carousel.clientWidth;
    const scrollAmount = Math.max(cardWidth + gap, visibleWidth * 0.8);

    carousel.scrollBy({
      left: direction * scrollAmount,
      behavior: "smooth",
    });
  };

  return (
    <section id="destinations" className="bg-slate-50 px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-600">
            Discover
          </p>
          <h2 className="mt-3 text-3xl font-extrabold text-zinc-900 sm:text-4xl">
            Popular Destinations
          </h2>
          <p className="mt-4 text-base leading-7 text-zinc-600 sm:text-lg">
            Explore the most beautiful and iconic locations across Sri Lanka.
          </p>
        </div>

        <div className="relative mt-12 @container">
          <div
            ref={carouselRef}
            className="flex snap-x snap-mandatory gap-4 sm:gap-5 lg:gap-6 overflow-x-auto overscroll-x-contain scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-4 px-1 py-4"
          >
            {destinations.map((destination) => (
              <div
                key={destination.name}
                className="group/card relative flex-[0_0_calc(50%-0.5rem)] sm:flex-[0_0_calc(33.333%-0.833rem)] lg:flex-[0_0_calc(20%-1.2rem)] snap-start overflow-hidden rounded-3xl aspect-[4/5] shadow-[0_8px_20px_rgba(0,0,0,0.08)] transition duration-500 ease-out hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.15)] bg-slate-900"
              >
                <Image
                  src={destination.image}
                  alt={destination.name}
                  fill
                  sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 20vw"
                  className="object-cover transition duration-700 ease-out group-hover/card:scale-110"
                />
                
                {/* Dark gradient for text readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80 transition duration-500 group-hover/card:opacity-90" />
                
                {/* Glassmorphism overlay */}
                <div className="absolute inset-0 rounded-3xl border border-white/20 bg-white/5 backdrop-blur-[1px] transition duration-500 group-hover/card:bg-transparent group-hover/card:backdrop-blur-none" />

                <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 text-white z-10">
                  <h3 className="text-lg sm:text-xl font-bold tracking-tight text-white drop-shadow-md">
                    {destination.name}
                  </h3>
                  <p className="mt-1 translate-y-3 text-xs sm:text-sm text-white/90 opacity-0 transition duration-500 ease-out group-hover/card:translate-y-0 group-hover/card:opacity-100">
                    {destination.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            aria-label="Previous destinations"
            onClick={() => scroll(-1)}
            className="absolute -left-3 sm:-left-5 top-1/2 -translate-y-1/2 z-20 flex h-12 w-12 items-center justify-center rounded-full border border-white/50 bg-white/60 text-2xl text-blue-900 shadow-[0_8px_20px_rgba(0,0,0,0.12)] backdrop-blur-md transition hover:-translate-y-1 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            ‹
          </button>

          <button
            type="button"
            aria-label="Next destinations"
            onClick={() => scroll(1)}
            className="absolute -right-3 sm:-right-5 top-1/2 -translate-y-1/2 z-20 flex h-12 w-12 items-center justify-center rounded-full border border-white/50 bg-white/60 text-2xl text-blue-900 shadow-[0_8px_20px_rgba(0,0,0,0.12)] backdrop-blur-md transition hover:-translate-y-1 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            ›
          </button>
        </div>

        <div className="mt-8 flex justify-center">
          <a
            href="/destinations"
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-blue-200 bg-white px-8 py-3 text-sm font-bold text-blue-700 shadow-[0_4px_14px_rgba(0,0,0,0.05)] transition hover:-translate-y-0.5 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            explore Destinations →
          </a>
        </div>
      </div>
    </section>
  );
}
