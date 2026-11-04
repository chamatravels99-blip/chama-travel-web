import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ScrollToTop from "./components/ScrollToTop";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://chamatravels.com"),
  title: {
    default: "Chama Travels | Sri Lanka Tours & Private Transport",
    template: "%s | Chama Travels",
  },
  description:
    "Sri Lanka tours, private transport, airport transfers and vehicle hire.",
  openGraph: {
    type: "website",
    url: "https://chamatravels.com",
    siteName: "Chama Travels",
    title: "Chama Travels | Sri Lanka Tours & Private Transport",
    description:
      "Sri Lanka tours, private transport, airport transfers and vehicle hire.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}
        <ScrollToTop />
      </body>
    </html>
  );
}
