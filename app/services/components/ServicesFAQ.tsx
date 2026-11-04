"use client";

import { useState } from "react";
import { servicesFaqs } from "../servicesData";

export default function ServicesFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="border-t border-zinc-200/80 bg-slate-50/60 px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-600 sm:text-sm">
            Questions & Answers
          </p>
          <h2 className="mt-2 text-2xl font-black text-zinc-900 sm:text-3xl">
            Frequently Asked Questions about our Services
          </h2>
          <p className="mt-3 text-sm text-zinc-600">
            Everything you need to know about airport meet-and-greets, fuel inclusions,
            and private chauffeur guidelines.
          </p>
        </div>

        <div className="mt-10 space-y-3.5">
          {servicesFaqs.map((faq, index) => {
            const isOpen = openIndex === index;

            return (
              <div
                key={faq.question}
                className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xs transition"
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="flex w-full cursor-pointer items-center justify-between p-5 text-left text-sm font-bold text-zinc-900 hover:text-blue-600 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500"
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
      </div>
    </section>
  );
}
