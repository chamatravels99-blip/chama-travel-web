import type { Metadata } from 'next';
import Link from 'next/link';
import BookingForm, { type BookingFormInitialValues } from '@/components/BookingForm';
import PromoOfferBanner from '@/app/components/PromoOfferBanner';
import { SERVICE_TYPES, VEHICLES } from '@/lib/constants';
import { getServerSiteSettings } from '@/lib/server/site-settings';
import { buildWhatsAppUrl } from '@/lib/site-settings';

export const metadata: Metadata = {
  title: 'Book a Transfer',
  description:
    'Request an airport transfer, private vehicle or Sri Lanka tour with Chama Travels.',
};

type BookingSearchParams = Record<string, string | string[] | undefined>;

function singleValue(value: string | string[] | undefined, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function parseInitialValues(searchParams: BookingSearchParams): Partial<BookingFormInitialValues> {
  const serviceType = singleValue(searchParams.service_type, 40);
  const journeyType = singleValue(searchParams.journey_type, 20);
  const vehicleType = singleValue(searchParams.vehicle_type, 40);
  const rawPassengers = Number(singleValue(searchParams.passengers, 3));
  const rawLuggage = Number(singleValue(searchParams.luggage, 3));
  const itineraryValue = singleValue(searchParams.itinerary, 2000);
  let stops: string[] = [];

  if (itineraryValue) {
    try {
      const parsed: unknown = JSON.parse(itineraryValue);
      if (Array.isArray(parsed)) {
        stops = parsed
          .filter((stop): stop is string => typeof stop === 'string')
          .map((stop) => stop.trim().slice(0, 200))
          .filter(Boolean)
          .slice(0, 9);
      }
    } catch {
      stops = [];
    }
  }

  const initialValues: Partial<BookingFormInitialValues> = {
    name: singleValue(searchParams.name, 120),
    email: singleValue(searchParams.email, 254),
    phone: singleValue(searchParams.phone, 30),
    pickup_location: singleValue(searchParams.pickup_location, 200),
    dropoff_location: singleValue(searchParams.dropoff_location, 200),
    pickup_date: singleValue(searchParams.pickup_date, 10),
    pickup_time: singleValue(searchParams.pickup_time, 5),
    flight_number: serviceType === 'airport_transfer'
      ? singleValue(searchParams.flight_number, 20)
      : '',
    passengers: Number.isInteger(rawPassengers) && rawPassengers >= 1 && rawPassengers <= 14
      ? rawPassengers
      : 1,
    luggage: Number.isInteger(rawLuggage) && rawLuggage >= 0 && rawLuggage <= 14
      ? rawLuggage
      : 0,
    notes: singleValue(searchParams.notes, 1000),
    legs: stops.slice(1).map((stop, index) => ({
      pickup_location: stops[index],
      dropoff_location: stop,
    })),
  };

  if (SERVICE_TYPES.some((service) => service.value === serviceType)) {
    initialValues.service_type = serviceType;
  }
  if (journeyType === 'one_way' || journeyType === 'return' || journeyType === 'multi_leg') {
    initialValues.journey_type = stops.length >= 3 ? 'multi_leg' : journeyType;
  } else if (stops.length >= 3) {
    initialValues.journey_type = 'multi_leg';
  }
  if (VEHICLES.some((vehicle) => vehicle.value === vehicleType)) {
    initialValues.vehicle_type = vehicleType;
  }

  return initialValues;
}

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<BookingSearchParams>;
}) {
  const [resolvedParams, siteSettings] = await Promise.all([
    searchParams,
    getServerSiteSettings(),
  ]);
  const initialValues = parseInitialValues(resolvedParams);

  if (!siteSettings.accepting_public_bookings) {
    const waUrl = buildWhatsAppUrl(
      siteSettings.whatsapp_number,
      `Hello ${siteSettings.business_name}, I would like to arrange a booking in Sri Lanka.`
    );
    return (
      <div className="min-h-screen bg-slate-50">
        <PromoOfferBanner />
        <main className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/50 sm:p-12">
            <span className="inline-flex items-center rounded-full bg-amber-50 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-amber-800 ring-1 ring-amber-200">
              Direct Concierge Booking
            </span>
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Book Directly via WhatsApp
            </h1>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-slate-600 sm:text-base">
              Online website bookings are temporarily paused while we coordinate peak-season availability. Message our team directly on WhatsApp for instant confirmation and personalized Sri Lanka itineraries!
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-[#1fb857] sm:w-auto"
              >
                Chat on WhatsApp Now →
              </a>
              <Link
                href="/"
                className="inline-flex w-full items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
              >
                Back to Home
              </Link>
            </div>

            <div className="mt-8 grid gap-3 border-t border-slate-100 pt-6 text-xs text-slate-500 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="font-bold uppercase tracking-wider text-slate-400">24/7 Hotline</p>
                <a
                  href={`tel:${siteSettings.primary_phone.replace(/[^+\d]/g, '')}`}
                  className="mt-1 block text-sm font-bold text-slate-800 hover:text-blue-700"
                >
                  {siteSettings.primary_phone}
                </a>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="font-bold uppercase tracking-wider text-slate-400">Official Email</p>
                <a
                  href={`mailto:${siteSettings.contact_email}`}
                  className="mt-1 block break-all text-sm font-bold text-slate-800 hover:text-blue-700"
                >
                  {siteSettings.contact_email}
                </a>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PromoOfferBanner />
      <main className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <BookingForm initialValues={initialValues} />
        </div>
      </main>
    </div>
  );
}