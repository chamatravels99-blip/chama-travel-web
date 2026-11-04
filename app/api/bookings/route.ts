import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { isSameOriginRequest } from '@/lib/server/authorization';

const MAX_BODY_BYTES = 16 * 1024;
const SERVICE_TYPES = new Set([
  'airport_transfer',
  'day_trip',
  'round_tour',
  'vehicle_hire',
  'custom',
]);
const JOURNEY_TYPES = new Set(['one_way', 'return', 'multi_leg']);

type BookingLeg = {
  sequence_no: number;
  pickup_location: string;
  dropoff_location: string;
  pickup_at: string;
  planned_end_at: string | null;
  flight_number: string | null;
  flight_arrival_at: string | null;
  trip_notes: string | null;
};

class RequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

async function readJson(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new RequestError('The booking form is too large.', 413);
  }

  if (!request.body) throw new RequestError('Booking details are required.', 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new RequestError('The booking form is too large.', 413);
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new RequestError('Booking details must be valid JSON.', 400);
  }
}

function requiredText(body: Record<string, unknown>, key: string, maxLength: number) {
  const value = body[key];
  if (typeof value !== 'string') throw new RequestError(`Enter a valid ${key.replaceAll('_', ' ')}.`, 400);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new RequestError(`Enter a valid ${key.replaceAll('_', ' ')}.`, 400);
  }
  return normalized;
}

function parseLocalColomboDate(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new RequestError('Choose a valid pickup date and time.', 400);
  }
  const parsedDate = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
    throw new RequestError('Choose a valid date.', 400);
  }
  const instant = new Date(`${date}T${time}:00+05:30`);
  if (Number.isNaN(instant.getTime()) || instant.getTime() <= Date.now()) {
    throw new RequestError('Choose a future pickup time in Sri Lanka.', 400);
  }
  return instant.toISOString();
}

function validateBody(value: unknown) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new RequestError('Booking details are required.', 400);
  }
  const body = value as Record<string, unknown>;
  const allowed = new Set([
    'name', 'email', 'phone', 'service_type', 'vehicle_type', 'journey_type',
    'pickup_location', 'dropoff_location', 'pickup_date', 'pickup_time',
    'return_date', 'return_time', 'end_date', 'end_time', 'flight_number',
    'flight_arrival_date', 'flight_arrival_time', 'passengers', 'luggage', 'currency',
    'notes', 'idempotency_key', 'legs',
  ]);
  if (Object.keys(body).some((key) => !allowed.has(key))) {
    throw new RequestError('Booking details contain unsupported fields.', 400);
  }

  const name = requiredText(body, 'name', 120);
  const email = requiredText(body, 'email', 254).toLowerCase();
  const phone = requiredText(body, 'phone', 30);
  const serviceType = requiredText(body, 'service_type', 40);
  const vehicleType = requiredText(body, 'vehicle_type', 40);
  const journeyType = body.journey_type === undefined ? 'one_way' : requiredText(body, 'journey_type', 20);
  const isMultiLeg = journeyType === 'multi_leg';
  const pickupLocation = isMultiLeg ? '' : requiredText(body, 'pickup_location', 200);
  const dropoffLocation = isMultiLeg ? '' : requiredText(body, 'dropoff_location', 200);
  const pickupDate = isMultiLeg ? '' : requiredText(body, 'pickup_date', 10);
  const pickupTime = isMultiLeg ? '' : requiredText(body, 'pickup_time', 5);
  const currency = body.currency === undefined ? 'LKR' : requiredText(body, 'currency', 3).toUpperCase();
  const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 1000) : '';
  const passengers = Number(body.passengers);
  const luggage = body.luggage === undefined ? 0 : Number(body.luggage);

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new RequestError('Enter a valid email address.', 400);
  if (!/^\+?[0-9\s()-]+$/.test(phone) || phone.replace(/\D/g, '').length < 7) {
    throw new RequestError('Enter a valid phone number.', 400);
  }
  if (!SERVICE_TYPES.has(serviceType)) throw new RequestError('Choose a supported service.', 400);
  if (!/^[a-z][a-z0-9_]{1,39}$/.test(vehicleType)) throw new RequestError('Choose a supported vehicle.', 400);
  if (!JOURNEY_TYPES.has(journeyType)) throw new RequestError('Choose a supported journey type.', 400);
  if (!['LKR', 'USD'].includes(currency)) throw new RequestError('Choose LKR or USD.', 400);
  if (!Number.isInteger(passengers) || passengers < 1 || passengers > 14) {
    throw new RequestError('Passenger count must be between 1 and 14.', 400);
  }
  if (!Number.isInteger(luggage) || luggage < 0 || luggage > 14) {
    throw new RequestError('Luggage count must be between 0 and 14.', 400);
  }

  let legs: BookingLeg[];
  if (journeyType === 'multi_leg') {
    if (!Array.isArray(body.legs) || body.legs.length < 2 || body.legs.length > 8) {
      throw new RequestError('A multi-leg journey needs between 2 and 8 itinerary legs.', 400);
    }
    let previousEnd: string | null = null;
    legs = body.legs.map((item, index) => {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        throw new RequestError('Each itinerary leg must be an object.', 400);
      }
      const leg = item as Record<string, unknown>;
      const legPickup = requiredText(leg, 'pickup_location', 200);
      const legDropoff = requiredText(leg, 'dropoff_location', 200);
      const legPickupAt = parseLocalColomboDate(
        requiredText(leg, 'pickup_date', 10),
        requiredText(leg, 'pickup_time', 5)
      );
      const legEndAt = parseLocalColomboDate(
        requiredText(leg, 'end_date', 10),
        requiredText(leg, 'end_time', 5)
      );
      if (new Date(legEndAt) <= new Date(legPickupAt) ||
          (previousEnd !== null && new Date(legPickupAt) < new Date(previousEnd))) {
        throw new RequestError('Each leg must end after it starts and follow the prior leg schedule.', 400);
      }
      const flightNumber = typeof leg.flight_number === 'string' ? leg.flight_number.trim().slice(0, 20) || null : null;
      const hasArrivalDate = typeof leg.flight_arrival_date === 'string' && leg.flight_arrival_date.length > 0;
      const hasArrivalTime = typeof leg.flight_arrival_time === 'string' && leg.flight_arrival_time.length > 0;
      if (hasArrivalDate !== hasArrivalTime) {
        throw new RequestError('Enter both the flight arrival date and time.', 400);
      }
      const flightArrivalAt = hasArrivalDate && hasArrivalTime
        ? parseLocalColomboDate(
            requiredText(leg, 'flight_arrival_date', 10),
            requiredText(leg, 'flight_arrival_time', 5)
          )
        : null;
      if (flightArrivalAt && (!flightNumber || new Date(flightArrivalAt) > new Date(legPickupAt))) {
        throw new RequestError('Enter a flight number and arrival time no later than its pickup.', 400);
      }
      previousEnd = legEndAt;
      return {
        sequence_no: index + 1,
        pickup_location: legPickup,
        dropoff_location: legDropoff,
        pickup_at: legPickupAt,
        planned_end_at: legEndAt,
        flight_number: flightNumber,
        flight_arrival_at: flightArrivalAt,
        trip_notes: typeof leg.trip_notes === 'string' ? leg.trip_notes.trim().slice(0, 1000) || notes || null : notes || null,
      };
    });
  } else {
    const pickupAt = parseLocalColomboDate(pickupDate, pickupTime);
    const endAt = parseLocalColomboDate(
      requiredText(body, 'end_date', 10),
      requiredText(body, 'end_time', 5)
    );
    if (new Date(endAt) <= new Date(pickupAt)) {
      throw new RequestError('Expected trip end must follow pickup.', 400);
    }
    const flightNumber = typeof body.flight_number === 'string' ? body.flight_number.trim().slice(0, 20) || null : null;
    const hasArrivalDate = typeof body.flight_arrival_date === 'string' && body.flight_arrival_date.length > 0;
    const hasArrivalTime = typeof body.flight_arrival_time === 'string' && body.flight_arrival_time.length > 0;
    if (hasArrivalDate !== hasArrivalTime) {
      throw new RequestError('Enter both the flight arrival date and time.', 400);
    }
    const flightArrivalAt = hasArrivalDate && hasArrivalTime
      ? parseLocalColomboDate(
          requiredText(body, 'flight_arrival_date', 10),
          requiredText(body, 'flight_arrival_time', 5)
        )
      : null;
    if (flightArrivalAt && (!flightNumber || new Date(flightArrivalAt) > new Date(pickupAt))) {
      throw new RequestError('Enter a flight number and arrival time no later than pickup.', 400);
    }
    if (journeyType === 'one_way') {
    legs = [{
      sequence_no: 1,
      pickup_location: pickupLocation,
      dropoff_location: dropoffLocation,
      pickup_at: pickupAt,
      planned_end_at: endAt,
      flight_number: flightNumber,
      flight_arrival_at: flightArrivalAt,
      trip_notes: notes || null,
    }];
    } else {
    const returnDate = requiredText(body, 'return_date', 10);
    const returnTime = requiredText(body, 'return_time', 5);
    const returnPickupAt = parseLocalColomboDate(returnDate, returnTime);
    if (new Date(returnPickupAt) <= new Date(pickupAt) || new Date(endAt) <= new Date(returnPickupAt)) {
      throw new RequestError('Return pickup and expected end must follow the first pickup.', 400);
    }
      legs = [
          {
            sequence_no: 1, pickup_location: pickupLocation, dropoff_location: dropoffLocation,
            pickup_at: pickupAt, planned_end_at: returnPickupAt, flight_number: flightNumber,
            flight_arrival_at: flightArrivalAt, trip_notes: notes || null,
          },
          {
            sequence_no: 2, pickup_location: dropoffLocation, dropoff_location: pickupLocation,
            pickup_at: returnPickupAt, planned_end_at: endAt, flight_number: null,
            flight_arrival_at: null, trip_notes: notes || null,
          },
        ];
    }
  }

  const idempotencyKey = typeof body.idempotency_key === 'string' ? body.idempotency_key : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
    throw new RequestError('Refresh the form and submit again.', 400);
  }

  return {
    name,
    email,
    phone,
    serviceType,
    vehicleType,
    journeyType,
    passengers,
    luggage,
    currency,
    notes,
    idempotencyKey,
    legs,
  };
}

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ success: false, error: 'Request origin is not allowed.' }, { status: 403 });
    }
    if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
      throw new RequestError('Content-Type must be application/json.', 415);
    }

    const booking = validateBody(await readJson(request));
    const supabase = await createClient();
    const { error: userError } = await supabase.auth.getUser();
    if (userError) {
      console.error('Unable to verify booking session.', userError.code);
      return NextResponse.json({ success: false, error: 'Could not verify your session.' }, { status: 503 });
    }

    const { data, error } = await supabase.rpc('create_booking', {
      p_customer_name: booking.name,
      p_customer_email: booking.email,
      p_customer_phone: booking.phone,
      p_service_type: booking.serviceType,
      p_journey_type: booking.journeyType,
      p_category_code: booking.vehicleType,
      p_passenger_count: booking.passengers,
      p_luggage_count: booking.luggage,
      p_customer_notes: booking.notes || null,
      p_requested_currency: booking.currency,
      p_idempotency_key: booking.idempotencyKey,
      p_legs: booking.legs,
    });

    if (error) {
      console.error('Booking creation failed.', error.code);
      const status = error.code === '42501' ? 403 : 400;
      return NextResponse.json(
        { success: false, error: 'We could not submit this booking. Please review the details and try again.' },
        { status }
      );
    }

    const result = Array.isArray(data) ? data[0] : data;
    const bookingId = result && typeof result === 'object' && 'booking_id' in result
      ? result.booking_id
      : null;
    const bookingRef = result && typeof result === 'object' && 'booking_ref' in result
      ? result.booking_ref
      : null;

    console.info('Booking created.', { bookingId });
    return NextResponse.json(
      { success: true, data: { id: bookingId, booking_ref: bookingRef } },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof RequestError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Booking request failed.');
    return NextResponse.json(
      { success: false, error: 'The booking could not be processed. Please try again.' },
      { status: 500 }
    );
  }
}
