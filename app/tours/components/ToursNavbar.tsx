"use client";

import Link from "next/link";
import { useState } from "react";

const whatsappNumber = "94711114901";

interface ToursNavbarProps {
  activePage?: "Home" | "Tours" | "Activities" | "Destinations" | "Services" | "About Us" | "Contact" | string;
}

export default function ToursNavbar({ activePage = "Tours" }: ToursNavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const navLinks = [
  { label: "Home", href: "/" },
  { label: "Tours", href: "/tours" },
  { label: "Services", href: "/services" },
  { label: "Activities", href: "/activities" },
  { label: "Destinations", href: "/destinations" },
  { label: "About Us", href: "/about" },
  { label: "Contact", href: "/contact" },
];

  return (
    <header className="absolute left-0 right-0 top-0 z-30">
      <div className="mx-auto mt-2 flex w-[calc(100%-1rem)] max-w-7xl items-center justify-between rounded-2xl border border-white/15 bg-black/35 px-3 py-3 shadow-lg shadow-black/15 backdrop-blur-md sm:mt-4 sm:px-6 sm:py-4 lg:px-8">
        {/* Brand Logo */}
        <Link
          href="/"
          className="min-w-0 shrink whitespace-nowrap text-lg font-bold tracking-tight text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 sm:text-3xl md:text-2xl lg:text-3xl"
        >
          Chama <span className="font-light text-blue-300">Travels</span>
        </Link>

        {/* Desktop Navigation */}
        <nav
          aria-label="Main Navigation"
          className="hidden items-center gap-7 text-sm font-semibold text-white md:flex md:gap-3 lg:gap-7"
        >
          {navLinks.map((item) => {
            const isActive = item.label === activePage;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`transition hover:text-blue-300 ${
                  isActive
                    ? "text-blue-300 underline underline-offset-8 decoration-2"
                    : "text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Action Buttons */}
        <div className="flex shrink-0 items-center gap-2">
          {/* WhatsApp Us CTA */}
          <a
            href={`https://wa.me/${whatsappNumber}?text=Hello%20Chama%20Travels%2C%20I%20would%20like%20to%20inquire%20about%20your%20Sri%20Lanka%20tours.`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 whitespace-nowrap rounded-full border border-white/15 bg-blue-600/95 px-3 py-2 text-xs font-bold text-white shadow-lg shadow-blue-900/25 transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 sm:px-5 sm:py-2.5 sm:text-sm"
          >
            WhatsApp Us
          </a>

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-2xl text-white shadow-md backdrop-blur-md transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 md:hidden"
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Dropdown */}
      {menuOpen && (
        <div className="mx-auto mt-2 w-[calc(100%-1rem)] max-w-7xl rounded-2xl border border-white/15 bg-zinc-950/90 p-5 text-white shadow-2xl shadow-black/40 backdrop-blur-xl md:hidden">
          <nav className="flex flex-col gap-2">
            {navLinks.map((item) => {
              const isActive = item.label === activePage;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={`rounded-xl px-4 py-3 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "text-zinc-200 hover:bg-white/10"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
