"use client";

import { serviceGuaranteesData } from "../servicesData";
import { GuaranteeBadge } from "../types";

export default function ServiceGuarantees() {
  return (
    <section className="bg-slate-900 text-white px-4 py-16 sm:px-6 sm:py-24 lg:px-8 relative overflow-hidden">
      {/* Subtle Background Glows */}
      <div className="absolute top-0 right-1/4 -z-10 h-96 w-96 rounded-full bg-blue-600/15 blur-3xl" />
      <div className="absolute bottom-0 left-1/4 -z-10 h-96 w-96 rounded-full bg-cyan-600/10 blur-3xl" />

      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-400 sm:text-sm">
            Peace of Mind Travel
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-4xl lg:text-5xl">
            Why Choose Us & Service Guarantees
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300 sm:text-base">
            We hold ourselves to the highest standards in Sri Lankan tourism. Here is our
            unwavering commitment to every guest who steps into our vehicles.
          </p>
        </div>

        {/* 4 Core Guarantees Grid */}
        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {serviceGuaranteesData.map((guarantee: GuaranteeBadge) => (
            <div
              key={guarantee.title}
              className="flex flex-col justify-between rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition duration-300 hover:border-blue-400/40 hover:bg-white/10 hover:shadow-2xl hover:shadow-blue-900/20"
            >
              <div>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/20 text-3xl shadow-inner">
                  {guarantee.icon}
                </div>

                <div className="mt-5">
                  <span className="inline-block rounded-md bg-blue-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-300">
                    {guarantee.subHighlight}
                  </span>
                  <h3 className="mt-2 text-lg font-bold leading-snug text-white">
                    {guarantee.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-300">
                    {guarantee.description}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-1.5 text-[11px] font-semibold text-blue-300">
                <span>Verified Guarantee</span>
                <span aria-hidden="true">✓</span>
              </div>
            </div>
          ))}
        </div>

        {/* Trust Badges Strip */}
        <div className="mt-14 rounded-3xl border border-white/10 bg-gradient-to-r from-blue-950/60 via-slate-900/60 to-blue-950/60 p-6 sm:p-8 backdrop-blur-md">
          <div className="grid grid-cols-2 gap-6 text-center md:grid-cols-4">
            <div>
              <p className="text-2xl font-black text-blue-400 sm:text-3xl">100%</p>
              <p className="mt-1 text-xs font-semibold text-zinc-300">
                Transparent Flat Rates
              </p>
            </div>
            <div>
              <p className="text-2xl font-black text-blue-400 sm:text-3xl">SLTDA</p>
              <p className="mt-1 text-xs font-semibold text-zinc-300">
                Certified Chauffeurs
              </p>
            </div>
            <div>
              <p className="text-2xl font-black text-blue-400 sm:text-3xl">24/7</p>
              <p className="mt-1 text-xs font-semibold text-zinc-300">
                Flight Tracking & Support
              </p>
            </div>
            <div>
              <p className="text-2xl font-black text-blue-400 sm:text-3xl">5.0 ★</p>
              <p className="mt-1 text-xs font-semibold text-zinc-300">
                TripAdvisor Excellence
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
