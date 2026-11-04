"use client";

import { useState } from "react";
import ToursNavbar from "../tours/components/ToursNavbar";
import Footer from "../components/Footer";

const whatsappNumber = "94711114901";
const googleMapsEmbedUrl =
  "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d126682.1387680074!2d80.004616!3d7.0815764!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2554543128f9092d%3A0x2780ba119100211a!2sChama%20Travel%20%26%20Tours!5e0!3m2!1sen!2slk!4v1700000000000!5m2!1sen!2slk";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    serviceType: "Multi-Day Round Tour",
    pax: "2 Persons",
    travelDate: "",
    message: "",
  });

  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const msg = `Hello Chama Travels, I have an inquiry from your website!\n\n👤 Name: ${formData.name}\n📧 Email: ${formData.email}\n📞 Phone/WA: ${formData.phone}\n🚘 Service Needed: ${formData.serviceType}\n👥 Passengers: ${formData.pax}\n📅 Travel Date: ${formData.travelDate || "Not decided"}\n\n📝 Message:\n${formData.message || "Looking forward to hearing from you!"}`;
    
    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(msg)}`, "_blank");
    setSubmitted(true);
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Navbar */}
      <ToursNavbar activePage="contact" />

      {/* HERO BANNER */}
      <section className="relative flex min-h-[45vh] items-center justify-center overflow-hidden pt-28 pb-16">
        <div className="absolute inset-0 bg-[url('https://images.pexels.com/photos/34128249/pexels-photo-34128249.jpeg?auto=compress&cs=tinysrgb&w=2000')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-slate-900/60" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-slate-900/40 to-blue-900/20" />

        <div className="relative z-10 mx-auto max-w-4xl px-4 text-center">
          <span className="inline-block rounded-full border border-white/30 bg-white/20 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white backdrop-blur-md shadow-md">
            24/7 Fast Customer Support
          </span>

          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
            Get in Touch <br />
            <span className="text-blue-200">With Chama Travels</span>
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-base sm:text-lg text-slate-100">
            Have questions about tour packages, airport transfers, or custom itineraries? We are here to help you 24/7!
          </p>
        </div>
      </section>

      {/* CONTACT CONTENT SECTION */}
      <section className="px-6 py-16 lg:px-8 max-w-7xl mx-auto">
        <div className="grid gap-12 lg:grid-cols-12">
          
          {/* Left Column: Direct Contact Info, Official Address, Email & Official SVG Social Icons */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-600">
                Direct Contact
              </p>
              <h2 className="mt-2 text-3xl font-extrabold text-slate-900">
                We&apos;d Love to Hear From You
              </h2>
              <p className="mt-3 text-slate-600 text-sm leading-relaxed">
                Reach out directly for instant quotes, route advice, or custom tour planning in Sri Lanka.
              </p>
            </div>

            <div className="space-y-4">
              {/* WhatsApp Card */}
              <a
                href={`https://wa.me/${whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-500 hover:shadow-md group"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-md transition group-hover:scale-105">
                  {/* Official WhatsApp Vector Logo */}
                  <svg className="h-6 w-6 fill-current" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.124-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Instant WhatsApp Chat</p>
                  <p className="text-base font-bold text-slate-900">+94 71 111 4901</p>
                  <p className="text-xs text-emerald-600 font-semibold">Online • 24/7 Fast Response</p>
                </div>
              </a>

              {/* Email Card */}
              <a
                href="mailto:Info@chamatravels.com"
                className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-500 hover:shadow-md group"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md transition group-hover:scale-105">
                  {/* Mail Vector Icon */}
                  <svg className="h-6 w-6 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Official Email</p>
                  <p className="text-base font-bold text-slate-900">Info@chamatravels.com</p>
                  <p className="text-xs text-slate-500">Send inquiries anytime</p>
                </div>
              </a>

              {/* Official Address Card */}
              <div className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-md">
                  {/* Map Pin Vector Icon */}
                  <svg className="h-6 w-6 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Registered Office</p>
                  <p className="text-sm font-bold text-slate-900">Chama Travel & Tours</p>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    152/1 Kahambilihena,<br />
                    Udathuththiripitiya,<br />
                    Gampaha 11054, Sri Lanka
                  </p>
                </div>
              </div>
            </div>

            {/* Social Media Links Box (Clean SVG Brand Logos) */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Connect With Us
              </p>
              <div className="flex items-center gap-3">
                {/* WhatsApp */}
                <a
                  href={`https://wa.me/${whatsappNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="WhatsApp"
                  title="Chat on WhatsApp"
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-md transition hover:bg-emerald-600 hover:scale-105"
                >
                  <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.124-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                  </svg>
                </a>

                {/* TripAdvisor */}
                <a
                  href="https://www.tripadvisor.com/Attraction_Review-g293962-d32748314-Reviews-Chama_Travel_Tours-Colombo_Western_Province.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="TripAdvisor"
                  title="TripAdvisor Reviews"
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#00AF87] text-white shadow-md transition hover:bg-[#008f6e] hover:scale-105"
                >
                  <svg className="h-6 w-6 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-3.5 12.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5zm7 0c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5zM12 7c2.21 0 4 1.79 4 4 0 .34-.05.67-.13.98-1.07-.61-2.31-.98-3.87-.98s-2.8.37-3.87.98c-.08-.31-.13-.64-.13-.98 0-2.21 1.79-4 4-4z"/>
                  </svg>
                </a>

                {/* Facebook */}
                <a
                  href="https://www.facebook.com/share/14sG15NeKV3/?mibextid=wwXIfr"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  title="Facebook Page"
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1877F2] text-white shadow-md transition hover:bg-blue-700 hover:scale-105"
                >
                  <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </a>

                {/* Instagram */}
                <a
                  href="https://www.instagram.com/chamatravels99?stkn=eGY2aW52MTJhY2V5&utm_source=qr"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  title="Instagram Profile"
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] text-white shadow-md transition hover:scale-105"
                >
                  <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </a>
              </div>
            </div>

            {/* TripAdvisor Trust Box */}
            <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5 text-xs text-slate-700">
              <p className="font-bold text-blue-900 text-sm">★ 5.0 Rated Driver & Guide</p>
              <p className="mt-1">
                Verified on TripAdvisor with 100% positive guest reviews for safe driving, punctuality, and friendly service across Sri Lanka.
              </p>
            </div>
          </div>

          {/* Right Column: Interactive Booking Inquiry Form */}
          <div className="lg:col-span-7">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-10 shadow-xl shadow-slate-200/50">
              <h3 className="text-2xl font-bold text-slate-900">Send an Inquiry</h3>
              <p className="mt-1 text-xs text-slate-500">
                Fill in your travel details and we will get back to you with a tailored itinerary & flat-rate quote.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Your Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="John Doe"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-600 mb-1">WhatsApp / Phone *</label>
                    <input
                      type="tel"
                      required
                      placeholder="+1 234 567 890"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Email Address</label>
                    <input
                      type="email"
                      placeholder="Info@chamatravels.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Service Needed</label>
                    <select
                      value={formData.serviceType}
                      onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                    >
                      <option value="Multi-Day Round Tour">Multi-Day Round Tour</option>
                      <option value="Airport Transfer Pickup/Drop">Airport Transfer Pickup/Drop</option>
                      <option value="Vehicle Hire with Chauffeur">Vehicle Hire with Chauffeur</option>
                      <option value="Day Excursion / Safari">Day Excursion / Safari</option>
                      <option value="Custom Itinerary Planning">Custom Itinerary Planning</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Number of Passengers</label>
                    <select
                      value={formData.pax}
                      onChange={(e) => setFormData({ ...formData, pax: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                    >
                      <option value="1 Solo Traveler">1 Solo Traveler</option>
                      <option value="2 Persons (Couple)">2 Persons (Couple)</option>
                      <option value="3-4 Persons (Family/Group)">3-4 Persons (Family/Group)</option>
                      <option value="5-8 Persons (Van Group)">5-8 Persons (Van Group)</option>
                      <option value="9+ Persons (Mini Bus)">9+ Persons (Mini Bus)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Approximate Travel Date</label>
                    <input
                      type="date"
                      value={formData.travelDate}
                      onChange={(e) => setFormData({ ...formData, travelDate: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Special Notes / Places You Want to Visit</label>
                  <textarea
                    rows={4}
                    placeholder="Tell us about your flight time, places you want to visit (e.g., Sigiriya, Ella, Yala), or any special requests..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-blue-600 py-4 font-bold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-700 hover:scale-[1.01]"
                >
                  Send Request via WhatsApp →
                </button>

                {submitted && (
                  <p className="text-center text-xs font-bold text-emerald-600 mt-2">
                    ✓ Opening WhatsApp with your inquiry... Thank you!
                  </p>
                )}
              </form>
            </div>
          </div>

        </div>
      </section>

      {/* GOOGLE MAPS EMBED SECTION */}
      <section className="px-6 py-10 lg:px-8 max-w-7xl mx-auto">
        <div className="overflow-hidden rounded-3xl border border-slate-200 shadow-lg">
          <iframe
            src={googleMapsEmbedUrl}
            width="100%"
            height="380"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Chama Travel & Tours Location"
          />
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </main>
  );
}