"use client";

import Image from "next/image";
import { fleetVehiclesData, whatsappNumber } from "../servicesData";
import { FleetVehicle, VehicleCategory } from "../types";

interface FleetShowcaseProps {
  onSelectVehicleForQuote: (vehicleCategory: VehicleCategory) => void;
}

export default function FleetShowcase({ onSelectVehicleForQuote }: FleetShowcaseProps) {
  return (
    <section
      id="fleet-showcase"
      className="bg-white px-4 py-16 sm:px-6 sm:py-24 lg:px-8 border-t border-zinc-200/80"
    >
      <div className="mx-auto max-w-7xl">
        {/* Section Heading */}
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-600 sm:text-sm">
            Our Modern Chauffeur Fleet
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-zinc-900 sm:text-4xl lg:text-5xl">
            Choose Your Vehicle for Sri Lanka
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 sm:text-base">
            Every vehicle in our fleet is fully air-conditioned, commercially insured,
            scrupulously clean, and driven by a licensed English-speaking professional chauffeur.
          </p>
        </div>

        {/* Vehicle Cards Grid */}
        <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-3">
          {fleetVehiclesData.map((vehicle: FleetVehicle) => (
            <div
              key={vehicle.id}
              className="group flex flex-col justify-between overflow-hidden rounded-3xl border border-zinc-200/90 bg-white shadow-sm transition duration-300 hover:-translate-y-1.5 hover:border-blue-300 hover:shadow-xl"
            >
              <div>
                {/* Vehicle Image Container */}
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-zinc-900">
                  <Image
                    src={vehicle.image}
                    alt={vehicle.imageAlt}
                    fill
                    sizes="(max-width: 1024px) 100vw, 33vw"
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute top-3.5 left-3.5 rounded-full border border-white/20 bg-blue-600/90 px-3 py-1 text-xs font-bold text-white shadow-md backdrop-blur-md">
                    {vehicle.tag}
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-6 sm:p-7">
                  <h3 className="text-xl font-black text-zinc-900 sm:text-2xl">
                    {vehicle.name}
                  </h3>
                  <p className="mt-1 text-xs font-semibold text-blue-600">
                    {vehicle.models}
                  </p>

                  {/* Best For Badge */}
                  <div className="mt-3.5 inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
                    <span>🎯</span>
                    <span>Best for: {vehicle.bestFor}</span>
                  </div>

                  {/* Vehicle Spec Grid with SVG Icons */}
                  <div className="mt-6 grid grid-cols-2 gap-3 rounded-2xl border border-zinc-100 bg-zinc-50/80 p-3.5 text-xs text-zinc-700">
                    {/* Passengers */}
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white shadow-xs text-blue-600 font-bold">
                        👥
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                          Capacity
                        </p>
                        <p className="font-bold text-zinc-900">{vehicle.passengers}</p>
                      </div>
                    </div>

                    {/* Luggage */}
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white shadow-xs text-blue-600 font-bold">
                        🧳
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                          Luggage
                        </p>
                        <p className="font-bold text-zinc-900 truncate">{vehicle.luggage}</p>
                      </div>
                    </div>

                    {/* Air Conditioning */}
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white shadow-xs text-blue-600 font-bold">
                        ❄️
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                          A/C System
                        </p>
                        <p className="font-bold text-zinc-900">{vehicle.acType}</p>
                      </div>
                    </div>

                    {/* Driver & Status */}
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white shadow-xs text-blue-600 font-bold">
                        🛡️
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                          Safety
                        </p>
                        <p className="font-bold text-zinc-900">100% Insured</p>
                      </div>
                    </div>
                  </div>

                  {/* Key Features Checklist */}
                  <div className="mt-6">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900">
                      Standard Inclusions & Comfort:
                    </h4>
                    <ul className="mt-3 space-y-2 text-xs text-zinc-600">
                      {vehicle.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-blue-600 font-bold shrink-0">✓</span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Action Buttons Footer */}
              <div className="p-6 pt-0 space-y-2.5">
                {/* Drawer Booking Button */}
                <button
                  type="button"
                  onClick={() => onSelectVehicleForQuote(vehicle.category)}
                  className="w-full cursor-pointer rounded-full bg-blue-600 py-3 text-center text-xs font-bold text-white shadow-md shadow-blue-900/20 transition hover:bg-blue-500 sm:text-sm"
                >
                  Select & Request Quote
                </button>

                {/* Direct Pre-populated WhatsApp Reservation Button */}
                <a
                  href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
                    vehicle.whatsappMessage
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-full border border-[#25D366]/40 bg-white py-2.5 text-center text-xs font-bold text-[#1f9b4c] transition hover:bg-[#25D366] hover:text-white"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-4 w-4"
                  >
                    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2M12.05 3.67c2.2 0 4.26.86 5.82 2.42a8.21 8.21 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23-1.48 0-2.93-.39-4.19-1.15l-.3-.17-3.12.82.83-3.04-.2-.32a8.19 8.19 0 0 1-1.26-4.38c.01-4.54 3.7-8.24 8.25-8.24m-3.52 3.66c-.16 0-.43.06-.66.31-.22.25-.87.86-.87 2.07 0 1.22.89 2.39 1 2.56.14.17 1.76 2.67 4.25 3.73.59.27 1.05.42 1.41.53.59.19 1.13.16 1.56.1.48-.07 1.46-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.07-.1-.23-.16-.48-.29s-1.47-.72-1.69-.8c-.23-.08-.37-.12-.56.12-.16.25-.64.81-.78.97-.15.17-.29.19-.53.07-.26-.13-1.06-.39-2.02-1.23-.74-.66-1.23-1.47-1.38-1.72-.12-.24-.01-.37.11-.48.11-.11.25-.29.37-.44.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.43s-.52-1.24-.73-1.73c-.2-.48-.4-.42-.56-.43-.14 0-.3-.01-.47-.01Z" />
                  </svg>
                  <span>Inquire / Reserve via WhatsApp</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
