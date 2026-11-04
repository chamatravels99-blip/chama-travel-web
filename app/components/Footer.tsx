const quickLinks = [
  { label: "Home", href: "/#home" },
  { label: "Services", href: "/services" },
  { label: "Activities", href: "/#activities" },
  { label: "Destinations", href: "/#destinations" },
  { label: "Tours", href: "/tours" },
  { label: "About", href: "/#about" },
  { label: "Contact", href: "/#contact" },
];

const socialLinks = [
  {
    label: "Facebook",
    href: "https://www.facebook.com/share/14sG15NeKV3/?mibextid=wwXIfr",
    className:
      "border-[#1877F2]/40 bg-[#1877F2] text-white hover:border-[#1877F2]/80 hover:shadow-[0_4px_14px_rgba(24,119,242,0.35)] focus-visible:ring-[#1877F2]",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
      >
        <path d="M13.397 20.997v-8.196h2.765l.411-3.209h-3.176V7.548c0-.926.258-1.56 1.587-1.56h1.684V3.127A22.336 22.336 0 0 0 14.201 3c-2.444 0-4.122 1.492-4.122 4.231v2.355H7.332v3.209h2.753v8.202h3.312z" />
      </svg>
    ),
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/chamatravels99?stkn=eGY2aW52MTJhY2V5&utm_source=qr",
    className:
      "border-white/20 bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] text-white hover:border-white/40 hover:shadow-[0_4px_14px_rgba(220,39,67,0.35)] focus-visible:ring-pink-500",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: "TripAdvisor",
    href: "https://www.tripadvisor.co.uk/Attraction_Review-g293962-d32748314-Reviews-Chama_Travel_Tours-Colombo_Western_Province.html",
    className:
      "border-white/10 bg-zinc-900 text-white hover:border-[#00AA6C]/60 hover:shadow-[0_4px_14px_rgba(0,170,108,0.25)] focus-visible:ring-[#00AA6C]",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
      >
        {/* Left eye: white disc, TripAdvisor green iris, dark pupil */}
        <circle cx="6.002" cy="13.216" r="4.06" fill="#FFFFFF" />
        <circle cx="6.002" cy="13.216" r="2.9" fill="#00AA6C" />
        <circle cx="6.002" cy="13.216" r="1.5" fill="#18181B" />
        {/* Right eye: white disc, TripAdvisor green iris, dark pupil */}
        <circle cx="17.994" cy="13.216" r="4.06" fill="#FFFFFF" />
        <circle cx="17.994" cy="13.216" r="2.9" fill="#00AA6C" />
        <circle cx="17.994" cy="13.216" r="1.5" fill="#18181B" />
        {/* White owl head with cutout eyes and beak */}
        <path
          fill="#FFFFFF"
          fillRule="evenodd"
          d="M12.006 4.295c-2.67 0-5.338.784-7.645 2.353H0l1.963 2.135a5.997 5.997 0 0 0 4.04 10.43 5.976 5.976 0 0 0 4.075-1.6L12 19.705l1.922-2.09a5.972 5.972 0 0 0 4.072 1.598 6 6 0 0 0 6-5.998 5.982 5.982 0 0 0-1.957-4.432L24 6.648h-4.35a13.573 13.573 0 0 0-7.644-2.353zM12 6.255c1.531 0 3.063.303 4.504.903C13.943 8.138 12 10.43 12 13.1c0-2.671-1.942-4.962-4.504-5.942A11.72 11.72 0 0 1 12 6.256zM6.002 9.157a4.059 4.059 0 1 1 0 8.118 4.059 4.059 0 0 1 0-8.118zm11.992.002a4.057 4.057 0 1 1 .003 8.115 4.057 4.057 0 0 1-.003-8.115z"
        />
      </svg>
    ),
  },
  {
    label: "WhatsApp",
    href: "https://wa.me/94711114901",
    className:
      "border-[#25D366]/40 bg-[#25D366] text-white hover:border-[#25D366]/80 hover:shadow-[0_4px_14px_rgba(37,211,102,0.35)] focus-visible:ring-[#25D366]",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
      >
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2M12.05 3.67c2.2 0 4.26.86 5.82 2.42a8.21 8.21 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23-1.48 0-2.93-.39-4.19-1.15l-.3-.17-3.12.82.83-3.04-.2-.32a8.19 8.19 0 0 1-1.26-4.38c.01-4.54 3.7-8.24 8.25-8.24m-3.52 3.66c-.16 0-.43.06-.66.31-.22.25-.87.86-.87 2.07 0 1.22.89 2.39 1 2.56.14.17 1.76 2.67 4.25 3.73.59.27 1.05.42 1.41.53.59.19 1.13.16 1.56.1.48-.07 1.46-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.07-.1-.23-.16-.48-.29s-1.47-.72-1.69-.8c-.23-.08-.37-.12-.56.12-.16.25-.64.81-.78.97-.15.17-.29.19-.53.07-.26-.13-1.06-.39-2.02-1.23-.74-.66-1.23-1.47-1.38-1.72-.12-.24-.01-.37.11-.48.11-.11.25-.29.37-.44.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.43s-.52-1.24-.73-1.73c-.2-.48-.4-.42-.56-.43-.14 0-.3-.01-.47-.01Z" />
      </svg>
    ),
  },
  {
    label: "Google Maps",
    href: "https://maps.app.goo.gl/ubS8F5C1WaaY8YwH8?g_st=ic",
    className:
      "border-white/10 bg-zinc-900 text-white hover:border-blue-500/50 hover:shadow-[0_4px_14px_rgba(66,133,244,0.25)] focus-visible:ring-blue-500",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 92.3 132.3"
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
      >
        <path fill="#1A73E8" d="M60.2 2.2C55.8.8 51 0 46.1 0 32 0 19.3 6.4 10.8 16.5l21.8 18.3L60.2 2.2z" />
        <path fill="#EA4335" d="M10.8 16.5C4.1 24.5 0 34.9 0 46.1c0 8.7 1.7 15.7 4.6 22l28-33.3-21.8-18.3z" />
        <path fill="#4285F4" d="M46.2 28.5c9.8 0 17.7 7.9 17.7 17.7 0 4.3-1.6 8.3-4.2 11.4 0 0 13.9-16.6 27.5-32.7-5.6-10.8-15.3-19-27-22.7L32.6 34.8c3.3-3.8 8.1-6.3 13.6-6.3" />
        <path fill="#FBBC04" d="M46.2 63.8c-9.8 0-17.7-7.9-17.7-17.7 0-4.3 1.5-8.3 4.1-11.3l-28 33.3c4.8 10.6 12.8 19.2 21 29.9l34.1-40.5c-3.3 3.9-8.1 6.3-13.5 6.3" />
        <path fill="#34A853" d="M59.1 109.2c15.4-24.1 33.3-35 33.3-63 0-7.7-1.9-14.9-5.2-21.3L25.6 98c2.6 3.4 5.3 7.3 7.9 11.3 9.4 14.5 6.8 23.1 12.8 23.1s3.4-8.7 12.8-23.2" />
      </svg>
    ),
  },
  {
    label: "TikTok",
    href: "https://www.tiktok.com/@chamodnuwantha?_r=1&_t=ZS-9AJQ8vQRGbe",
    className:
      "border-white/10 bg-zinc-950 text-white hover:border-[#25F4EE]/50 hover:shadow-[0_4px_14px_rgba(37,244,238,0.2)] focus-visible:ring-cyan-400",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 352.28 398.67"
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
      >
        <path
          fill="#25F4EE"
          d="M137.17 156.98v-15.56c-5.34-.73-10.76-1.18-16.29-1.18C54.23 140.24 0 194.47 0 261.13c0 40.9 20.43 77.09 51.61 98.97-20.12-21.6-32.46-50.53-32.46-82.31 0-65.7 52.69-119.28 118.03-120.81Z"
        />
        <path
          fill="#25F4EE"
          d="M140.02 333c29.74 0 54-23.66 55.1-53.13l.11-263.2h48.08c-1-5.41-1.55-10.97-1.55-16.67h-65.67l-.11 263.2c-1.1 29.47-25.36 53.13-55.1 53.13-9.24 0-17.95-2.31-25.61-6.34C105.3 323.9 121.6 333 140.02 333ZM333.13 106V91.37c-18.34 0-35.43-5.45-49.76-14.8 12.76 14.65 30.09 25.22 49.76 29.43Z"
        />
        <path
          fill="#FE2C55"
          d="M283.38 76.57c-13.98-16.05-22.47-37-22.47-59.91h-17.59c4.63 25.02 19.48 46.49 40.06 59.91ZM120.88 205.92c-30.44 0-55.21 24.77-55.21 55.21 0 21.2 12.03 39.62 29.6 48.86-6.55-9.08-10.45-20.18-10.45-32.2 0-30.44 24.77-55.21 55.21-55.21 5.68 0 11.13.94 16.29 2.55v-67.05c-5.34-.73-10.76-1.18-16.29-1.18-.96 0-1.9.05-2.85.07v51.49c-5.16-1.61-10.61-2.55-16.29-2.55Z"
        />
        <path
          fill="#FE2C55"
          d="M333.13 106v51.04c-34.05 0-65.61-10.89-91.37-29.38v133.47c0 66.66-54.23 120.88-120.88 120.88-25.76 0-49.64-8.12-69.28-21.91 22.08 23.71 53.54 38.57 88.42 38.57 66.66 0 120.88-54.23 120.88-120.88V144.33c25.76 18.49 57.32 29.38 91.37 29.38v-65.68c-6.57 0-12.97-.71-19.14-2.03Z"
        />
        <path
          fill="#FFFFFF"
          d="M241.76 261.13V127.66c25.76 18.49 57.32 29.38 91.37 29.38V106c-19.67-4.21-37-14.77-49.76-29.43-20.58-13.42-35.43-34.88-40.06-59.91h-48.08l-.11 263.2c-1.1 29.47-25.36 53.13-55.1 53.13-18.42 0-34.72-9.1-44.75-23.01-17.57-9.25-29.6-27.67-29.6-48.86 0-30.44 24.77-55.21 55.21-55.21 5.68 0 11.13.94 16.29 2.55v-51.49C71.83 158.5 19.14 212.08 19.14 277.78c0 31.78 12.34 60.71 32.46 82.31C71.23 373.87 95.12 382 120.88 382c66.65 0 120.88-54.23 120.88-120.87Z"
        />
      </svg>
    ),
  },
];

export default function Footer() {
  return (
    <footer className="bg-zinc-950 px-6 pt-16 pb-8 text-white lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Main 4-column grid */}
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_0.9fr_1.1fr_1.1fr] lg:gap-10">

          {/* Col 1 — Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="text-2xl font-bold tracking-tight">
              Chama <span className="font-light text-blue-400">Travels</span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-7 text-zinc-400">
              Discover Sri Lanka with Chama Travels. Explore unforgettable
              journeys, beautiful destinations and authentic experiences with a
              trusted local travel partner.
            </p>
          </div>

          {/* Col 2 — Quick Links */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-300">
              Quick Links
            </h3>
            <nav aria-label="Footer navigation">
              <ul className="mt-5 space-y-3">
                {quickLinks.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-zinc-400 transition hover:text-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          {/* Col 3 — Contact */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-300">
              Contact Us
            </h3>
            <ul className="mt-5 space-y-5 text-sm text-zinc-400">

              {/* Address */}
              <li className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 shrink-0 text-blue-400"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 2C8.134 2 5 5.134 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.866-3.134-7-7-7Z" />
                    <circle cx="12" cy="9" r="2.5" />
                  </svg>
                </span>
                <address className="not-italic leading-6">
                  Sri Lanka<br />
                  152/1 Kahambilihena,<br />
                  Udathuththiripitiya,<br />
                  Gampaha 11054
                </address>
              </li>

              {/* Email */}
              <li className="flex items-center gap-3">
                <span aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 shrink-0 text-blue-400"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="2" y="4" width="20" height="16" rx="3" />
                    <path d="m2 7 10 7 10-7" />
                  </svg>
                </span>
                <a
                  href="mailto:Info@chamatravels.com"
                  className="break-all transition hover:text-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  Info@chamatravels.com
                </a>
              </li>

              {/* Phone / WhatsApp */}
              <li className="flex items-center gap-3">
                <span aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 shrink-0 text-blue-400"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4A8 8 0 1 1 20 11.5Z" />
                    <path d="M9 8.5c.3-.5.7-.4 1-.1l1.1 1.5c.2.3.1.6-.2.9l-.6.6c.5 1 1.4 1.9 2.4 2.4l.6-.6c.3-.3.6-.4.9-.2l1.5 1.1c.3.3.4.7-.1 1-1 .7-2.1.8-3.4.2-2.1-1-3.8-2.7-4.8-4.8-.6-1.3-.5-2.4.2-3.4Z" />
                  </svg>
                </span>
                <div className="flex flex-col gap-0.5">
                  <a
                    href="tel:+94711114901"
                    className="transition hover:text-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    +94 711 114 901
                  </a>
                  <a
                    href="https://wa.me/94711114901"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-zinc-500 transition hover:text-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    WhatsApp
                  </a>
                </div>
              </li>
            </ul>
          </div>

          {/* Col 4 — Follow Us */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-300">
              Follow Us
            </h3>
            <div className="mt-5 flex flex-wrap items-center gap-2 sm:gap-2.5">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Follow Chama Travels on ${social.label}`}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-sm backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 ${social.className}`}
                >
                  {social.icon}
                </a>
              ))}
            </div>
            <p className="mt-5 text-xs leading-5 text-zinc-400">
              Stay connected for travel inspiration, destination updates and
              special offers from Sri Lanka.
            </p>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-14 border-t border-zinc-800 pt-7 text-center text-xs text-zinc-500 sm:flex sm:items-center sm:justify-between sm:text-left">
          <p>© {new Date().getFullYear()} Chama Travels. All rights reserved.</p>
          <p className="mt-2 text-zinc-500 sm:mt-0">Sri Lanka</p>
        </div>
      </div>
    </footer>
  );
}
