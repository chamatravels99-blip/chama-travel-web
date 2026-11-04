"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Tour } from "../types";

interface TourModalProps {
  tour: Tour | null;
  isOpen: boolean;
  onClose: () => void;
}

const whatsappNumber = "94711114901";

export default function TourModal({ tour, isOpen, onClose }: TourModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<
    "itinerary" | "pricing" | "inclusions" | "booking"
  >("itinerary");

  // Selected vehicle type for customized quote/booking
  const [selectedVehicleType, setSelectedVehicleType] = useState<string | null>(
    null
  );

  // Booking Form State
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    travelDate: "",
    passengers: 2,
    specialRequests: "",
  });

  const [bookingUnavailable, setBookingUnavailable] = useState(false);

  // Lock body scroll and handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) {
          e.preventDefault();
          dialogRef.current.focus();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen || !tour) return null;

  const currentVehicle =
    (selectedVehicleType &&
      tour.vehiclePricing.find((v) => v.vehicleType === selectedVehicleType)) ||
    tour.vehiclePricing[0];

  const handleBookingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setBookingUnavailable(true);
  };

  const whatsappMessage = encodeURIComponent(
    `Hello Chama Travels! I am interested in booking the "${tour.title}" (${tour.duration}).
Vehicle: ${currentVehicle.vehicleType} ($${currentVehicle.totalPriceUSD} USD)
Please let me know availability and how to proceed.`
  );

  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-tour-title"
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto bg-black/80 backdrop-blur-md transition-opacity duration-300"
      onClick={onClose}
    >
      {/* Modal Dialog Content Container */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/20 bg-white text-zinc-900 shadow-2xl transition-all duration-300"
      >
        {/* Header Hero Banner with Image */}
        <div className="relative aspect-21/9 min-h-[190px] w-full overflow-hidden bg-slate-900 sm:min-h-[240px]">
          <Image
            src={tour.image}
            alt={tour.imageAlt}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 1024px"
            className="object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-zinc-950/20"
          />

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close tour details modal"
            className="absolute top-4 right-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-black/50 text-xl font-bold text-white backdrop-blur-md transition hover:bg-white hover:text-black focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-300"
          >
            ✕
          </button>

          {/* Header Information */}
          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7 text-white">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-blue-600 px-3 py-0.5 text-xs font-bold text-white shadow-sm">
                {tour.category}
              </span>
              <span className="rounded-full border border-white/30 bg-white/15 px-3 py-0.5 text-xs font-semibold backdrop-blur-sm">
                {tour.duration}
              </span>
              {tour.badge && (
                <span className="rounded-full bg-amber-500/90 px-3 py-0.5 text-xs font-extrabold text-white">
                  ★ {tour.badge}
                </span>
              )}
            </div>

            <h2
              id="modal-tour-title"
              className="mt-2 text-xl font-black tracking-tight text-white sm:text-3xl"
            >
              {tour.title}
            </h2>

            {/* Route Sequence Pills */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs font-medium text-blue-200">
              <span className="text-white/60">Itinerary Route:</span>
              {tour.routeHighlights.map((stop, i) => (
                <span key={stop} className="inline-flex items-center">
                  <span className="rounded-md bg-white/10 px-2 py-0.5 text-white backdrop-blur-xs">
                    {stop}
                  </span>
                  {i < tour.routeHighlights.length - 1 && (
                    <span className="mx-1 text-blue-300/60">→</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="sticky top-0 z-10 flex border-b border-zinc-200 bg-white/95 px-4 backdrop-blur-sm sm:px-6">
          <nav
            aria-label="Modal section tabs"
            className="flex w-full space-x-2 overflow-x-auto py-2 sm:space-x-6"
          >
            {[
              { id: "itinerary", label: "Day-by-Day Itinerary" },
              { id: "pricing", label: "Transparent Pricing" },
              { id: "inclusions", label: "What's Included & Excluded" },
              { id: "booking", label: "Book Tour / Reserve" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() =>
                  setActiveTab(
                    tab.id as "itinerary" | "pricing" | "inclusions" | "booking"
                  )
                }
                className={`shrink-0 border-b-2 px-3 py-2.5 text-xs font-bold transition sm:text-sm ${
                  activeTab === tab.id
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Scrollable Modal Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7">
          {/* TAB 1: ITINERARY */}
          {activeTab === "itinerary" && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 text-xs leading-relaxed text-zinc-700 sm:text-sm">
                <span className="font-bold text-blue-900">
                  Private & Flexible Experience:
                </span>{" "}
                All itineraries can be fully customized according to your flight
                times, interests, and preferred pace. Your private chauffeur guide
                is at your service throughout each day.
              </div>

              {/* Vertical Timeline UI */}
              <div className="relative pl-6 sm:pl-8">
                {/* Continuous Timeline Line */}
                <div
                  aria-hidden="true"
                  className="absolute top-3 bottom-3 left-2.5 sm:left-3.5 w-0.5 bg-gradient-to-b from-blue-600 via-blue-400 to-blue-200"
                />

                <div className="space-y-8">
                  {tour.itinerary.map((day) => (
                    <div key={day.day} className="relative group">
                      {/* Timeline Dot Indicator */}
                      <div className="absolute -left-6 sm:-left-8 top-1 flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full border-2 border-white bg-blue-600 text-[11px] font-black text-white shadow-md shadow-blue-500/30 ring-2 ring-blue-100">
                        {day.day}
                      </div>

                      <div className="rounded-2xl border border-zinc-100 bg-white p-4 sm:p-5 shadow-xs transition group-hover:border-blue-200 group-hover:shadow-md">
                        {/* Day Header */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                            Day {day.day}
                          </span>
                          {day.travelTime && (
                            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-600">
                              ⏱ {day.travelTime}
                            </span>
                          )}
                        </div>

                        <h3 className="mt-1 text-base font-bold text-zinc-900 sm:text-lg">
                          {day.title}
                        </h3>

                        {/* Route Pin */}
                        <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-blue-700">
                          <svg
                            className="h-3.5 w-3.5 shrink-0"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                            <circle cx="12" cy="9" r="2.5" />
                          </svg>
                          <span>{day.route}</span>
                        </p>

                        {/* Description */}
                        <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-zinc-600">
                          {day.description}
                        </p>

                        {/* Key Activities Checklist */}
                        {day.activities && day.activities.length > 0 && (
                          <div className="mt-3.5 border-t border-zinc-100 pt-3">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                              Activities & Highlights:
                            </p>
                            <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                              {day.activities.map((act) => (
                                <li
                                  key={act}
                                  className="flex items-start gap-2 text-xs text-zinc-700"
                                >
                                  <span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[9px] font-bold text-blue-700">
                                    ✓
                                  </span>
                                  <span>{act}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Overnight Location */}
                        {day.overnightLocation && (
                          <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1 text-xs font-semibold text-zinc-700">
                            <span>🏨 Overnight:</span>
                            <span className="font-bold text-zinc-900">
                              {day.overnightLocation}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PRICING BREAKDOWN */}
          {activeTab === "pricing" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-extrabold text-zinc-900 sm:text-xl">
                  Transparent All-Inclusive Vehicle Pricing
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-zinc-600">
                  Select your preferred vehicle option below. Rates are per
                  vehicle (not per person), including your private dedicated
                  driver, fuel, highway tolls, and driver lodging.
                </p>
              </div>

              {/* Vehicle Options Cards */}
              <div className="grid gap-4 sm:grid-cols-3">
                {tour.vehiclePricing.map((veh) => {
                  const isSelected =
                    currentVehicle.vehicleType === veh.vehicleType;

                  return (
                    <div
                      key={veh.vehicleType}
                      onClick={() => setSelectedVehicleType(veh.vehicleType)}
                      className={`relative flex flex-col justify-between rounded-2xl p-5 text-left transition duration-200 cursor-pointer ${
                        isSelected
                          ? "border-2 border-blue-600 bg-blue-50/60 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500"
                          : "border border-zinc-200 bg-white hover:border-blue-300 hover:shadow-sm"
                      }`}
                    >
                      {isSelected && (
                        <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-black text-white">
                          ✓
                        </span>
                      )}

                      <div>
                        <h4 className="text-sm font-extrabold text-zinc-900 sm:text-base">
                          {veh.vehicleType}
                        </h4>
                        <p className="mt-1 text-xs text-zinc-500">
                          {veh.recommendedFor}
                        </p>

                        <div className="mt-4 space-y-2 text-xs text-zinc-700">
                          <div className="flex items-center gap-2">
                            <span>👥</span>
                            <span className="font-medium">
                              {veh.paxCapacity}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span>🧳</span>
                            <span className="font-medium">
                              {veh.luggageCapacity}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span>⏱</span>
                            <span className="font-medium">
                              ~${veh.perDayUSD} / Day
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 border-t border-zinc-200/80 pt-4">
                        <div className="text-xs text-zinc-500">Total Vehicle Rate:</div>
                        <div className="text-2xl font-black text-zinc-900">
                          ${veh.totalPriceUSD}{" "}
                          <span className="text-xs font-semibold text-zinc-500">
                            USD
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedVehicleType(veh.vehicleType);
                          }}
                          className={`mt-3 w-full rounded-full py-2 text-xs font-bold transition ${
                            isSelected
                              ? "bg-blue-600 text-white"
                              : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                          }`}
                        >
                          {isSelected ? "Selected Option" : "Select Vehicle"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pricing Guarantee Banner */}
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-xs sm:text-sm text-emerald-900">
                <p className="font-bold">
                  ✓ The Chama Travels No-Surprise Guarantee:
                </p>
                <p className="mt-1 leading-relaxed text-emerald-800">
                  Zero hidden extras. Fuel charges, highway expressway tolls,
                  parking fees, airport pickups, and driver overnight lodging are
                  always 100% covered in the price above.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: INCLUSIONS & EXCLUSIONS */}
          {activeTab === "inclusions" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-extrabold text-zinc-900 sm:text-xl">
                  What is Included & Excluded
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-zinc-600">
                  We believe in total transparency so you can travel Sri Lanka
                  with full peace of mind.
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* INCLUSIONS */}
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                      ✓
                    </span>
                    <h4 className="text-base font-extrabold text-emerald-950">
                      What&apos;s Included
                    </h4>
                  </div>
                  <ul className="mt-4 space-y-3">
                    {tour.inclusions.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2.5 text-xs sm:text-sm text-zinc-700"
                      >
                        <span className="mt-0.5 text-emerald-600 font-bold shrink-0">
                          ✓
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* EXCLUSIONS */}
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-400 text-xs font-bold text-white">
                      ✕
                    </span>
                    <h4 className="text-base font-extrabold text-zinc-800">
                      What&apos;s Excluded
                    </h4>
                  </div>
                  <ul className="mt-4 space-y-3">
                    {tour.exclusions.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2.5 text-xs sm:text-sm text-zinc-600"
                      >
                        <span className="mt-0.5 text-zinc-400 font-bold shrink-0">
                          ✕
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5 rounded-xl border border-zinc-200 bg-white p-3 text-xs text-zinc-500">
                    <span className="font-semibold text-zinc-700">Need accommodation?</span>{" "}
                    We partner with verified 3-star, 4-star, and 5-star boutique
                    villas across Sri Lanka and can bundle hotels at wholesale
                    discounts upon request.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: BOOKING / RESERVATION */}
          {activeTab === "booking" && (
            <div className="space-y-6">
              {bookingUnavailable ? (
                <div className="rounded-3xl border border-amber-200 bg-amber-50/60 p-8 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500 text-3xl text-white shadow-lg shadow-amber-600/30">
                    !
                  </div>
                  <h3 className="mt-4 text-2xl font-black text-amber-950">
                    Online Booking Unavailable
                  </h3>
                  <p className="mx-auto mt-2 max-w-md text-sm text-amber-900">
                    Your details have not been submitted. Continue on WhatsApp to
                    discuss availability and send your tour inquiry.
                  </p>

                  <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-[#20bd5a]"
                    >
                      <span>Continue to WhatsApp</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => setBookingUnavailable(false)}
                      className="rounded-full border border-amber-300 bg-white px-6 py-3 text-sm font-bold text-amber-900 hover:bg-amber-100"
                    >
                      Back to Form
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div>
                    <h3 className="text-lg font-extrabold text-zinc-900 sm:text-xl">
                      Reserve Your Tour with Chama Travels
                    </h3>
                    <p className="mt-1 text-xs sm:text-sm text-zinc-600">
                      Online booking is not connected yet. Use WhatsApp to contact us
                      about availability; submitting this form will not send your details.
                    </p>
                  </div>

                  <form onSubmit={handleBookingSubmit} className="mt-5 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="tour-full-name" className="block text-xs font-bold text-zinc-700">
                          Full Name *
                        </label>
                        <input
                          type="text"
                          id="tour-full-name"
                          required
                          value={formData.fullName}
                          onChange={(e) =>
                            setFormData({ ...formData, fullName: e.target.value })
                          }
                          placeholder="e.g. John Smith"
                          className="mt-1 w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-xs sm:text-sm text-zinc-900 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>

                      <div>
                        <label htmlFor="tour-email" className="block text-xs font-bold text-zinc-700">
                          Email Address *
                        </label>
                        <input
                          type="email"
                          id="tour-email"
                          required
                          value={formData.email}
                          onChange={(e) =>
                            setFormData({ ...formData, email: e.target.value })
                          }
                          placeholder="john@example.com"
                          className="mt-1 w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-xs sm:text-sm text-zinc-900 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <label htmlFor="tour-phone" className="block text-xs font-bold text-zinc-700">
                          WhatsApp / Phone *
                        </label>
                        <input
                          type="tel"
                          id="tour-phone"
                          required
                          value={formData.phone}
                          onChange={(e) =>
                            setFormData({ ...formData, phone: e.target.value })
                          }
                          placeholder="+44 7123 456789"
                          className="mt-1 w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-xs sm:text-sm text-zinc-900 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>

                      <div>
                        <label htmlFor="tour-travel-date" className="block text-xs font-bold text-zinc-700">
                          Preferred Travel Date *
                        </label>
                        <input
                          type="date"
                          id="tour-travel-date"
                          required
                          value={formData.travelDate}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              travelDate: e.target.value,
                            })
                          }
                          className="mt-1 w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-xs sm:text-sm text-zinc-900 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>

                      <div>
                        <label htmlFor="tour-passengers" className="block text-xs font-bold text-zinc-700">
                          Passengers *
                        </label>
                        <input
                          type="number"
                          id="tour-passengers"
                          min="1"
                          max="20"
                          required
                          value={formData.passengers}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              passengers: Number(e.target.value),
                            })
                          }
                          className="mt-1 w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-xs sm:text-sm text-zinc-900 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="tour-vehicle" className="block text-xs font-bold text-zinc-700">
                        Selected Vehicle
                      </label>
                      <select
                        id="tour-vehicle"
                        value={currentVehicle.vehicleType}
                        onChange={(e) => {
                          const matched = tour.vehiclePricing.find(
                            (v) => v.vehicleType === e.target.value
                          );
                          if (matched) setSelectedVehicleType(matched.vehicleType);
                        }}
                        className="mt-1 w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-xs sm:text-sm text-zinc-900 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                      >
                        {tour.vehiclePricing.map((veh) => (
                          <option key={veh.vehicleType} value={veh.vehicleType}>
                            {veh.vehicleType} (${veh.totalPriceUSD} USD -{" "}
                            {veh.paxCapacity})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="tour-special-requests" className="block text-xs font-bold text-zinc-700">
                        Special Requests or Flight Numbers (Optional)
                      </label>
                      <textarea
                        id="tour-special-requests"
                        rows={3}
                        value={formData.specialRequests}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            specialRequests: e.target.value,
                          })
                        }
                        placeholder="e.g. Flight arrives at 8 AM, traveling with a toddler, need child seat..."
                        className="mt-1 w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-xs sm:text-sm text-zinc-900 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        className="w-full rounded-full bg-blue-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-500 disabled:opacity-50"
                      >
                        Show WhatsApp Option
                      </button>
                      <p className="mt-2 text-center text-[11px] text-zinc-500">
                        Your booking details are not sent by this form.
                      </p>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Bottom Sticky Action Bar */}
        <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 bg-white/95 px-5 py-4 backdrop-blur-md sm:px-7">
          {/* Rate Summary */}
          <div>
            <div className="text-xs font-medium text-zinc-500">
              {currentVehicle.vehicleType}:
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-zinc-900 sm:text-2xl">
                ${currentVehicle.totalPriceUSD}
              </span>
              <span className="text-xs font-bold text-zinc-500">
                USD Total ({tour.duration})
              </span>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* WhatsApp Direct Inquiry */}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#25D366] bg-[#25D366]/10 px-4 py-2.5 text-xs font-bold text-[#128C7E] transition hover:bg-[#25D366] hover:text-white sm:text-sm"
            >
              <svg
                className="h-4 w-4 fill-current"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2M12.05 3.67c2.2 0 4.26.86 5.82 2.42a8.21 8.21 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23-1.48 0-2.93-.39-4.19-1.15l-.3-.17-3.12.82.83-3.04-.2-.32a8.19 8.19 0 0 1-1.26-4.38c.01-4.54 3.7-8.24 8.25-8.24m-3.52 3.66c-.16 0-.43.06-.66.31-.22.25-.87.86-.87 2.07 0 1.22.89 2.39 1 2.56.14.17 1.76 2.67 4.25 3.73.59.27 1.05.42 1.41.53.59.19 1.13.16 1.56.1.48-.07 1.46-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.07-.1-.23-.16-.48-.29s-1.47-.72-1.69-.8c-.23-.08-.37-.12-.56.12-.16.25-.64.81-.78.97-.15.17-.29.19-.53.07-.26-.13-1.06-.39-2.02-1.23-.74-.66-1.23-1.47-1.38-1.72-.12-.24-.01-.37.11-.48.11-.11.25-.29.37-.44.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.43s-.52-1.24-.73-1.73c-.2-.48-.4-.42-.56-.43-.14 0-.3-.01-.47-.01Z" />
              </svg>
              <span>Ask on WhatsApp</span>
            </a>

            {/* Book Tour Now Button */}
            <button
              type="button"
              onClick={() => setActiveTab("booking")}
              className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-600/30 transition hover:bg-blue-500 sm:text-sm"
            >
              <span>Book Tour Now</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
