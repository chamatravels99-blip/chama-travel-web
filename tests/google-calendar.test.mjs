import { strict as assert } from 'node:assert';
import { generateKeyPairSync } from 'node:crypto';
import { test } from 'node:test';
import {
  buildGoogleCalendarEventPayload,
  getGoogleCalendarColorIdForStatus,
  isGoogleCalendarConfigured,
  syncBookingToGoogleCalendar,
} from '../lib/google-calendar.ts';

const SAMPLE_BOOKING = {
  id: '11111111-2222-4333-8444-555555555555',
  booking_ref: 'CT-GCAL1001',
  customer_name: 'Liam Anderson',
  customer_email: 'liam@example.com',
  customer_phone: '+447700900077',
  service_type: 'round_tour',
  journey_type: 'one_way',
  booking_status: 'assigned',
  currency: 'USD',
  passenger_count: 3,
  luggage_count: 3,
  customer_notes: 'Booking title: Chauffeur Tour\nBooking source: WhatsApp',
  google_calendar_event_id: null,
  google_calendar_synced_at: null,
  google_calendar_sync_error: null,
  created_at: '2026-11-20T06:00:00Z',
  legs: [
    {
      sequence_no: 1,
      pickup_location: 'Bandaranaike Airport (BIA)',
      dropoff_location: 'Sigiriya Rock Fortress',
      pickup_at: '2026-11-25T04:00:00.000Z',
      planned_end_at: '2026-11-25T10:00:00.000Z',
      flight_number: 'UL 504',
      trip_notes: 'Meet at arrivals lobby',
      trip_status: 'not_started',
    },
  ],
  assignment: {
    id: 'a-1',
    driver_user_id: 'd-1',
    driver_name: 'Kamal Perera',
    driver_phone: '+94771234567',
    vehicle_id: 'v-1',
    vehicle_name: 'Toyota KDH High Roof',
    vehicle_registration: 'WP CAA-8899',
    vehicle_category: 'Passenger Van',
    assignment_status: 'accepted',
  },
  accepted_quote: {
    id: 'q-1',
    revision: 1,
    currency: 'USD',
    total: 185,
    quote_status: 'accepted',
  },
};

test('builds rich Google Calendar event payload with summary, route, driver, vehicle, quote, and Asia/Colombo timezone', () => {
  const payload = buildGoogleCalendarEventPayload(SAMPLE_BOOKING, 'https://chamatravels.com');

  assert.equal(
    payload.summary,
    '[Chama Travels] Liam Anderson - Bandaranaike Airport (BIA) → Sigiriya Rock Fortress (Driver Assigned)'
  );
  assert.equal(payload.location, 'Bandaranaike Airport (BIA)');
  assert.equal(payload.start.timeZone, 'Asia/Colombo');
  assert.equal(payload.end.timeZone, 'Asia/Colombo');
  assert.equal(payload.start.dateTime, '2026-11-25T04:00:00.000Z');
  assert.equal(payload.end.dateTime, '2026-11-25T10:00:00.000Z');
  assert.equal(payload.colorId, getGoogleCalendarColorIdForStatus('assigned'));

  assert.match(payload.description, /Booking Reference: CT-GCAL1001/);
  assert.match(payload.description, /Customer Name: Liam Anderson/);
  assert.match(payload.description, /Phone \/ WhatsApp: \+447700900077/);
  assert.match(payload.description, /Assigned Driver: Kamal Perera \(\+94771234567\)/);
  assert.match(payload.description, /Vehicle: Toyota KDH High Roof — Plate: WP CAA-8899/);
  assert.match(payload.description, /Quoted Amount: USD 185\.00 \(ACCEPTED\)/);
  assert.match(
    payload.description,
    /Admin Portal Link: https:\/\/chamatravels\.com\/admin\/bookings\?booking_id=11111111-2222-4333-8444-555555555555/
  );
});

test('falls back to pickup_at + 4 hours when planned_end_at is null and omits synthetic guest emails', () => {
  const payload = buildGoogleCalendarEventPayload({
    ...SAMPLE_BOOKING,
    booking_status: 'confirmed',
    customer_email: 'guest-94771234567@guest.chamatravels.com',
    legs: [
      {
        ...SAMPLE_BOOKING.legs[0],
        planned_end_at: null,
      },
    ],
  });

  assert.equal(payload.start.dateTime, '2026-11-25T04:00:00.000Z');
  assert.equal(payload.end.dateTime, '2026-11-25T08:00:00.000Z');
  assert.doesNotMatch(payload.description, /@guest\.chamatravels\.com/);
});

test('gracefully skips Google Calendar sync without throwing when credentials are not configured', async () => {
  const prevEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const prevKey = process.env.GOOGLE_PRIVATE_KEY;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  delete process.env.GOOGLE_PRIVATE_KEY;

  try {
    assert.equal(isGoogleCalendarConfigured(), false);
    const fakeSupabase = {
      rpc: async (fn) => {
        if (fn === 'get_booking_for_calendar_sync') {
          return { data: SAMPLE_BOOKING, error: null };
        }
        return { data: null, error: null };
      },
    };

    const res = await syncBookingToGoogleCalendar(SAMPLE_BOOKING.id, fakeSupabase);
    assert.equal(res.synced, false);
    assert.equal(res.configured, false);
    assert.equal(res.action, 'skipped_unconfigured');
  } finally {
    if (prevEmail !== undefined) process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = prevEmail;
    if (prevKey !== undefined) process.env.GOOGLE_PRIVATE_KEY = prevKey;
  }
});

test('performs RS256 OAuth exchange, POSTs new event, PATCHes existing event, and DELETEs cancelled event', async () => {
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });

  const prevEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const prevKey = process.env.GOOGLE_PRIVATE_KEY;
  const prevCal = process.env.GOOGLE_CALENDAR_ID;

  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'test-calendar-bot@chama-travels.iam.gserviceaccount.com';
  process.env.GOOGLE_PRIVATE_KEY = privateKey.replace(/\n/g, '\\n');
  process.env.GOOGLE_CALENDAR_ID = 'chama-ops@group.calendar.google.com';

  try {
    assert.equal(isGoogleCalendarConfigured(), true);

    const apiCalls = [];
    const recordedResults = [];

    const mockFetch = async (url, init) => {
      apiCalls.push({ url: String(url), method: init?.method || 'GET' });
      if (String(url).includes('oauth2.googleapis.com/token')) {
        return new Response(
          JSON.stringify({ access_token: 'mock-oauth-token', expires_in: 3600 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (init?.method === 'POST') {
        return new Response(JSON.stringify({ id: 'gcal-evt-999' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (init?.method === 'PATCH') {
        return new Response(JSON.stringify({ id: 'gcal-evt-999' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (init?.method === 'DELETE') {
        return new Response(null, { status: 204 });
      }
      return new Response('Not found', { status: 404 });
    };

    // 1. POST new event
    let currentBookingState = { ...SAMPLE_BOOKING, google_calendar_event_id: null };
    const fakeSupabase = {
      rpc: async (fn, args) => {
        if (fn === 'get_booking_for_calendar_sync') {
          return { data: currentBookingState, error: null };
        }
        if (fn === 'record_booking_calendar_sync_result') {
          recordedResults.push(args);
          currentBookingState = {
            ...currentBookingState,
            google_calendar_event_id: args.p_event_id,
            google_calendar_synced_at: args.p_synced_at,
            google_calendar_sync_error: args.p_sync_error,
          };
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    };

    const createRes = await syncBookingToGoogleCalendar(
      { bookingId: SAMPLE_BOOKING.id, fetchImpl: mockFetch },
      fakeSupabase
    );
    assert.equal(createRes.synced, true);
    assert.equal(createRes.action, 'created');
    assert.equal(createRes.event_id, 'gcal-evt-999');

    // 2. PATCH existing event
    const updateRes = await syncBookingToGoogleCalendar(
      { bookingId: SAMPLE_BOOKING.id, fetchImpl: mockFetch },
      fakeSupabase
    );
    assert.equal(updateRes.synced, true);
    assert.equal(updateRes.action, 'updated');
    assert.equal(updateRes.event_id, 'gcal-evt-999');

    // 3. DELETE cancelled event
    currentBookingState = { ...currentBookingState, booking_status: 'cancelled' };
    const deleteRes = await syncBookingToGoogleCalendar(
      { bookingId: SAMPLE_BOOKING.id, fetchImpl: mockFetch },
      fakeSupabase
    );
    assert.equal(deleteRes.synced, true);
    assert.equal(deleteRes.action, 'deleted');
    assert.equal(deleteRes.event_id, null);
    assert.equal(recordedResults[recordedResults.length - 1].p_event_id, null);
  } finally {
    if (prevEmail !== undefined) process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = prevEmail;
    else delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    if (prevKey !== undefined) process.env.GOOGLE_PRIVATE_KEY = prevKey;
    else delete process.env.GOOGLE_PRIVATE_KEY;
    if (prevCal !== undefined) process.env.GOOGLE_CALENDAR_ID = prevCal;
    else delete process.env.GOOGLE_CALENDAR_ID;
  }
});
