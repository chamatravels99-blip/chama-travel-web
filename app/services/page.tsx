"use client";

import { useState } from "react";
import Footer from "../components/Footer";
import ToursNavbar from "../tours/components/ToursNavbar";
import CoreServices from "./components/CoreServices";
import FleetShowcase from "./components/FleetShowcase";
import QuickQuoteDrawer from "./components/QuickQuoteDrawer";
import ServiceGuarantees from "./components/ServiceGuarantees";
import ServicesFAQ from "./components/ServicesFAQ";
import { whatsappNumber } from "./servicesData";
import { ServiceType, VehicleCategory } from "./types";

export default function ServicesPage() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceType>("Airport Transfers");
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleCategory>(
    "Sedan (Toyota Axio/Prius)"
  );

  const handleOpenDrawerWithService = (serviceType: ServiceType) => {
    setSelectedService(serviceType);
    setIsDrawerOpen(true);
  };

  const handleOpenDrawerWithVehicle = (vehicleCategory: VehicleCategory) => {
    setSelectedVehicle(vehicleCategory);
    setIsDrawerOpen(true);
  };

  const handleOpenGenericDrawer = () => {
    setIsDrawerOpen(true);
  };

  return (
    <div className="min-h-screen bg-white text-zinc-900 flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Shared Glassmorphic Header Navigation */}
      <ToursNavbar activePage="Services" />

      {/* LIGHT DESIGN HERO BANNER */}
      <section className="relative flex min-h-[50vh] items-center justify-center overflow-hidden pt-28 pb-16">
        <div className="absolute inset-0 bg-[url('/images/birds.jpg?auto=compress&cs=tinysrgb&w=2000')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-slate-900/60" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-slate-900/40 to-blue-900/20" />

        <div className="relative z-10 mx-auto max-w-4xl px-4 text-center">
          <span className="inline-block rounded-full border border-white/30 bg-white/20 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white backdrop-blur-md shadow-md">
            Chauffeur & Fleet Services
          </span>

          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
            Transport & Tour <br />
            <span className="text-blue-200">Services</span>
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-base sm:text-lg text-slate-100">
            Professional private driver-guide services, flat-rate airport transfers, and fully insured air-conditioned vehicles across Sri Lanka.
          </p>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="flex-1">
        {/* Core Services Breakdown Section */}
        <CoreServices onSelectServiceForQuote={handleOpenDrawerWithService} />

        {/* Our Fleet Showcase (Vehicles Available) */}
        <FleetShowcase onSelectVehicleForQuote={handleOpenDrawerWithVehicle} />

        {/* Why Choose Us & Service Guarantee Badges */}
        <ServiceGuarantees />

        {/* High-Converting Bottom CTA Banner */}
        <section className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 px-4 py-16 text-white sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-5xl rounded-3xl border border-white/20 bg-white/10 p-8 text-center shadow-2xl backdrop-blur-md sm:p-12">
            <span className="inline-block rounded-full bg-white/20 px-4 py-1 text-xs font-bold uppercase tracking-widest text-blue-100">
              Instant Dispatch & Route Consultation
            </span>
            <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
              Ready to Book Your Transfer or Private Vehicle?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-blue-100 sm:text-base">
              Share your flight schedule, travel dates, or dream itinerary with us.
              We provide fixed transparent quotes within minutes with zero hidden fees.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3.5 sm:flex-row sm:gap-4">
              <button
                type="button"
                onClick={handleOpenGenericDrawer}
                className="w-full cursor-pointer rounded-full bg-white px-8 py-3.5 text-center text-sm font-black text-blue-700 shadow-xl transition hover:bg-blue-50 sm:w-auto"
              >
                Request Quote via Form →
              </button>

              <a
                href={`https://wa.me/${whatsappNumber}?text=Hello%20Chama%20Travels%2C%20I%20would%20like%20to%20get%20a%20quote%20for%20private%20vehicle%20hire%20and%20airport%20transfer.`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-full border border-white/40 bg-[#25D366] px-8 py-3.5 text-center text-sm font-bold text-white shadow-lg transition hover:bg-[#20bd5a] sm:w-auto"
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
        </section>

        {/* Services FAQ */}
        <ServicesFAQ />
      </main>

      {/* Interactive Booking / Quick Quote CTA Drawer */}
      <QuickQuoteDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        initialServiceType={selectedService}
        initialVehicleCategory={selectedVehicle}
      />

      {/* Floating WhatsApp Quick Action Button */}
      <a
        href={`https://wa.me/${whatsappNumber}?text=Hello%20Chama%20Travels%2C%20I%20am%20browsing%20your%20services%20page%20and%20would%20like%20to%20inquire.`}
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
