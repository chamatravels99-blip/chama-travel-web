"use client";

import { useEffect, useRef, useState } from "react";
import { whatsappNumber } from "../servicesData";
import { QuickQuoteFormState, ServiceType, VehicleCategory } from "../types";

interface QuickQuoteDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialServiceType?: ServiceType;
  initialVehicleCategory?: VehicleCategory;
}

export default function QuickQuoteDrawer({
  isOpen,
  onClose,
  initialServiceType = "Airport Transfers",
  initialVehicleCategory = "Sedan (Toyota Axio/Prius)",
}: QuickQuoteDrawerProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState<QuickQuoteFormState>({
    serviceType: initialServiceType,
    vehicleType: initialVehicleCategory,
    fullName: "",
    email: "",
    whatsapp: "",
    pickupLocation: "",
    dropoffLocation: "",
    travelDate: "",
    flightNumber: "",
    passengers: "2",
    luggage: "2",
    specialRequests: "",
  });

  const [showWhatsAppHandoff, setShowWhatsAppHandoff] = useState(false);

  // Sync state if initial props change
  const [prevServiceType, setPrevServiceType] = useState(initialServiceType);
  const [prevVehicleCategory, setPrevVehicleCategory] = useState(initialVehicleCategory);

  if (initialServiceType !== prevServiceType) {
    setPrevServiceType(initialServiceType);
    setFormData((prev) => ({ ...prev, serviceType: initialServiceType }));
  }

  if (initialVehicleCategory !== prevVehicleCategory) {
    setPrevVehicleCategory(initialVehicleCategory);
    setFormData((prev) => ({ ...prev, vehicleType: initialVehicleCategory }));
  }

  // Handle ESC key and lock body scroll
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
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
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [isOpen, onClose]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const generateWhatsAppMessage = () => {
    const lines = [
      `*New Quote Request - Chama Travels*`,
      `*Service:* ${formData.serviceType}`,
      `*Vehicle Preference:* ${formData.vehicleType}`,
      `*Name:* ${formData.fullName || "Not provided"}`,
      `*Contact:* ${formData.whatsapp || "Not provided"}`,
      formData.email ? `*Email:* ${formData.email}` : "",
      formData.pickupLocation ? `*Pickup:* ${formData.pickupLocation}` : "",
      formData.dropoffLocation ? `*Destination:* ${formData.dropoffLocation}` : "",
      formData.travelDate ? `*Date:* ${formData.travelDate}` : "",
      formData.flightNumber ? `*Flight #:* ${formData.flightNumber}` : "",
      `*Pax:* ${formData.passengers} | *Bags:* ${formData.luggage}`,
      formData.specialRequests ? `*Notes:* ${formData.specialRequests}` : "",
    ].filter(Boolean);

    return lines.join("\n");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowWhatsAppHandoff(true);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 overflow-hidden"
    >
      {/* Backdrop overlay with blur */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
      />

      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-lg transform overflow-y-auto bg-white p-6 shadow-2xl transition-all sm:p-8">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-100 pb-5">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-blue-600">
                Chama Travels • Quick Quote
              </span>
              <h2 id="drawer-title" className="text-xl font-black text-zinc-900 sm:text-2xl">
                Request Service or Vehicle
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close quote drawer"
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-zinc-100 text-lg font-bold text-zinc-600 transition hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              ✕
            </button>
          </div>

          {showWhatsAppHandoff ? (
            <div className="py-12 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-3xl text-amber-700">
                !
              </div>
              <h3 className="mt-4 text-xl font-black text-zinc-900">
                Online Submission Unavailable
              </h3>
              <p className="mt-2 text-sm text-zinc-600">
                Your inquiry has not been sent because online submissions are not
                connected yet. Continue to WhatsApp to send your request directly.
              </p>

              <div className="mt-8 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-left text-xs text-zinc-700">
                <p className="font-bold text-zinc-900 mb-1">Inquiry Summary:</p>
                <p>• Service: {formData.serviceType}</p>
                <p>• Vehicle: {formData.vehicleType}</p>
                {formData.travelDate && <p>• Date: {formData.travelDate}</p>}
                {formData.pickupLocation && <p>• Route: {formData.pickupLocation} → {formData.dropoffLocation || "Islandwide"}</p>}
              </div>

              <div className="mt-8 space-y-3">
                <a
                  href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
                    generateWhatsAppMessage()
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] py-3 text-sm font-bold text-white shadow-md hover:bg-[#20bd5a] transition"
                >
                  <span>Chat on WhatsApp Directly</span>
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setShowWhatsAppHandoff(false);
                    onClose();
                  }}
                  className="w-full rounded-full border border-zinc-300 py-3 text-sm font-bold text-zinc-700 hover:bg-zinc-100 transition"
                >
                  Close Drawer
                </button>
              </div>
            </div>
          ) : (
            /* Main Form */
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {/* Direct WhatsApp Instant Quote Notice */}
              <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs text-emerald-900">
                <div className="flex items-center gap-2">
                  <span className="text-base">⚡</span>
                  <span>Need an immediate price?</span>
                </div>
                <a
                  href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
                    generateWhatsAppMessage()
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-emerald-700 underline hover:text-emerald-900"
                >
                  Instant WhatsApp
                </a>
              </div>

              {/* Service Type */}
              <div>
                <label htmlFor="quote-service-type" className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
                  Service Required *
                </label>
                <select
                  name="serviceType"
                  id="quote-service-type"
                  value={formData.serviceType}
                  onChange={handleChange}
                  required
                  className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                >
                  <option value="Airport Transfers">Airport Transfers (BIA / Mattala)</option>
                  <option value="Islandwide Private Vehicle Hire">Islandwide Private Vehicle Hire</option>
                  <option value="Customized Sri Lanka Round Tours">Customized Sri Lanka Round Tours</option>
                  <option value="Day Trips & Excursions">Day Trips & Excursions</option>
                </select>
              </div>

              {/* Vehicle Preference */}
              <div>
                <label htmlFor="quote-vehicle-type" className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
                  Vehicle Preference
                </label>
                <select
                  name="vehicleType"
                  id="quote-vehicle-type"
                  value={formData.vehicleType}
                  onChange={handleChange}
                  className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                >
                  <option value="Sedan (Toyota Axio/Prius)">Sedan (1-3 Pax) - Toyota Axio / Prius</option>
                  <option value="Spacious Passenger Van (Toyota KDH)">Spacious Passenger Van (4-8 Pax) - Toyota KDH</option>
                  <option value="Mini Bus / Coaster (9-14 Pax)">Mini Bus / Coaster (9-14 Pax)</option>
                  <option value="Unsure / Need Advice">Unsure / Recommend best option for me</option>
                </select>
              </div>

              {/* Full Name & WhatsApp Phone */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="quote-full-name" className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    id="quote-full-name"
                    required
                    placeholder="e.g. Sarah Jenkins"
                    value={formData.fullName}
                    onChange={handleChange}
                    className="mt-1.5 w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="quote-whatsapp" className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
                    WhatsApp / Phone *
                  </label>
                  <input
                    type="tel"
                    name="whatsapp"
                    id="quote-whatsapp"
                    required
                    placeholder="+44 7911 123456"
                    value={formData.whatsapp}
                    onChange={handleChange}
                    className="mt-1.5 w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label htmlFor="quote-email" className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  id="quote-email"
                  placeholder="name@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  className="mt-1.5 w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                />
              </div>

              {/* Pickup & Dropoff */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="quote-pickup-location" className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
                    Pickup Location *
                  </label>
                  <input
                    type="text"
                    name="pickupLocation"
                    id="quote-pickup-location"
                    required
                    placeholder="e.g. CMB Airport / Colombo hotel"
                    value={formData.pickupLocation}
                    onChange={handleChange}
                    className="mt-1.5 w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="quote-dropoff-location" className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
                    Drop-off / Destination
                  </label>
                  <input
                    type="text"
                    name="dropoffLocation"
                    id="quote-dropoff-location"
                    placeholder="e.g. Kandy / Galle / Round trip"
                    value={formData.dropoffLocation}
                    onChange={handleChange}
                    className="mt-1.5 w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  />
                </div>
              </div>

              {/* Date & Flight Number */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="quote-travel-date" className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
                    Travel / Arrival Date *
                  </label>
                  <input
                    type="date"
                    name="travelDate"
                    id="quote-travel-date"
                    required
                    value={formData.travelDate}
                    onChange={handleChange}
                    className="mt-1.5 w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="quote-flight-number" className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
                    Flight Number (if airport)
                  </label>
                  <input
                    type="text"
                    name="flightNumber"
                    id="quote-flight-number"
                    placeholder="e.g. UL 504 / EK 650"
                    value={formData.flightNumber}
                    onChange={handleChange}
                    className="mt-1.5 w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  />
                </div>
              </div>

              {/* Passengers & Luggage */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="quote-passengers" className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
                    Passengers
                  </label>
                  <input
                    type="number"
                    name="passengers"
                    id="quote-passengers"
                    min="1"
                    max="50"
                    value={formData.passengers}
                    onChange={handleChange}
                    className="mt-1.5 w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="quote-luggage" className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
                    Suitcases
                  </label>
                  <input
                    type="number"
                    name="luggage"
                    id="quote-luggage"
                    min="0"
                    max="50"
                    value={formData.luggage}
                    onChange={handleChange}
                    className="mt-1.5 w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  />
                </div>
              </div>

              {/* Special Requests */}
              <div>
                <label htmlFor="quote-special-requests" className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
                  Special Notes / Itinerary Requests
                </label>
                <textarea
                  name="specialRequests"
                  id="quote-special-requests"
                  rows={2}
                  placeholder="Any baby seats needed, extra luggage, spontaneous stop requests..."
                  value={formData.specialRequests}
                  onChange={handleChange}
                  className="mt-1.5 w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                />
              </div>

              {/* Buttons */}
              <div className="pt-2 space-y-3">
                <button
                  type="submit"
                  className="w-full cursor-pointer rounded-full bg-blue-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-900/30 transition hover:bg-blue-500 disabled:opacity-50"
                >
                  Show Contact Options
                </button>

                <a
                  href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
                    generateWhatsAppMessage()
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-full border border-[#25D366]/50 bg-white py-3 text-sm font-bold text-[#1a8b43] transition hover:bg-[#25D366] hover:text-white"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-4 w-4"
                  >
                    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2M12.05 3.67c2.2 0 4.26.86 5.82 2.42a8.21 8.21 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23-1.48 0-2.93-.39-4.19-1.15l-.3-.17-3.12.82.83-3.04-.2-.32a8.19 8.19 0 0 1-1.26-4.38c.01-4.54 3.7-8.24 8.25-8.24m-3.52 3.66c-.16 0-.43.06-.66.31-.22.25-.87.86-.87 2.07 0 1.22.89 2.39 1 2.56.14.17 1.76 2.67 4.25 3.73.59.27 1.05.42 1.41.53.59.19 1.13.16 1.56.1.48-.07 1.46-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.07-.1-.23-.16-.48-.29s-1.47-.72-1.69-.8c-.23-.08-.37-.12-.56.12-.16.25-.64.81-.78.97-.15.17-.29.19-.53.07-.26-.13-1.06-.39-2.02-1.23-.74-.66-1.23-1.47-1.38-1.72-.12-.24-.01-.37.11-.48.11-.11.25-.29.37-.44.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.43s-.52-1.24-.73-1.73c-.2-.48-.4-.42-.56-.43-.14 0-.3-.01-.47-.01Z" />
                  </svg>
                  <span>Send via WhatsApp Directly</span>
                </a>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
