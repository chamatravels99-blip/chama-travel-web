"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import Destinations from "./components/Destinations";
import Footer from "./components/Footer";
import ToursNavbar from "./tours/components/ToursNavbar";

const whatsappNumber = "94711114901";

const featuredTours = [
  {
    title: "Highlights of Sri Lanka",
    days: "8 Days / 7 Nights",
    image:
      "/images/Seema-Malaka-Temple-colombo-sri-lanka.jpg",
    imageAlt: "Sigiriya Rock Fortress rising above Sri Lankan forest at sunrise",
  },
  {
    title: "Southern Coastal Escape",
    days: "10 Days / 9 Nights",
    image:
      "/images/beach.jpg",
    imageAlt: "Palm-lined Mirissa beach on Sri Lanka's southern coast",
  },
  {
    title: "Scenic Sri Lanka Escape",
    days: "7 Days / 6 Nights",
    image:
      "/images/Ella_adventure.JPG",
    imageAlt: "Nine Arches Bridge surrounded by Ella's green highlands",
  },
];

const customerReviews = [
  {
    author: "Sonia",
    location: "Germany",
    title: "friendly service",
    text: "I would highly recommend chamod if you are looking for a driver for your holiday sri lanka. The best place to travel with a friendly and trustworthy person like a friend. We really enjoyed our trip around sri lanka.",
    url: "https://www.tripadvisor.com/ShowUserReviews-g293962-d32748314-r1031218407-Chama_Travel_Tours-Colombo_Western_Province.html",
  },
  {
    author: "Gill",
    location: "Dewsbury, United Kingdom",
    title: "Fantastic Sri Lankan experience",
    text: "Our experience with Chamud was first class. An excellent driver, always felt safe. Chamod was a kind, helpful and thoughtful man who was always prepared to go the extra mile. The tour was superb.",
    url: "https://www.tripadvisor.com/ShowUserReviews-g293962-d32748314-r1034474433-Chama_Travel_Tours-Colombo_Western_Province.html",
  },
  {
    author: "Andrew",
    location: "Dewsbury, United Kingdom",
    title: "Superb trip",
    text: "Simply a great caring and attentive guy. Just what you need in Sri Lanka. Would highly recommend. We had a full planned day, everyday. He knows all the places to go, booked things ahead.",
    url: "https://www.tripadvisor.com/ShowUserReviews-g293962-d32748314-r1034457788-Chama_Travel_Tours-Colombo_Western_Province.html",
  },
  {
    author: "Nick",
    location: "Leeds, United Kingdom",
    title: "Everything was absolutely amazing",
    text: "Choosing Chamod was one of the best decisions we made during our entire journey. After a long flight, he welcomed us at the airport with such warmth and positivity.",
    url: "https://www.tripadvisor.com/ShowUserReviews-g293962-d32748314-r1067946228-Chama_Travel_Tours-Colombo_Western_Province.html",
  },
  {
    author: "KKM",
    location: "",
    title: "Great Memories enhanced by Driver",
    text: "This was a Great Family Tour! A very Beautiful Country which was further enhanced by the Driver and his Services. Mr. Chamod was very helpful and proactive.",
    url: "https://www.tripadvisor.com/ShowUserReviews-g293962-d32748314-r1076445276-Chama_Travel_Tours-Colombo_Western_Province.html",
  },
];

const tripAdvisorUrl =
  "https://www.tripadvisor.com/Attraction_Review-g293962-d32748314-Reviews-Chama_Travel_Tours-Colombo_Western_Province.html";
const googleMapsUrl =
  "https://www.google.com/maps/place/Chama+Travel+%26+Tours/data=!4m7!3m6!1s0x2554543128f9092d:0x2780ba119100211a!8m2!3d7.0815764!4d80.0870175!16s%2Fg%2F11lypjsjpg!19sChIJLQn5KDFUVCURGiEAkRG6gCc";

const galleryPhotos = [
  {
    src: "/images/WhatsApp Image 2024-12-29 at 13.03.27_9da2629c.jpg",
    alt: "Happy travelers exploring Sri Lanka with Chama Travels",
    featured: true,
  },
  {
    src: "/images/2024_07_26_21_27_56_47FA4CFD-FCDD-4AC3-94BF-AC5FD4CE820F.jpg",
    alt: "Scenic travel moments and sightseeing in Sri Lanka",
  },
  {
    src: "/images/2024_03_30_11_21_19_IMG_1200.jpg",
    alt: "Tourists enjoying private transport across Sri Lankan destinations",
  },
  {
    src: "/images/2024_10_12_15_22_52_IMG_3436.jpg",
    alt: "Cultural landmark visit with Chama Travels chauffeur guide",
    featured: true,
  },
  {
    src: "/images/2024_11_28_09_44_28_IMG_4455.jpg",
    alt: "Travelers visiting Sri Lanka highlands and tea plantations",
  },
  {
    src: "/images/2024_12_18_10_08_44_IMG_4962.jpg",
    alt: "Memorable holiday moments with local Sri Lankan driver guide",
  },
  {
    src: "/images/2025_07_23_06_19_23_IMG_0757.jpg",
    alt: "Sigiriya Rock Fortress panoramic viewpoint in Sri Lanka",
  },
  {
    src: "/images/2025_10_01_10_59_58_IMG_2604(1).jpg",
    alt: "Family touring iconic Sri Lanka heritage sites",
    wide: true,
  },
  {
    src: "/images/2026_02_27_10_52_34_IMG_5805.jpg",
    alt: "Island wildlife and coastal adventure with Chama Travels",
  },
];

export default function Home() {
  const [activeTourIndex, setActiveTourIndex] = useState(0);
  const [activeGalleryIndex, setActiveGalleryIndex] = useState<number | null>(
    null,
  );
  const tourCarouselRef = useRef<HTMLDivElement>(null);
  const activityCarouselRef = useRef<HTMLDivElement>(null);
  const reviewCarouselRef = useRef<HTMLDivElement>(null);
  const isMobileCarousel = useRef(false);
  const galleryIsOpen = activeGalleryIndex !== null;

  useEffect(() => {
    isMobileCarousel.current = window.innerWidth < 768;

    const resetAtBreakpoint = () => {
      const isMobile = window.innerWidth < 768;
      if (isMobileCarousel.current !== isMobile) {
        isMobileCarousel.current = isMobile;
        setActiveTourIndex(0);
        if (tourCarouselRef.current) {
          tourCarouselRef.current.scrollLeft = 0;
        }
      }
    };

    window.addEventListener("resize", resetAtBreakpoint);
    return () => window.removeEventListener("resize", resetAtBreakpoint);
  }, []);

  useEffect(() => {
    if (!galleryIsOpen) return;

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleGalleryKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveGalleryIndex(null);
      } else if (event.key === "ArrowLeft") {
        setActiveGalleryIndex((index) =>
          index === null ? null : Math.max(0, index - 1),
        );
      } else if (event.key === "ArrowRight") {
        setActiveGalleryIndex((index) =>
          index === null ? null : Math.min(galleryPhotos.length - 1, index + 1),
        );
      }
    };

    window.addEventListener("keydown", handleGalleryKeyDown);
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener("keydown", handleGalleryKeyDown);
    };
  }, [galleryIsOpen]);

  const moveTour = (direction: -1 | 1) => {
    const carousel = tourCarouselRef.current;
    const firstCard = carousel?.firstElementChild as HTMLElement | null;
    if (!carousel || !firstCard) return;

    const gap = Number.parseFloat(getComputedStyle(carousel).columnGap) || 0;
    const step = firstCard.getBoundingClientRect().width + gap;
    const maxIndex = Math.max(
      0,
      Math.round((carousel.scrollWidth - carousel.clientWidth) / step),
    );
    const nextIndex = Math.max(
      0,
      Math.min(maxIndex, activeTourIndex + direction),
    );

    setActiveTourIndex(nextIndex);
    carousel.scrollTo({ left: nextIndex * step, behavior: "smooth" });
  };

  const updateActiveTour = () => {
    const carousel = tourCarouselRef.current;
    const firstCard = carousel?.firstElementChild as HTMLElement | null;
    if (!carousel || !firstCard) return;

    const gap = Number.parseFloat(getComputedStyle(carousel).columnGap) || 0;
    const step = firstCard.getBoundingClientRect().width + gap;
    const index = Math.round(carousel.scrollLeft / step);
    setActiveTourIndex(Math.min(featuredTours.length - 1, index));
  };

  const scrollActivities = (direction: -1 | 1) => {
    const carousel = activityCarouselRef.current;
    if (!carousel) return;
    carousel.scrollBy({
      left: direction * carousel.clientWidth,
      behavior: "smooth",
    });
  };

  const scrollReviews = (direction: -1 | 1) => {
    const carousel = reviewCarouselRef.current;
    const firstCard = carousel?.firstElementChild as HTMLElement | null;
    if (!carousel || !firstCard) return;

    const gap = Number.parseFloat(getComputedStyle(carousel).columnGap) || 0;
    carousel.scrollBy({
      left: direction * (firstCard.getBoundingClientRect().width + gap),
      behavior: "smooth",
    });
  };

  return (
    <main className="min-h-screen bg-white text-zinc-900">
      {/* ================= HEADER ================= */}
      <ToursNavbar activePage="Home" />

      {/* ================= HERO ================= */}
      {/* LIGHT DESIGN HERO BANNER */}
      <section id="home" className="relative flex min-h-[60vh] sm:min-h-[70vh] items-center justify-center overflow-hidden pt-28 pb-16">
        <div className="absolute inset-0 bg-[url('/images/beach.jpg')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-slate-900/60" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-slate-900/40 to-blue-900/20" />

        <div className="relative z-10 mx-auto max-w-4xl px-4 text-center">
          <span className="inline-block rounded-full border border-white/30 bg-white/20 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white backdrop-blur-md shadow-md">
            Explore Sri Lanka
          </span>

          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-white sm:text-6xl animate-fade-in-up">
            Discover Sri Lanka <br />
            <span className="text-blue-200 animate-fade-in-up animation-delay-600">With Chama Travels</span>
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-base sm:text-lg text-slate-100 200 animate-fade-in-up animation-delay-500">
            Experience beautiful places, unforgettable adventures and comfortable journeys across Sri Lanka with friendly local service.
          </p>

          <p className="mt-3 text-xs font-semibold text-blue-200 uppercase tracking-wider animate-fade-in-up animation-delay-300">
            Private Tours • Airport Transfers • Vehicle Rental
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 animate-fade-in-up animation-delay-200">
            <a
              href="/tours"
              className="rounded-full bg-blue-600 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-700 hover:scale-105"
            >
              Explore Our Tours →
            </a>

            <a
              href={`https://wa.me/${whatsappNumber}?text=Hello%20Chama%20Travels%2C%20I%20would%20like%20to%20plan%20a%20trip%20in%20Sri%20Lanka.`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-white/40 bg-white/20 px-7 py-3.5 text-sm font-bold text-white backdrop-blur-md transition hover:bg-white hover:text-slate-900"
            >
              Plan via WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* ================= INTRO ================= */}
      <section className="px-6 py-20 lg:px-8">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-600">
            Welcome to Chama Travels
          </p>

          <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Your Journey Around Sri Lanka Starts Here
          </h2>

          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-zinc-600">
            From cultural landmarks and misty mountains to golden beaches and
            exciting wildlife adventures, we help you experience Sri Lanka in
            your own way.
          </p>
        </div>
      </section>

      {/* ================= SERVICES ================= */}
      <section
        id="services"
        className="bg-slate-50 bg-[radial-gradient(ellipse_at_top,rgba(219,234,254,0.5),transparent_65%)] px-6 py-20 lg:px-8"
      >
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-600">
              Our Services
            </p>

            <h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">
              Travel Made Simple
            </h2>

            <p className="mt-4 leading-7 text-zinc-600">
              From airport pickup to complete Sri Lanka tours, we make your
              journey comfortable and stress-free.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: "Airport Transfers",
                text: "Comfortable airport pickup and drop-off anywhere in Sri Lanka.",
              },
              {
                title: "Sri Lanka Tours",
                text: "Private and customizable tours designed around your plans.",
              },
              {
                title: "Vehicle Rental",
                text: "Reliable vehicles with friendly and experienced drivers.",
              },
              {
                title: "Local Experiences",
                text: "Discover culture, food, nature and hidden places with local guidance.",
              },
            ].map((service) => (
              <div
                key={service.title}
                className="h-full min-h-56 rounded-3xl border border-white/90 bg-white/80 p-7 shadow-[0_14px_36px_rgba(15,23,42,0.07)] backdrop-blur-md transition duration-300 ease-out motion-reduce:transition-none md:hover:-translate-y-1 md:hover:border-blue-200 md:hover:bg-white md:hover:shadow-[0_20px_45px_rgba(37,99,235,0.14)]"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-400/30 bg-blue-600 text-lg font-bold text-white shadow-md shadow-blue-900/20 ring-1 ring-white/70">
                  ✓
                </div>

                <h3 className="text-xl font-bold">{service.title}</h3>

                <p className="mt-3 leading-7 text-zinc-600">
                  {service.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= THINGS TO DO ================= */}
      <section
        id="activities"
        aria-labelledby="activities-heading"
        className="relative isolate overflow-hidden bg-white px-6 py-20 lg:px-8"
      >
        <div
          aria-hidden="true"
           className="absolute inset-0 bg-[url('/images/1307254.jpg')] bg-cover bg-center bg-no-repeat"
            />
        <div aria-hidden="true" className="absolute inset-0 bg-white/70" />

        <div className="relative z-10 mx-auto grid max-w-7xl gap-8 md:grid-cols-[minmax(0,0.32fr)_minmax(0,0.68fr)] md:items-center lg:gap-12">
          <div className="min-w-0 md:pr-2">
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-700">
              Explore Sri Lanka
            </p>
            <h2
              id="activities-heading"
              className="mt-3 text-3xl font-extrabold uppercase leading-tight tracking-tight text-zinc-900 sm:text-4xl lg:text-5xl"
            >
              <span className="block">Things to Do</span>
              <span className="block">in Sri Lanka</span>
            </h2>
            <p className="mt-5 text-base leading-7 text-zinc-600 sm:text-lg sm:leading-8">
              Explore unforgettable experiences across Sri Lanka, from
              beautiful beaches and misty mountains to wildlife, culture, food
              and hidden gems.
            </p>
            {/* 1. View All button එක /activities page එකට ලින්ක් කරන ලදී */}
            <a
              href="/activities"
              className="mt-6 inline-flex min-h-11 items-center font-bold text-blue-700 underline underline-offset-4 transition hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              View All →
            </a>
          </div>

          <div className="relative min-w-0 @container">
            <div
              ref={activityCarouselRef}
              role="region"
              aria-label="Things to do in Sri Lanka experiences"
              aria-roledescription="carousel"
              tabIndex={0}
              className="flex snap-x snap-mandatory gap-5 overflow-x-auto overscroll-x-contain scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-4 md:mx-12"
            >
            {[
              {
                title: "Sri Lankan Village & Food Experience",
                description:
                  "Share village life through local food, customs and rural scenery.",
                image:
                  "/images/village_tour.jpg",
                imageAlt: "Outdoor cooking in a Sri Lankan village",
              },
              {
                title: "Ella Hiking & Adventure",
                description:
                  "Explore Ella’s green highlands, trails and scenic viewpoints.",
                image:
                  "/images/Ella_adventure.JPG",
                imageAlt: "Green hills and valleys in Ella, Sri Lanka",
              },
              {
                title: "Yala Wildlife Safari",
                description:
                  "Look for native wildlife among Yala’s forests and open landscapes.",
                image:
                  "/images/yala-leopard.jpg",
                imageAlt: "Elephants in the greenery of Yala National Park",
              },
              {
                title: "Udawalawe Wildlife Safari",
                description:
                  "Discover open grasslands and Sri Lankan elephants in the wild.",
                image:
                  "/images/udawalawe.jpg",
                imageAlt: "Sri Lankan elephant in Udawalawe National Park",
              },
              {
                title: "Mirissa Whale Watching",
                description:
                  "Head out to sea in search of whales along the southern coast.",
                image:
                  "/images/whale.jpg",
                imageAlt: "Blue whale diving in the ocean near Sri Lanka",
              },
              {
                title: "Kithulgala Whitewater Rafting",
                description:
                  "Navigate lively rapids surrounded by tropical river scenery.",
                image:
                  "/images/kithulgala_rafting.jpg",
                imageAlt: "Rafters navigating whitewater on a tropical river",
              },
              {
                title: "Madu River Boat Safari",
                description:
                  "Cruise calm waterways through mangroves and river islands.",
                image:
                  "/images/madu_river.jpg",
                imageAlt: "Boat travelling through calm mangrove waterways",
              },
              {
                title: "Tea Plantation Experience",
                description:
                  "Walk through green tea fields in Sri Lanka’s hill country.",
                image:
                  "/images/Tea-Plantation.jpg",
                imageAlt: "Lush tea plantation in Sri Lanka’s highlands",
              },
              {
                title: "Bentota Water Sports",
                description:
                  "Try beachside water activities along Sri Lanka’s western coast.",
                image:
                  "https://images.pexels.com/photos/10825335/pexels-photo-10825335.jpeg?auto=compress&cs=tinysrgb&w=800",
                imageAlt: "Windsurfer on Sri Lankan coastal waters",
              },
              {
                title: "Surfing in Sri Lanka",
                description:
                  "Catch a wave at one of Sri Lanka’s well-known surf beaches.",
                image:
                  "https://images.pexels.com/photos/34714740/pexels-photo-34714740.jpeg?auto=compress&cs=tinysrgb&w=800",
                imageAlt: "Surfer walking along Weligama Beach at sunset",
              },
            ].map((activity) => (
              <article
                key={activity.title}
                className="group flex min-w-0 flex-[0_0_100%] snap-start flex-col overflow-hidden rounded-3xl border border-blue-100/80 bg-white shadow-[0_14px_34px_rgba(15,23,42,0.08)] transition duration-300 ease-out motion-reduce:transition-none md:basis-[calc((100%-1.25rem)/2)] md:hover:-translate-y-1 md:hover:border-blue-200 md:hover:shadow-[0_20px_42px_rgba(37,99,235,0.15)]"
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                  <Image
                    src={activity.image}
                    alt={activity.imageAlt}
                    width={800}
                    height={500}
                    sizes="(max-width: 767px) 100vw, 34vw"
                    className="h-full w-full object-cover transition duration-500 ease-out motion-reduce:transition-none md:group-hover:scale-[1.04]"
                  />
                </div>

                <div className="flex flex-1 flex-col p-5 sm:p-6">
                  <h3 className="text-lg font-bold leading-snug text-zinc-900 sm:text-xl">
                    {activity.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">
                    {activity.description}
                  </p>
                  {/* 2. book now button එක WhatsApp inquire ලින්ක් එකට වෙනස් කරන ලදී */}
                  <a
                    href={`https://wa.me/94711114901?text=${encodeURIComponent(
                      `Hello Chama Travels, I am interested in including "${activity.title}" in my Sri Lanka trip plan!`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-auto inline-flex self-start pt-5 text-sm font-bold text-blue-700 underline underline-offset-4 transition hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    book now →
                  </a>
                </div>
              </article>
            ))}
            </div>

            <button
              type="button"
              aria-label="Previous activity"
              onClick={() => scrollActivities(-1)}
              className="absolute left-2 top-[calc(31.25cqw-14px)] z-10 flex h-11 w-11 items-center justify-center rounded-full border border-blue-200 bg-white/95 text-2xl text-blue-700 shadow-md transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 md:left-0 md:top-1/2 md:-translate-y-1/2"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next activity"
              onClick={() => scrollActivities(1)}
              className="absolute right-2 top-[calc(31.25cqw-14px)] z-10 flex h-11 w-11 items-center justify-center rounded-full border border-blue-200 bg-white/95 text-2xl text-blue-700 shadow-md transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 md:right-0 md:top-1/2 md:-translate-y-1/2"
            >
              ›
            </button>
          </div>
        </div>
      </section>

      {/* ================= DESTINATIONS ================= */}
      <Destinations />

      {/* ================= TOURS ================= */}
      <section
        id="tours"
        className="bg-[radial-gradient(ellipse_at_top,rgba(219,234,254,0.4),transparent_68%)] px-6 py-20 lg:px-8"
      >
        <div className="mx-auto grid max-w-7xl md:grid-cols-[minmax(0,1fr)_auto] md:grid-rows-[auto_auto]">
          <div className="md:col-start-1 md:row-start-1">
            <div className="max-w-2xl">
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-600">
                Featured Tours
              </p>

              <h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">
                Explore Our Sri Lanka Tours
              </h2>
            </div>
          </div>

          <div className="relative mt-12 @container md:col-span-2 md:row-start-2">
            <div
              ref={tourCarouselRef}
              role="region"
              aria-label="Featured Sri Lanka tours"
              aria-roledescription="carousel"
              tabIndex={0}
              onScroll={updateActiveTour}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                  event.preventDefault();
                  moveTour(event.key === "ArrowLeft" ? -1 : 1);
                }
              }}
              className="flex snap-x snap-mandatory items-stretch gap-6 overflow-x-auto overscroll-x-contain py-3 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-4 md:overflow-x-hidden md:snap-none"
            >
              {featuredTours.map((tour, index) => (
                <article
                  key={tour.title}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`Tour ${index + 1} of ${featuredTours.length}: ${tour.title}`}
                  className="group flex min-h-[390px] min-w-0 flex-[0_0_100%] flex-col snap-start overflow-hidden rounded-3xl border border-blue-100/80 bg-white/90 shadow-[0_14px_36px_rgba(15,23,42,0.08)] transition duration-300 ease-out motion-reduce:transition-none md:basis-[calc((100%-3rem)/3)] md:hover:-translate-y-1 md:hover:border-blue-200 md:hover:shadow-[0_20px_45px_rgba(37,99,235,0.14)]"
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                    <Image
                      src={tour.image}
                      alt={tour.imageAlt}
                      width={1000}
                      height={625}
                      loading={index === 0 ? "eager" : "lazy"}
                      sizes="(max-width: 767px) 100vw, (max-width: 1279px) 33vw, 25vw"
                      className="h-full w-full object-cover transition duration-500 ease-out motion-reduce:transition-none md:group-hover:scale-[1.03]"
                    />
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-t from-slate-950/30 via-transparent to-transparent"
                    />
                  </div>

                  <div className="flex flex-1 flex-col bg-white/90 p-6 backdrop-blur-sm sm:p-7">
                    <p className="text-sm font-bold text-blue-700">
                      {tour.days}
                    </p>

                    <h3 className="mt-2 min-h-[3.5rem] text-2xl font-bold leading-tight text-zinc-900">
                      {tour.title}
                    </h3>

                    <a
                      href={`https://wa.me/${whatsappNumber}?text=Hello%20Chama%20Travels%2C%20I%20am%20interested%20in%20the%20${encodeURIComponent(
                        tour.title,
                      )}.`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-auto inline-flex self-start pt-5 font-bold text-blue-700 underline underline-offset-4 transition hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      Enquire Now →
                    </a>
                  </div>
                </article>
              ))}
            </div>

            <div className="pointer-events-none absolute inset-x-2 top-[calc(31.25cqw-10px)] z-10 flex items-center justify-between md:hidden">
              <p className="sr-only" aria-live="polite">
                Tour {activeTourIndex + 1} of {featuredTours.length}
              </p>
              <button
                type="button"
                aria-label="Previous tour"
                onClick={() => moveTour(-1)}
                disabled={activeTourIndex === 0}
                className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border border-blue-200/80 bg-white/85 text-3xl leading-none text-blue-700 shadow-md shadow-blue-950/5 backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:translate-y-0"
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Next tour"
                onClick={() => moveTour(1)}
                disabled={activeTourIndex === featuredTours.length - 1}
                className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border border-blue-200/80 bg-white/85 text-3xl leading-none text-blue-700 shadow-md shadow-blue-950/5 backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:translate-y-0"
              >
                ›
              </button>
            </div>
          </div>

          <a
            href="/tours"
            className="mt-8 inline-flex min-h-12 items-center justify-center justify-self-center px-4 py-3 font-bold text-blue-600 underline underline-offset-4 transition hover:-translate-y-0.5 hover:text-blue-800 md:col-start-2 md:row-start-1 md:mt-0 md:min-h-0 md:self-end md:justify-self-end md:px-0 md:py-0 md:hover:translate-y-0"
          >
            View All Tours →
          </a>
        </div>
      </section>

      {/* ================= ABOUT ================= */}
      <section
        id="about"
        className="relative isolate overflow-hidden bg-white px-4 py-20 sm:px-6 lg:px-8"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[url('/images/aboutimage.jpg')] bg-cover bg-center"
        />
        <div aria-hidden="true" className="absolute inset-0 bg-white/70" />

        <div className="relative z-10 mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-700">
              ABOUT CHAMA TRAVELS
            </p>

            <h2 className="mt-4 text-3xl font-extrabold leading-tight text-zinc-900 sm:text-4xl">
              Travel with a Local Touch
            </h2>

            <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-zinc-600 sm:mt-6 sm:text-lg">
              We provide private tours, airport transfers, vehicle rental and
              customized travel experiences throughout Sri Lanka. Our goal is
              to make every journey comfortable, flexible and memorable.
            </p>
          </div>

          <ul className="mt-10 grid grid-cols-1 md:mt-14 md:grid-cols-2">
            {[
              {
                title: "100% Customizable",
                description:
                  "Your trip, your way. Customize your itinerary, destinations, activities, accommodation, and travel style to match your preferences.",
                icon: "route",
              },
              {
                title: "No Hidden Charges",
                description:
                  "Enjoy transparent and honest pricing. We clearly explain what is included so you can travel with confidence and peace of mind.",
                icon: "receipt",
              },
              {
                title: "Friendly Local Service",
                description:
                  "Our friendly local team is always ready to help, guide, and support you throughout your Sri Lankan journey.",
                icon: "people",
              },
              {
                title: "Private & Comfortable Travel",
                description:
                  "Enjoy private transportation with comfortable, well-maintained vehicles and professional drivers for a relaxed journey.",
                icon: "car",
              },
            ].map((benefit) => (
              <li
                key={benefit.title}
                className="border-b border-blue-100/80 py-7 last:border-b-0 first:pt-0 last:pb-0 md:border-b-0 md:py-9 md:first:pt-9 md:last:pb-9 md:[&:nth-child(odd)]:border-r md:[&:nth-child(odd)]:border-blue-100/80 md:[&:nth-child(-n+2)]:border-b md:[&:nth-child(-n+2)]:border-blue-100/80 md:[&:nth-child(odd)]:pr-8 md:[&:nth-child(even)]:pl-8"
              >
                <div className="group flex gap-5 rounded-xl transition-colors md:px-4 md:py-2">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700 transition-transform duration-300 motion-reduce:transition-none md:group-hover:scale-105">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 32 32"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-8 w-8 stroke-current"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      {benefit.icon === "route" && (
                        <>
                          <circle cx="7" cy="24" r="3" />
                          <circle cx="25" cy="8" r="3" />
                          <path d="M10 24h4a4 4 0 0 0 4-4v-1a4 4 0 0 1 4-4h0" />
                          <path d="m20 11 2 2 2-2" />
                        </>
                      )}
                      {benefit.icon === "receipt" && (
                        <>
                          <path d="M9 4h14v24l-3-2-4 2-4-2-3 2V4Z" />
                          <path d="M12 11h8M12 16h8M12 21h4" />
                        </>
                      )}
                      {benefit.icon === "people" && (
                        <>
                          <circle cx="12" cy="11" r="4" />
                          <path d="M4 27v-2a8 8 0 0 1 16 0v2" />
                          <path d="M21 7a4 4 0 0 1 0 8M24 20a7 7 0 0 1 4 6v1" />
                        </>
                      )}
                      {benefit.icon === "car" && (
                        <>
                          <path d="m5 19 2-7a3 3 0 0 1 3-2h12a3 3 0 0 1 3 2l2 7v6h-3v-3H8v3H5v-6Z" />
                          <path d="M8 17h16M10 21h.01M22 21h.01" />
                        </>
                      )}
                    </svg>
                  </div>

                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-zinc-900 transition-colors md:group-hover:text-blue-700 sm:text-xl">
                      {benefit.title}
                    </h3>
                    <p className="mt-2 text-sm leading-7 text-zinc-600 sm:text-base">
                      {benefit.description}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ================= CUSTOMER REVIEWS ================= */}
      <section
        id="reviews"
        aria-labelledby="reviews-heading"
        className="bg-slate-50 px-4 py-16 sm:px-6 sm:py-20 lg:px-8"
      >
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-700">
              Traveler stories
            </p>
            <h2
              id="reviews-heading"
              className="mt-3 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl"
            >
              WHAT OUR CUSTOMERS SAY
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-600 sm:text-lg">
              Real experiences from travelers who explored Sri Lanka with Chama
              Travels.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-5 border-y border-zinc-200 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <p className="text-3xl font-extrabold text-zinc-900">5.0</p>
              <div>
                <p
                  aria-label="5 out of 5 stars"
                  className="text-lg tracking-wide text-amber-500"
                >
                  <span aria-hidden="true">★★★★★</span>
                </p>
                <p className="text-sm text-zinc-600">
                  Tripadvisor · 9 reviews · Google · 6 reviews
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
              <a
                href={tripAdvisorUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-blue-200 bg-white px-5 py-2 text-sm font-bold text-blue-700 shadow-sm transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                Read Reviews on TripAdvisor →
              </a>
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-blue-700 px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                See Reviews on Google →
              </a>
            </div>
          </div>

          <div className="relative mt-6">
            <div
              ref={reviewCarouselRef}
              role="region"
              aria-label="Customer reviews"
              aria-roledescription="carousel"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                  event.preventDefault();
                  scrollReviews(event.key === "ArrowLeft" ? -1 : 1);
                }
              }}
              className="flex snap-x snap-mandatory items-stretch gap-5 overflow-x-auto overscroll-x-contain scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-4"
            >
              {customerReviews.map((review) => (
                <article
                  key={review.url}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`Review by ${review.author}`}
                  className="flex min-h-[310px] min-w-0 flex-[0_0_100%] snap-start flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.05)] sm:p-6 md:basis-[calc((100%-1.25rem)/2)] xl:basis-[calc((100%-3.75rem)/4)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-700"
                      >
                        {review.author.slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate font-bold text-zinc-900">
                          {review.author}
                        </h3>
                        {review.location && (
                          <p className="mt-0.5 text-xs text-zinc-500">
                            {review.location}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                      Tripadvisor
                    </span>
                  </div>

                  <p
                    aria-label="5 out of 5 stars"
                    className="mt-5 text-sm tracking-wide text-amber-500"
                  >
                    <span aria-hidden="true">★★★★★</span>
                  </p>
                  <h4 className="mt-3 text-base font-bold leading-snug text-zinc-900">
                    {review.title}
                  </h4>
                  <blockquote className="mt-2 flex-1 text-sm leading-6 text-zinc-600">
                    “{review.text}”
                  </blockquote>
                  <a
                    href={review.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Read ${review.author}'s review on TripAdvisor`}
                    className="mt-5 inline-flex min-h-10 items-center self-start text-xs font-bold text-blue-700 underline underline-offset-4 transition hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    TripAdvisor review →
                  </a>
                </article>
              ))}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                aria-label="Previous review"
                onClick={() => scrollReviews(-1)}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-blue-200 bg-white text-2xl text-blue-700 shadow-sm transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Next review"
                onClick={() => scrollReviews(1)}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-blue-200 bg-white text-2xl text-blue-700 shadow-sm transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ================= GALLERY ================= */}
      <section
        id="gallery"
        aria-labelledby="gallery-heading"
        className="bg-slate-50 bg-[radial-gradient(ellipse_at_top,rgba(219,234,254,0.4),transparent_68%)] px-4 py-16 sm:px-6 sm:py-20 lg:px-8"
      >
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-700">
              EXPERIENCE SRI LANKA
            </p>
            <h2
              id="gallery-heading"
              className="mt-3 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl"
            >
              Through Our Journey
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-600 sm:text-lg">
              Explore beautiful moments, breathtaking landscapes and
              unforgettable experiences from travelling around Sri Lanka with
              Chama Travels.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 md:mt-10 md:auto-rows-[150px] md:grid-cols-4">
            {galleryPhotos.map((photo, index) => (
              <figure
                key={photo.src}
                className={`group relative aspect-[4/3] min-w-0 overflow-hidden rounded-2xl bg-slate-100 shadow-[0_10px_28px_rgba(15,23,42,0.07)] md:aspect-auto ${photo.featured ? "md:col-span-2 md:row-span-2" : ""} ${photo.wide ? "md:col-span-2" : ""}`}
              >
                <button
                  type="button"
                  aria-label={`Open larger image: ${photo.alt}`}
                  onClick={() => setActiveGalleryIndex(index)}
                  className="absolute inset-0 block h-full w-full cursor-zoom-in overflow-hidden bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                >
                  <Image
                    src={photo.src}
                    alt={photo.alt}
                    width={1000}
                    height={750}
                    loading="lazy"
                    sizes={
                      photo.featured
                        ? "(max-width: 767px) 50vw, 50vw"
                        : photo.wide
                          ? "(max-width: 767px) 50vw, 50vw"
                          : "(max-width: 767px) 50vw, 25vw"
                    }
                    className="h-full w-full object-cover transition duration-500 ease-out motion-reduce:transition-none md:group-hover:scale-[1.03]"
                  />
                </button>
              </figure>
            ))}
          </div>

          <div className="mt-10 flex justify-center">
            <a
              href="/gallery"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-blue-200 bg-white px-6 py-2.5 text-sm font-bold text-blue-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              More Photos →
            </a>
          </div>
        </div>

        <div
          aria-hidden={!galleryIsOpen}
          inert={!galleryIsOpen}
          onClick={() => setActiveGalleryIndex(null)}
          className={`fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm transition-opacity duration-200 ease-out motion-reduce:transition-none ${galleryIsOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        >
          {activeGalleryIndex !== null && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Gallery image: ${galleryPhotos[activeGalleryIndex].alt}`}
              onClick={(event) => event.stopPropagation()}
              className="relative flex max-h-[90vh] max-w-[94vw] items-center justify-center"
            >
              <button
                type="button"
                aria-label="Close image preview"
                onClick={() => setActiveGalleryIndex(null)}
                className="absolute -right-2 -top-2 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-slate-900/70 text-2xl text-white shadow-lg transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                ×
              </button>

              <button
                type="button"
                aria-label="Previous gallery image"
                onClick={() =>
                  setActiveGalleryIndex((index) =>
                    index === null ? null : Math.max(0, index - 1),
                  )
                }
                disabled={activeGalleryIndex === 0}
                className="absolute left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-slate-900/65 text-2xl text-white shadow-lg transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-35"
              >
                ‹
              </button>

              <Image
                src={galleryPhotos[activeGalleryIndex].src}
                alt={galleryPhotos[activeGalleryIndex].alt}
                width={1600}
                height={1200}
                sizes="92vw"
                className="h-auto max-h-[82vh] w-auto max-w-[92vw] rounded-xl object-contain shadow-2xl"
              />

              <button
                type="button"
                aria-label="Next gallery image"
                onClick={() =>
                  setActiveGalleryIndex((index) =>
                    index === null
                      ? null
                      : Math.min(galleryPhotos.length - 1, index + 1),
                  )
                }
                disabled={activeGalleryIndex === galleryPhotos.length - 1}
                className="absolute right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-slate-900/65 text-2xl text-white shadow-lg transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-35"
              >
                ›
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ================= CONTACT ================= */}
      <section
        id="contact"
        className="relative isolate overflow-hidden px-4 py-20 sm:px-6 lg:px-8"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[url('/images/contactback.jpeg')] bg-cover bg-center"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-slate-950/55"
        />

        <div className="relative z-10 mx-auto max-w-4xl rounded-3xl border border-white/20 bg-white/10 p-5 text-center text-white shadow-xl shadow-black/15 backdrop-blur-md sm:p-9 lg:p-12">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-200">
            Start Your Journey
          </p>

          <h2 className="mt-4 text-3xl font-extrabold leading-tight sm:text-4xl">
            Ready to Explore Sri Lanka?
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/90 sm:text-lg sm:leading-8">
            Tell us what kind of trip you are looking for and we can create a
            customized travel plan for you.
          </p>

          <a
            href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Hello Chama Travels, I would like to plan a trip to Sri Lanka. Please share more details. Thank you.")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex min-h-[52px] w-full items-center justify-center gap-3 rounded-full border border-blue-300/40 bg-blue-600 px-3 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/25 transition hover:-translate-y-0.5 hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 min-[360px]:px-4 sm:w-auto sm:px-8 sm:text-base"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 shrink-0"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4A8 8 0 1 1 20 11.5Z" />
              <path d="M9 8.5c.3-.5.7-.4 1-.1l1.1 1.5c.2.3.1.6-.2.9l-.6.6c.5 1 1.4 1.9 2.4 2.4l.6-.6c.3-.3.6-.4.9-.2l1.5 1.1c.3.3.4.7-.1 1-1 .7-2.1.8-3.4.2-2.1-1-3.8-2.7-4.8-4.8-.6-1.3-.5-2.4.2-3.4Z" />
            </svg>
            <span>Plan My Trip on WhatsApp</span>
          </a>
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
      {/* ================= FOOTER ================= */}
      <Footer />
    </main>
  );
}