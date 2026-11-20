import type { SupabaseClient } from '@supabase/supabase-js';

export interface CalendarSyncBookingLeg {
  sequence_no: number;
  pickup_location: string;
  dropoff_location: string;
  pickup_at: string;
  planned_end_at: string | null;
  flight_number?: string | null;
  trip_notes?: string | null;
  trip_status?: string | null;
}

export interface CalendarSyncBookingAssignment {
  id: string;
  driver_user_id: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  vehicle_id: string | null;
  vehicle_name: string | null;
  vehicle_registration: string | null;
  vehicle_category: string | null;
  assignment_status: string | null;
}

export interface CalendarSyncBookingQuote {
  id: string;
  revision: number;
  currency: string;
  total: number | string;
  quote_status: string;
}

export interface CalendarSyncBookingRecord {
  id: string;
  booking_ref: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  service_type: string;
  journey_type: string;
  booking_status: string;
  currency: string;
  passenger_count: number;
  luggage_count: number;
  customer_notes: string | null;
  google_calendar_event_id: string | null;
  google_calendar_synced_at: string | null;
  google_calendar_sync_error: string | null;
  created_at: string;
  legs: CalendarSyncBookingLeg[];
  assignment: CalendarSyncBookingAssignment | null;
  accepted_quote: CalendarSyncBookingQuote | null;
}

export interface GoogleCalendarEventPayload {
  summary: string;
  location: string;
  description: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  colorId: string;
}

export interface GoogleCalendarSyncResult {
  synced: boolean;
  configured: boolean;
  action: 'created' | 'updated' | 'deleted' | 'skipped_unconfigured' | 'skipped_status' | 'error';
  booking_id: string | null;
  event_id: string | null;
  synced_at: string | null;
  error?: string;
}

const ACTIVE_CALENDAR_STATUSES = new Set([
  'confirmed',
  'assigned',
  'in_progress',
  'completed',
]);

const CANCELLED_CALENDAR_STATUSES = new Set([
  'cancelled',
  'rejected',
]);

let cachedToken: { accessToken: string; expiresAtMs: number; email: string } | null = null;

function normalizePrivateKey(raw: string | undefined): string {
  if (!raw) return '';
  let cleaned = raw.trim();
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1);
  }
  return cleaned.replace(/\\n/g, '\n').trim();
}

export function getGoogleCalendarConfig() {
  const serviceAccountEmail = (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? '').trim();
  const privateKey = normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY);
  const calendarId = (process.env.GOOGLE_CALENDAR_ID ?? '').trim() || 'primary';
  const configured =
    Boolean(serviceAccountEmail) &&
    serviceAccountEmail.includes('@') &&
    privateKey.includes('BEGIN PRIVATE KEY') &&
    privateKey.includes('END PRIVATE KEY');

  return {
    configured,
    serviceAccountEmail,
    privateKey,
    calendarId,
  };
}

export function isGoogleCalendarConfigured(): boolean {
  return getGoogleCalendarConfig().configured;
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 =
    typeof Buffer !== 'undefined'
      ? Buffer.from(bytes).toString('base64')
      : btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlEncodeString(input: string): string {
  const bytes = new TextEncoder().encode(input);
  return base64UrlEncodeBytes(bytes);
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const base64Body = pem
    .replace(/-----BEGIN [A-Z ]+-----/g, '')
    .replace(/-----END [A-Z ]+-----/g, '')
    .replace(/\s+/g, '');

  const bytes =
    typeof Buffer !== 'undefined'
      ? new Uint8Array(Buffer.from(base64Body, 'base64'))
      : Uint8Array.from(atob(base64Body), (c) => c.charCodeAt(0));

  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

async function getGoogleAccessToken(
  serviceAccountEmail: string,
  privateKeyPem: string,
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const nowMs = Date.now();
  if (
    cachedToken &&
    cachedToken.email === serviceAccountEmail &&
    cachedToken.expiresAtMs - nowMs > 120_000
  ) {
    return cachedToken.accessToken;
  }

  const nowSec = Math.floor(nowMs / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccountEmail,
    scope: 'https://www.googleapis.com/auth/calendar.events',
    aud: 'https://oauth2.googleapis.com/token',
    iat: nowSec,
    exp: nowSec + 3600,
  };

  const signingInput = `${base64UrlEncodeString(JSON.stringify(header))}.${base64UrlEncodeString(
    JSON.stringify(payload)
  )}`;

  const cryptoKey = await globalThis.crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKeyPem),
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );

  const signatureBuffer = await globalThis.crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const assertion = `${signingInput}.${base64UrlEncodeBytes(new Uint8Array(signatureBuffer))}`;

  const response = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(
      `Google OAuth2 token exchange failed (${response.status}): ${errText.slice(0, 220)}`
    );
  }

  const tokenData = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!tokenData.access_token) {
    throw new Error('Google OAuth2 response did not include an access_token.');
  }

  cachedToken = {
    accessToken: tokenData.access_token,
    expiresAtMs: nowMs + (Number(tokenData.expires_in) || 3600) * 1000,
    email: serviceAccountEmail,
  };

  return tokenData.access_token;
}

function formatStatusLabel(status: string): string {
  switch (status) {
    case 'confirmed':
      return 'Confirmed';
    case 'assigned':
      return 'Driver Assigned';
    case 'in_progress':
      return 'In Progress';
    case 'completed':
      return 'Completed';
    case 'quoted':
      return 'Quoted';
    case 'reviewing':
      return 'Under Review';
    case 'pending':
      return 'New Request';
    case 'cancelled':
      return 'Cancelled';
    case 'rejected':
      return 'Rejected';
    default:
      return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function formatServiceLabel(serviceType: string): string {
  switch (serviceType) {
    case 'airport_transfer':
      return 'Airport Transfer';
    case 'day_trip':
      return 'Day Trip';
    case 'round_tour':
      return 'Chauffeur / Multi-Day Tour';
    case 'vehicle_hire':
      return 'Point-to-Point / Vehicle Hire';
    case 'custom':
      return 'Custom Tailor-Made Journey';
    default:
      return serviceType.replace(/_/g, ' ');
  }
}

export function getGoogleCalendarColorIdForStatus(status: string): string {
  switch (status) {
    case 'confirmed':
      return '9'; // Bold Blue
    case 'assigned':
    case 'in_progress':
      return '3'; // Purple / Grape
    case 'completed':
      return '10'; // Basil / Emerald Green
    case 'quoted':
    case 'reviewing':
    case 'pending':
      return '5'; // Banana / Amber
    default:
      return '9';
  }
}

export function buildGoogleCalendarEventPayload(
  booking: CalendarSyncBookingRecord,
  siteUrl?: string
): GoogleCalendarEventPayload {
  const sortedLegs = [...(booking.legs ?? [])].sort(
    (a, b) => (a.sequence_no ?? 0) - (b.sequence_no ?? 0)
  );
  const firstLeg = sortedLegs[0];
  const lastLeg = sortedLegs[sortedLegs.length - 1] ?? firstLeg;

  const pickupLocation = firstLeg?.pickup_location?.trim() || 'Sri Lanka';
  const dropoffLocation = lastLeg?.dropoff_location?.trim() || 'Destination';
  const statusLabel = formatStatusLabel(booking.booking_status);

  const startDate = firstLeg?.pickup_at ? new Date(firstLeg.pickup_at) : new Date(booking.created_at);
  const safeStartDate = Number.isNaN(startDate.getTime()) ? new Date() : startDate;

  const rawEndStr = lastLeg?.planned_end_at || firstLeg?.planned_end_at || null;
  const parsedEndDate = rawEndStr ? new Date(rawEndStr) : null;
  const safeEndDate =
    parsedEndDate &&
    !Number.isNaN(parsedEndDate.getTime()) &&
    parsedEndDate.getTime() > safeStartDate.getTime()
      ? parsedEndDate
      : new Date(safeStartDate.getTime() + 4 * 60 * 60 * 1000);

  const baseSiteUrl = (
    siteUrl ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://chamatravels.com'
  ).replace(/\/+$/, '');
  const adminBookingUrl = `${baseSiteUrl}/admin/bookings?booking_id=${booking.id}`;

  const quoteAmountLine = booking.accepted_quote
    ? `${booking.accepted_quote.currency} ${Number(booking.accepted_quote.total).toLocaleString(
        'en-US',
        { minimumFractionDigits: 2, maximumFractionDigits: 2 }
      )} (${booking.accepted_quote.quote_status.toUpperCase()})`
    : `Not Quoted (${booking.currency})`;

  const driverLine = booking.assignment?.driver_name
    ? `${booking.assignment.driver_name}${
        booking.assignment.driver_phone ? ` (${booking.assignment.driver_phone})` : ''
      }`
    : 'Unassigned';

  const vehicleLine = booking.assignment?.vehicle_name
    ? `${booking.assignment.vehicle_name}${
        booking.assignment.vehicle_registration
          ? ` — Plate: ${booking.assignment.vehicle_registration}`
          : ''
      }${
        booking.assignment.vehicle_category ? ` [${booking.assignment.vehicle_category}]` : ''
      }`
    : 'Unassigned';

  const isPlaceholderEmail = booking.customer_email
    ?.toLowerCase()
    .endsWith('@guest.chamatravels.com');

  const routeLines =
    sortedLegs.length > 0
      ? sortedLegs
          .map((leg, idx) => {
            const flightSuffix = leg.flight_number ? ` | Flight: ${leg.flight_number}` : '';
            return `  Leg ${idx + 1}: ${leg.pickup_location} → ${leg.dropoff_location}${flightSuffix}`;
          })
          .join('\n')
      : `  ${pickupLocation} → ${dropoffLocation}`;

  const descriptionLines = [
    `Booking Reference: ${booking.booking_ref}`,
    `Booking Status: ${statusLabel}`,
    `Service Type: ${formatServiceLabel(booking.service_type)} (${booking.journey_type.replace(/_/g, ' ')})`,
    '',
    `Customer Name: ${booking.customer_name}`,
    `Phone / WhatsApp: ${booking.customer_phone}`,
    ...(booking.customer_email && !isPlaceholderEmail
      ? [`Email: ${booking.customer_email}`]
      : []),
    `Passengers: ${booking.passenger_count} | Luggage: ${booking.luggage_count}`,
    '',
    'Route Details:',
    routeLines,
    '',
    `Assigned Driver: ${driverLine}`,
    `Vehicle: ${vehicleLine}`,
    `Quoted Amount: ${quoteAmountLine}`,
    ...(booking.customer_notes ? ['', `Notes:\n${booking.customer_notes}`] : []),
    '',
    `Admin Portal Link: ${adminBookingUrl}`,
  ];

  return {
    summary: `[Chama Travels] ${booking.customer_name} - ${pickupLocation} → ${dropoffLocation} (${statusLabel})`,
    location: pickupLocation,
    description: descriptionLines.join('\n'),
    start: {
      dateTime: safeStartDate.toISOString(),
      timeZone: 'Asia/Colombo',
    },
    end: {
      dateTime: safeEndDate.toISOString(),
      timeZone: 'Asia/Colombo',
    },
    colorId: getGoogleCalendarColorIdForStatus(booking.booking_status),
  };
}

export interface SyncBookingOptions {
  bookingId?: string;
  quoteId?: string;
  force?: boolean;
  fetchImpl?: typeof fetch;
}

export async function syncBookingToGoogleCalendar(
  bookingIdOrOptions: string | SyncBookingOptions,
  supabaseClient?: SupabaseClient | null
): Promise<GoogleCalendarSyncResult> {
  const options: SyncBookingOptions =
    typeof bookingIdOrOptions === 'string'
      ? { bookingId: bookingIdOrOptions }
      : bookingIdOrOptions;

  const config = getGoogleCalendarConfig();
  const fetchImpl = options.fetchImpl ?? fetch;

  if (!supabaseClient) {
    return {
      synced: false,
      configured: config.configured,
      action: config.configured ? 'error' : 'skipped_unconfigured',
      booking_id: options.bookingId ?? null,
      event_id: null,
      synced_at: null,
      error: config.configured ? 'Supabase client is unavailable for calendar sync.' : undefined,
    };
  }

  let booking: CalendarSyncBookingRecord | null = null;
  try {
    const { data, error } = await supabaseClient.rpc('get_booking_for_calendar_sync', {
      p_booking_id: options.bookingId ?? null,
      p_quote_id: options.quoteId ?? null,
    });

    if (error || !data) {
      return {
        synced: false,
        configured: config.configured,
        action: 'error',
        booking_id: options.bookingId ?? null,
        event_id: null,
        synced_at: null,
        error: error?.message || 'Booking record could not be loaded for Google Calendar sync.',
      };
    }

    booking = data as CalendarSyncBookingRecord;
  } catch (err) {
    return {
      synced: false,
      configured: config.configured,
      action: 'error',
      booking_id: options.bookingId ?? null,
      event_id: null,
      synced_at: null,
      error: err instanceof Error ? err.message : 'Failed to load booking for calendar sync.',
    };
  }

  if (!config.configured) {
    return {
      synced: false,
      configured: false,
      action: 'skipped_unconfigured',
      booking_id: booking.id,
      event_id: booking.google_calendar_event_id ?? null,
      synced_at: booking.google_calendar_synced_at ?? null,
    };
  }

  const nowIso = new Date().toISOString();
  const encodedCalendarId = encodeURIComponent(config.calendarId);

  try {
    // 1. Handle cancelled or rejected bookings
    if (CANCELLED_CALENDAR_STATUSES.has(booking.booking_status)) {
      if (booking.google_calendar_event_id) {
        const accessToken = await getGoogleAccessToken(
          config.serviceAccountEmail,
          config.privateKey,
          fetchImpl
        );
        const encodedEventId = encodeURIComponent(booking.google_calendar_event_id);
        const deleteRes = await fetchImpl(
          `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendarId}/events/${encodedEventId}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!deleteRes.ok && deleteRes.status !== 404 && deleteRes.status !== 410) {
          const errBody = await deleteRes.text().catch(() => '');
          throw new Error(
            `Google Calendar DELETE failed (${deleteRes.status}): ${errBody.slice(0, 200)}`
          );
        }
      }

      await supabaseClient.rpc('record_booking_calendar_sync_result', {
        p_booking_id: booking.id,
        p_event_id: null,
        p_synced_at: nowIso,
        p_sync_error: null,
      });

      return {
        synced: true,
        configured: true,
        action: 'deleted',
        booking_id: booking.id,
        event_id: null,
        synced_at: nowIso,
      };
    }

    // 2. Sync confirmed, assigned, in_progress, completed (or forced manual sync)
    if (!ACTIVE_CALENDAR_STATUSES.has(booking.booking_status) && !options.force) {
      return {
        synced: false,
        configured: true,
        action: 'skipped_status',
        booking_id: booking.id,
        event_id: booking.google_calendar_event_id ?? null,
        synced_at: booking.google_calendar_synced_at ?? null,
      };
    }

    const accessToken = await getGoogleAccessToken(
      config.serviceAccountEmail,
      config.privateKey,
      fetchImpl
    );
    const payload = buildGoogleCalendarEventPayload(booking);

    let eventId = booking.google_calendar_event_id;
    let syncAction: 'created' | 'updated' = eventId ? 'updated' : 'created';

    if (eventId) {
      const encodedEventId = encodeURIComponent(eventId);
      const patchRes = await fetchImpl(
        `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendarId}/events/${encodedEventId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      if (patchRes.status === 404 || patchRes.status === 410) {
        // Event was deleted in Google Calendar; fall back to POST
        eventId = null;
        syncAction = 'created';
      } else if (!patchRes.ok) {
        const errBody = await patchRes.text().catch(() => '');
        throw new Error(
          `Google Calendar PATCH failed (${patchRes.status}): ${errBody.slice(0, 200)}`
        );
      } else {
        const updatedEvent = (await patchRes.json()) as { id?: string };
        eventId = updatedEvent.id || eventId;
      }
    }

    if (!eventId) {
      const postRes = await fetchImpl(
        `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendarId}/events`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      if (!postRes.ok) {
        const errBody = await postRes.text().catch(() => '');
        throw new Error(
          `Google Calendar POST failed (${postRes.status}): ${errBody.slice(0, 200)}`
        );
      }

      const createdEvent = (await postRes.json()) as { id?: string };
      if (!createdEvent.id) {
        throw new Error('Google Calendar POST succeeded without returning an event ID.');
      }
      eventId = createdEvent.id;
      syncAction = 'created';
    }

    await supabaseClient.rpc('record_booking_calendar_sync_result', {
      p_booking_id: booking.id,
      p_event_id: eventId,
      p_synced_at: nowIso,
      p_sync_error: null,
    });

    return {
      synced: true,
      configured: true,
      action: syncAction,
      booking_id: booking.id,
      event_id: eventId,
      synced_at: nowIso,
    };
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : 'Google Calendar sync failed unexpectedly.';
    console.error('Google Calendar sync failed for booking:', booking.id, errorMessage);

    try {
      await supabaseClient.rpc('record_booking_calendar_sync_result', {
        p_booking_id: booking.id,
        p_event_id: booking.google_calendar_event_id ?? null,
        p_synced_at: booking.google_calendar_synced_at ?? null,
        p_sync_error: errorMessage.slice(0, 500),
      });
    } catch {
      // Non-blocking error recording
    }

    return {
      synced: false,
      configured: true,
      action: 'error',
      booking_id: booking.id,
      event_id: booking.google_calendar_event_id ?? null,
      synced_at: booking.google_calendar_synced_at ?? null,
      error: errorMessage,
    };
  }
}
