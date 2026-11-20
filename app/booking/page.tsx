import type { Metadata } from 'next';
import BookingForm, { type BookingFormInitialValues } from '@/components/BookingForm';
import PromoOfferBanner from '@/app/components/PromoOfferBanner';
import { SERVICE_TYPES, VEHICLES } from '@/lib/constants';

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
  const initialValues = parseInitialValues(await searchParams);

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