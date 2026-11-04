"use client";

import { TourCategory } from "../types";

interface TourFiltersProps {
  categories: TourCategory[];
  activeCategory: TourCategory;
  onSelectCategory: (category: TourCategory) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  totalCounts: Record<TourCategory, number>;
}

export default function TourFilters({
  categories,
  activeCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  totalCounts,
}: TourFiltersProps) {
  return (
    <div className="w-full">
      {/* Category Pills Bar & Search Input Container */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Category Pills */}
        <div
          role="tablist"
          aria-label="Filter tours by category"
          className="flex flex-wrap items-center gap-2"
        >
          {categories.map((cat) => {
            const isActive = activeCategory === cat;
            const count = totalCounts[cat] ?? 0;

            return (
              <button
                key={cat}
                role="tab"
                aria-selected={isActive}
                type="button"
                onClick={() => onSelectCategory(cat)}
                className={`group inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition duration-200 sm:text-sm ${
                  isActive
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-2 ring-blue-500/30"
                    : "border border-zinc-200 bg-white/90 text-zinc-700 shadow-xs hover:border-blue-200 hover:bg-blue-50/60 hover:text-blue-700"
                }`}
              >
                <span>{cat}</span>
                <span
                  className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-extrabold ${
                    isActive
                      ? "bg-white/25 text-white"
                      : "bg-zinc-100 text-zinc-600 group-hover:bg-blue-100 group-hover:text-blue-800"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72 lg:w-80">
          <label htmlFor="tour-search" className="sr-only">
            Search itineraries or destinations
          </label>
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
            <svg
              className="h-4 w-4"
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input
            id="tour-search"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search e.g. Sigiriya, Yala, Ella..."
            className="w-full rounded-full border border-zinc-200 bg-white/90 py-2.5 pr-8 pl-10 text-xs text-zinc-900 placeholder:text-zinc-400 shadow-xs backdrop-blur-xs transition focus:border-blue-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 sm:text-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Clear search query"
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-xs text-zinc-400 hover:text-zinc-600"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
