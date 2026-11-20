import { NextResponse } from 'next/server';
import { authorizationResponse, isSameOriginRequest, requireRoles } from '@/lib/server/authorization';
import { parseAdminCustomerPaymentInput } from '@/lib/admin-customer-payment';
import { renderAndStoreBillingDocument } from '@/lib/server/documents';
import { createServiceClient } from '@/lib/server/service-client';
import {
  getGoogleCalendarConfig,
  isGoogleCalendarConfigured,
  syncBookingToGoogleCalendar,
} from '@/lib/google-calendar';
import { deriveCustomerNormalizedKey } from '@/lib/admin-customers';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MISSING_END_TIME_ERROR = 'Enter the expected end time for every booking leg before issuing a quote';
const NONFINITE_SCHEDULE_ERROR = 'Every booking leg must have finite pickup and expected end times before issuing a quote';

// Accepts a positive number or numeric string with at most two decimals.
function parseAmount(value: unknown): string | null {
  const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(text)) return null;
  return Number(text) > 0 ? text : null;
}

// Requires an explicit offset or Z so the server never guesses a timezone.
function hasExplicitTimezone(value: string): boolean {
  return /(Z|[+-]\d{2}:?\d{2})$/i.test(value);
}

function quoteResponse(data: unknown, currency: string, requestUrl: string) {
  const result = Array.isArray(data) ? data[0] : data;
  const guestToken = result && typeof result === 'object' && 'guest_token' in result
    ? result.guest_token
    : null;
  const quoteId = result && typeof result === 'object' && 'quote_id' in result
    ? result.quote_id
    : null;
  const acceptanceUrl = typeof guestToken === 'string' && typeof quoteId === 'string'
    ? (() => {
        const url = new URL(`/quotes/accept/${quoteId}`, requestUrl);
        url.hash = guestToken;
        return url.toString();
      })()
    : null;
  return NextResponse.json({
    success: true,
    data: {
      quote_id: quoteId,
      total: result && typeof result === 'object' && 'total' in result ? result.total : null,
      currency,
      acceptance_url: acceptanceUrl,
      guest_delivery_required: Boolean(acceptanceUrl),
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(request: Request) {
  try {
    const { supabase, roles } = await requireRoles(['admin', 'super_admin']);
    const bookingId = new URL(request.url).searchParams.get('booking_id');
    if (bookingId !== null) {
      if (!UUID_PATTERN.test(bookingId)) {
        return NextResponse.json({ success: false, error: 'Booking details are invalid.' }, { status: 400 });
      }
      if (!roles.some((role) => ['admin', 'super_admin'].includes(role))) {
        return NextResponse.json({ success: false, error: 'Only an Admin can view booking activity.' }, { status: 403 });
      }
      const { data, error } = await supabase.rpc('admin_list_booking_activity', {
        p_booking_id: bookingId,
      });
      if (error) {
        console.error('Booking activity could not be loaded.', error.code);
        return NextResponse.json({ success: false, error: 'Booking activity is temporarily unavailable.' }, { status: 503 });
      }
      return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const [bookings, resources, candidates] = await Promise.all([
      supabase.rpc('list_operations_bookings'),
      supabase.rpc('list_dispatch_resources'),
      supabase.rpc('admin_list_customer_payment_candidates'),
    ]);
    if (bookings.error || resources.error) {
      console.error('Operations dashboard data failed.', bookings.error?.code, resources.error?.code);
      return NextResponse.json(
        { success: false, error: 'Operations data is temporarily unavailable.' },
        { status: 503 }
      );
    }
    const canManageGuestLinks = roles.some((role) => ['admin', 'super_admin'].includes(role));
    const guestTrackerStates = canManageGuestLinks
      ? await supabase.rpc('admin_list_guest_booking_tracker_states')
      : { data: [], error: null };
    if (guestTrackerStates.error) {
      console.error('Guest tracker access status could not be loaded.', guestTrackerStates.error.code);
      return NextResponse.json(
        { success: false, error: 'Operations data is temporarily unavailable.' },
        { status: 503 }
      );
    }

    type RawCandidate = {
      booking_id: string;
      quote_id: string;
      currency: string;
      total: number;
      amount_paid: number;
      balance: number;
    };
    const paymentCandidates = Array.isArray(candidates.data) ? (candidates.data as RawCandidate[]) : [];
    const candidateByBookingId = new Map(paymentCandidates.map((c) => [c.booking_id, c]));

    type RawDriver = { id: string; full_name: string; phone: string | null };
    type RawVehicle = {
      id: string;
      display_name: string;
      registration_number?: string | null;
      category_id?: string;
      category_name?: string;
      max_passengers?: number;
      max_luggage?: number;
      operational_status?: string;
    };

    const driversList = (resources.data && typeof resources.data === 'object' && 'drivers' in resources.data && Array.isArray((resources.data as { drivers: RawDriver[] }).drivers))
      ? (resources.data as { drivers: RawDriver[] }).drivers
      : [];
    const vehiclesList = (resources.data && typeof resources.data === 'object' && 'vehicles' in resources.data && Array.isArray((resources.data as { vehicles: RawVehicle[] }).vehicles))
      ? (resources.data as { vehicles: RawVehicle[] }).vehicles
      : [];

    const driverMap = new Map(driversList.map((d) => [d.id, d]));
    const vehicleMap = new Map(vehiclesList.map((v) => [v.id, v]));

    type RawBooking = {
      id: string;
      assignment?: {
        id: string;
        driver_user_id: string;
        vehicle_id: string;
        assignment_status: string;
        driver_name?: string;
        driver_phone?: string | null;
        vehicle_name?: string;
        vehicle_registration?: string | null;
        vehicle_category?: string;
      } | null;
      quotes?: Array<{ id: string; revision: number; total: number; currency: string; quote_status: string }>;
      financials?: {
        quote_id?: string;
        quote_total: number;
        currency: string;
        total_paid: number;
        net_paid: number;
        outstanding_balance: number;
        payment_status: string;
      } | null;
    };

    const rawBookings = Array.isArray(bookings.data) ? (bookings.data as RawBooking[]) : [];
    const enrichedBookings = rawBookings.map((b) => {
      const candidate = candidateByBookingId.get(b.id);
      const acceptedQuote = b.quotes?.find((q) => q.quote_status === 'accepted');
      let financials = b.financials ?? null;
      if (!financials && candidate) {
        financials = {
          quote_id: candidate.quote_id,
          quote_total: Number(candidate.total),
          currency: candidate.currency,
          total_paid: Number(candidate.amount_paid),
          net_paid: Number(candidate.amount_paid),
          outstanding_balance: Number(candidate.balance),
          payment_status: candidate.balance <= 0 ? 'paid' : candidate.amount_paid > 0 ? 'partially_paid' : 'unpaid',
        };
      } else if (!financials && acceptedQuote) {
        financials = {
          quote_id: acceptedQuote.id,
          quote_total: Number(acceptedQuote.total),
          currency: acceptedQuote.currency,
          total_paid: 0,
          net_paid: 0,
          outstanding_balance: Number(acceptedQuote.total),
          payment_status: 'unpaid',
        };
      }

      let assignment = b.assignment;
      if (assignment) {
        const assignedDriver = driverMap.get(assignment.driver_user_id);
        const assignedVehicle = vehicleMap.get(assignment.vehicle_id);
        assignment = {
          ...assignment,
          driver_name: assignment.driver_name || assignedDriver?.full_name || 'Driver',
          driver_phone: assignment.driver_phone ?? assignedDriver?.phone ?? null,
          vehicle_name: assignment.vehicle_name || assignedVehicle?.display_name || 'Vehicle',
          vehicle_registration: assignment.vehicle_registration ?? assignedVehicle?.registration_number ?? null,
          vehicle_category: assignment.vehicle_category || assignedVehicle?.category_name || '',
        };
      }

      return {
        ...b,
        assignment,
        financials,
      };
    });

    const calendarConfig = getGoogleCalendarConfig();

    return NextResponse.json({
      success: true,
      data: {
        bookings: enrichedBookings,
        resources: {
          drivers: driversList,
          vehicles: vehiclesList,
        },
        guest_tracker_states: guestTrackerStates.data ?? [],
        google_calendar: {
          configured: calendarConfig.configured,
          calendar_id: calendarConfig.calendarId,
        },
      },
      roles,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return authorizationResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ success: false, error: 'Request origin is not allowed.' }, { status: 403 });
    }
    const { supabase, roles } = await requireRoles(['admin', 'super_admin']);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Enter valid operation details.' }, { status: 400 });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: 'Enter valid operation details.' }, { status: 400 });
    }

    const input = body as Record<string, unknown>;

    if (input.action === 'create_manual_booking') {
      if (!roles.some((role) => ['admin', 'super_admin'].includes(role))) {
        return NextResponse.json(
          { success: false, error: 'Only an Admin can create a manual booking.' },
          { status: 403 }
        );
      }

      const bookingSourceRaw = typeof input.booking_source === 'string' ? input.booking_source.trim() : 'WhatsApp';
      const allowedSources = ['WhatsApp', 'Phone Call', 'Walk-in', 'Email', 'Partner/Agent'];
      const bookingSource = allowedSources.includes(bookingSourceRaw) ? bookingSourceRaw : 'WhatsApp';

      const customerName = typeof input.customer_name === 'string' ? input.customer_name.trim() : '';
      const customerPhone = typeof input.customer_phone === 'string' ? input.customer_phone.trim() : '';
      const rawEmail = typeof input.customer_email === 'string' ? input.customer_email.trim().toLowerCase() : '';
      const customerCountry = typeof input.customer_country === 'string' ? input.customer_country.trim() : '';

      const phoneDigits = customerPhone.replace(/[^0-9]/g, '');
      if (customerName.length < 2 || customerName.length > 120) {
        return NextResponse.json(
          { success: false, error: 'Customer full name must be between 2 and 120 characters.' },
          { status: 400 }
        );
      }
      if (
        customerPhone.length < 7 ||
        customerPhone.length > 30 ||
        !/^\+?[0-9\s()-]+$/.test(customerPhone) ||
        phoneDigits.length < 7 ||
        phoneDigits.length > 15
      ) {
        return NextResponse.json(
          { success: false, error: 'Enter a valid customer phone or WhatsApp number (7–15 digits).' },
          { status: 400 }
        );
      }

      const customerEmail =
        rawEmail.length > 0
          ? rawEmail
          : `guest-${phoneDigits}@guest.chamatravels.com`;

      if (
        customerEmail.length > 254 ||
        !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customerEmail)
      ) {
        return NextResponse.json(
          { success: false, error: 'Enter a valid customer email address or leave it blank.' },
          { status: 400 }
        );
      }

      const rawServiceLabel = typeof input.service_type === 'string' ? input.service_type.trim() : 'Airport Pickup';
      const serviceMapping: Record<string, { dbType: string; title: string }> = {
        'Airport Pickup': { dbType: 'airport_transfer', title: 'Airport Pickup' },
        'Airport Drop': { dbType: 'airport_transfer', title: 'Airport Drop' },
        'Chauffeur Tour': { dbType: 'round_tour', title: 'Chauffeur Tour' },
        'Day Trip': { dbType: 'day_trip', title: 'Day Trip' },
        'Point-to-Point Transfer': { dbType: 'vehicle_hire', title: 'Point-to-Point Transfer' },
        airport_transfer: { dbType: 'airport_transfer', title: 'Airport Transfer' },
        day_trip: { dbType: 'day_trip', title: 'Day Trip' },
        round_tour: { dbType: 'round_tour', title: 'Chauffeur Tour' },
        vehicle_hire: { dbType: 'vehicle_hire', title: 'Point-to-Point Transfer' },
        custom: { dbType: 'custom', title: 'Custom Journey' },
      };
      const resolvedService = serviceMapping[rawServiceLabel] ?? {
        dbType: 'airport_transfer',
        title: rawServiceLabel || 'Airport Pickup',
      };

      const pickupLocation = typeof input.pickup_location === 'string' ? input.pickup_location.trim() : '';
      const dropoffLocation = typeof input.dropoff_location === 'string' ? input.dropoff_location.trim() : '';
      if (
        pickupLocation.length < 2 ||
        pickupLocation.length > 200 ||
        dropoffLocation.length < 2 ||
        dropoffLocation.length > 200
      ) {
        return NextResponse.json(
          { success: false, error: 'Enter valid pickup and drop-off locations (2–200 characters).' },
          { status: 400 }
        );
      }

      const pickupAtRaw = typeof input.pickup_at === 'string' ? input.pickup_at.trim() : '';
      if (!pickupAtRaw || !hasExplicitTimezone(pickupAtRaw) || Number.isNaN(Date.parse(pickupAtRaw))) {
        return NextResponse.json(
          { success: false, error: 'Enter a valid pickup date and time.' },
          { status: 400 }
        );
      }
      const pickupDate = new Date(pickupAtRaw);

      const plannedEndRaw = typeof input.planned_end_at === 'string' ? input.planned_end_at.trim() : '';
      let plannedEndIso: string;
      if (plannedEndRaw) {
        if (!hasExplicitTimezone(plannedEndRaw) || Number.isNaN(Date.parse(plannedEndRaw))) {
          return NextResponse.json(
            { success: false, error: 'Enter a valid return / end date and time.' },
            { status: 400 }
          );
        }
        const parsedEnd = new Date(plannedEndRaw);
        if (parsedEnd.getTime() <= pickupDate.getTime()) {
          return NextResponse.json(
            { success: false, error: 'Return / end time must be after the pickup time.' },
            { status: 400 }
          );
        }
        plannedEndIso = parsedEnd.toISOString();
      } else {
        // Default expected end time to pickup + 4 hours so quote issuance works out of the box
        plannedEndIso = new Date(pickupDate.getTime() + 4 * 60 * 60 * 1000).toISOString();
      }

      const passengerCount = Number(input.passenger_count ?? 2);
      const luggageCount = Number(input.luggage_count ?? 2);
      if (
        !Number.isInteger(passengerCount) ||
        passengerCount < 1 ||
        passengerCount > 14 ||
        !Number.isInteger(luggageCount) ||
        luggageCount < 0 ||
        luggageCount > 14
      ) {
        return NextResponse.json(
          { success: false, error: 'Passengers must be 1–14 and luggage must be 0–14.' },
          { status: 400 }
        );
      }

      const categoryCode =
        typeof input.category_code === 'string' && input.category_code.trim()
          ? input.category_code.trim().toLowerCase()
          : 'sedan';
      const flightNumber =
        typeof input.flight_number === 'string' ? input.flight_number.trim().slice(0, 20) : '';
      const specialNotes =
        typeof input.special_notes === 'string' ? input.special_notes.trim() : '';

      const currency =
        typeof input.currency === 'string' && ['LKR', 'USD'].includes(input.currency.toUpperCase())
          ? input.currency.toUpperCase()
          : 'LKR';

      const autoConfirm = Boolean(input.auto_confirm);
      const agreedAmount = autoConfirm ? parseAmount(input.agreed_amount) : null;
      if (autoConfirm && agreedAmount === null) {
        return NextResponse.json(
          {
            success: false,
            error: 'Enter a valid agreed price amount (greater than 0) to auto-confirm the booking.',
          },
          { status: 400 }
        );
      }

      const noteSegments = [
        `Booking title: ${resolvedService.title}`,
        `Booking source: ${bookingSource}`,
        ...(customerCountry ? [`Country: ${customerCountry}`] : []),
        ...(flightNumber ? [`Flight No: ${flightNumber}`] : []),
        ...(specialNotes ? [`Notes: ${specialNotes}`] : []),
      ];
      const combinedCustomerNotes = noteSegments.join('\n').slice(0, 1000);

      const idempotencyKey =
        typeof input.idempotency_key === 'string' && UUID_PATTERN.test(input.idempotency_key)
          ? input.idempotency_key
          : globalThis.crypto.randomUUID();

      const legsPayload = [
        {
          pickup_location: pickupLocation,
          dropoff_location: dropoffLocation,
          pickup_at: pickupDate.toISOString(),
          planned_end_at: plannedEndIso,
          flight_number: flightNumber || null,
          trip_notes: specialNotes ? specialNotes.slice(0, 950) : null,
        },
      ];

      const { data: createdRows, error: createErr } = await supabase.rpc(
        'admin_create_manual_booking',
        {
          p_customer_name: customerName,
          p_customer_email: customerEmail,
          p_customer_phone: customerPhone,
          p_service_type: resolvedService.dbType,
          p_journey_type: 'one_way',
          p_category_code: categoryCode,
          p_passenger_count: passengerCount,
          p_luggage_count: luggageCount,
          p_customer_notes: combinedCustomerNotes,
          p_requested_currency: currency,
          p_idempotency_key: idempotencyKey,
          p_legs: legsPayload,
        }
      );

      if (createErr) {
        console.error('Admin manual booking creation failed:', createErr.code, createErr.message);
        return NextResponse.json(
          {
            success: false,
            error: createErr.message || 'Manual booking could not be created. Check all fields.',
          },
          { status: 400 }
        );
      }

      const created = Array.isArray(createdRows) ? createdRows[0] : createdRows;
      const bookingId = created?.booking_id as string | undefined;
      const bookingRef = created?.booking_ref as string | undefined;
      if (!bookingId) {
        return NextResponse.json(
          { success: false, error: 'Manual booking did not return a valid booking ID.' },
          { status: 500 }
        );
      }

      // Best-effort CRM profile enrichment (non-blocking)
      try {
        const normalizedKey = deriveCustomerNormalizedKey({
          email: rawEmail || null,
          phone: customerPhone,
          whatsapp: customerPhone,
        });
        if (normalizedKey) {
          await supabase.from('customer_crm_profiles').upsert(
            {
              normalized_key: normalizedKey,
              full_name: customerName,
              email: rawEmail || null,
              phone: customerPhone,
              whatsapp: customerPhone,
              ...(customerCountry ? { country: customerCountry } : {}),
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'normalized_key' }
          );
        }
      } catch {
        // Non-blocking CRM sync
      }

      let autoConfirmed = false;
      let calendarSync = null;

      if (autoConfirm && agreedAmount !== null) {
        const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
        const quoteRes = await supabase.rpc('issue_manual_booking_quote', {
          p_booking_id: bookingId,
          p_currency: currency,
          p_expires_at: expiresAt,
          p_amount: agreedAmount,
        });

        const quoteRow = Array.isArray(quoteRes.data) ? quoteRes.data[0] : quoteRes.data;
        const issuedQuoteId =
          quoteRow && typeof quoteRow === 'object' && 'quote_id' in quoteRow
            ? (quoteRow.quote_id as string)
            : null;

        if (!quoteRes.error && issuedQuoteId) {
          const confirmRes = await supabase.rpc('admin_record_whatsapp_quote_acceptance', {
            p_quote_id: issuedQuoteId,
          });
          if (!confirmRes.error) {
            autoConfirmed = true;
            calendarSync = await syncBookingToGoogleCalendar(bookingId, supabase);
          }
        }
      }

      return NextResponse.json(
        {
          success: true,
          data: {
            booking_id: bookingId,
            booking_ref: bookingRef,
            auto_confirmed: autoConfirmed,
            calendar_sync: calendarSync,
          },
          message: autoConfirmed
            ? `Manual booking ${bookingRef} created, confirmed (${currency} ${agreedAmount}), and queued for calendar sync.`
            : `Manual booking ${bookingRef} created successfully.`,
        },
        { status: 201 }
      );
    }

    if (input.action === 'sync_google_calendar') {
      if (!roles.some((role) => ['admin', 'super_admin'].includes(role))) {
        return NextResponse.json(
          { success: false, error: 'Only an Admin can trigger Google Calendar sync.' },
          { status: 403 }
        );
      }
      const bookingId = typeof input.booking_id === 'string' ? input.booking_id : '';
      if (!UUID_PATTERN.test(bookingId)) {
        return NextResponse.json({ success: false, error: 'Booking details are invalid.' }, { status: 400 });
      }
      const syncResult = await syncBookingToGoogleCalendar({ bookingId, force: true }, supabase);
      if (!syncResult.configured) {
        return NextResponse.json({
          success: false,
          configured: false,
          data: syncResult,
          error:
            'Google Calendar credentials are not configured yet. Add GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, and GOOGLE_CALENDAR_ID to enable live sync.',
        });
      }
      if (!syncResult.synced) {
        return NextResponse.json(
          {
            success: false,
            configured: true,
            data: syncResult,
            error: syncResult.error || 'Google Calendar sync failed.',
          },
          { status: 502 }
        );
      }
      return NextResponse.json({
        success: true,
        configured: true,
        data: syncResult,
        message:
          syncResult.action === 'deleted'
            ? 'Cancelled booking removed from Google Calendar.'
            : 'Booking synced to Google Calendar.',
      });
    }

    if (input.action === 'sync_all_google_calendar') {
      if (!roles.some((role) => ['admin', 'super_admin'].includes(role))) {
        return NextResponse.json(
          { success: false, error: 'Only an Admin can trigger bulk Google Calendar sync.' },
          { status: 403 }
        );
      }
      if (!isGoogleCalendarConfigured()) {
        return NextResponse.json({
          success: false,
          configured: false,
          error:
            'Google Calendar credentials are not configured yet. Add GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, and GOOGLE_CALENDAR_ID to enable live sync.',
        });
      }

      const listRes = await supabase.rpc('list_operations_bookings');
      if (listRes.error) {
        return NextResponse.json(
          { success: false, error: 'Bookings could not be loaded for bulk sync.' },
          { status: 503 }
        );
      }

      const allBookings = Array.isArray(listRes.data)
        ? (listRes.data as Array<{ id: string; booking_status: string; google_calendar_event_id?: string | null }>)
        : [];
      const syncTargets = allBookings.filter(
        (b) =>
          ['confirmed', 'assigned', 'in_progress', 'completed'].includes(b.booking_status) ||
          (['cancelled', 'rejected'].includes(b.booking_status) && Boolean(b.google_calendar_event_id))
      );

      let syncedCount = 0;
      let failedCount = 0;
      let lastError: string | undefined;

      for (const target of syncTargets) {
        const res = await syncBookingToGoogleCalendar(target.id, supabase);
        if (res.synced) {
          syncedCount += 1;
        } else {
          failedCount += 1;
          if (res.error) lastError = res.error;
        }
      }

      return NextResponse.json({
        success: failedCount === 0 || syncedCount > 0,
        configured: true,
        data: {
          total_targets: syncTargets.length,
          synced_count: syncedCount,
          failed_count: failedCount,
          last_error: lastError ?? null,
        },
        message:
          failedCount === 0
            ? `Synced ${syncedCount} active booking${syncedCount === 1 ? '' : 's'} to Google Calendar.`
            : `Synced ${syncedCount} booking(s); ${failedCount} failed (${lastError ?? 'check sync errors'}).`,
      });
    }
    if (input.action === 'revoke_guest_booking_tracker') {
      if (!roles.some((role) => ['admin', 'super_admin'].includes(role))) {
        return NextResponse.json(
          { success: false, error: 'Only an Admin can revoke guest booking access.' },
          { status: 403 }
        );
      }
      const bookingId = typeof input.booking_id === 'string' ? input.booking_id : '';
      if (!UUID_PATTERN.test(bookingId)) {
        return NextResponse.json({ success: false, error: 'Booking details are invalid.' }, { status: 400 });
      }
      const { error } = await supabase.rpc('admin_revoke_guest_booking_tracker', {
        p_booking_id: bookingId,
      });
      if (error) {
        console.error('Guest booking tracker revocation failed.', error.code);
        return NextResponse.json(
          { success: false, error: 'Guest booking access could not be revoked. It may already be unavailable.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ success: true });
    }

    if (input.action === 'add_internal_note') {
      if (!roles.some((role) => ['admin', 'super_admin'].includes(role))) {
        return NextResponse.json({ success: false, error: 'Only an Admin can add an internal note.' }, { status: 403 });
      }
      const bookingId = typeof input.booking_id === 'string' ? input.booking_id : '';
      const note = typeof input.note === 'string' ? input.note.trim() : '';
      if (!UUID_PATTERN.test(bookingId) || note.length < 1 || note.length > 2000) {
        return NextResponse.json({ success: false, error: 'Enter an internal note of 1 to 2000 characters.' }, { status: 400 });
      }
      const { error } = await supabase.rpc('admin_add_booking_internal_note', {
        p_booking_id: bookingId,
        p_note: note,
      });
      if (error) {
        console.error('Internal booking note could not be saved.', error.code);
        return NextResponse.json({ success: false, error: 'The internal note could not be saved.' }, { status: 409 });
      }
      return NextResponse.json({ success: true });
    }

    if (input.action === 'record_whatsapp_confirmation') {
      if (!roles.some((role) => ['admin', 'super_admin'].includes(role))) {
        return NextResponse.json(
          { success: false, error: 'Only an Admin can record a WhatsApp confirmation.' },
          { status: 403 }
        );
      }
      const quoteId = typeof input.quote_id === 'string' ? input.quote_id : '';
      if (!UUID_PATTERN.test(quoteId)) {
        return NextResponse.json({ success: false, error: 'Quote details are invalid.' }, { status: 400 });
      }
      const { error } = await supabase.rpc('admin_record_whatsapp_quote_acceptance', {
        p_quote_id: quoteId,
      });
      if (error) {
        console.error('WhatsApp quote confirmation failed.', error.code);
        return NextResponse.json(
          { success: false, error: 'The quote could not be confirmed. It may have expired or already been processed.' },
          { status: 409 }
        );
      }
      const calendarSync = await syncBookingToGoogleCalendar({ quoteId }, supabase);
      return NextResponse.json({ success: true, calendar_sync: calendarSync });
    }

    if (input.action === 'revoke_guest_quote_link') {
      if (!roles.some((role) => ['admin', 'super_admin'].includes(role))) {
        return NextResponse.json(
          { success: false, error: 'Only an Admin can revoke a guest quote link.' },
          { status: 403 }
        );
      }
      const quoteId = typeof input.quote_id === 'string' ? input.quote_id : '';
      if (!UUID_PATTERN.test(quoteId)) {
        return NextResponse.json({ success: false, error: 'Quote details are invalid.' }, { status: 400 });
      }
      const { error } = await supabase.rpc('admin_revoke_guest_quote_acceptance_link', {
        p_quote_id: quoteId,
      });
      if (error) {
        console.error('Guest quote link revocation failed.', error.code);
        return NextResponse.json(
          { success: false, error: 'The guest quote link could not be revoked. It may have expired or already been processed.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ success: true });
    }

    if (input.action === 'issue_quote') {
      const bookingId = typeof input.booking_id === 'string' ? input.booking_id : '';
      const currency = input.currency;
      const expiresAt = input.expires_at;
      if (!UUID_PATTERN.test(bookingId) || !['LKR', 'USD'].includes(String(currency)) ||
          typeof expiresAt !== 'string' || Number.isNaN(Date.parse(expiresAt))) {
        return NextResponse.json({ success: false, error: 'Quote details are invalid.' }, { status: 400 });
      }

      const { data, error } = await supabase.rpc('issue_booking_quote', {
        p_booking_id: bookingId,
        p_currency: currency,
        p_expires_at: expiresAt,
      });
      if (error) {
        console.error('Quote issuance failed.', error.code);
        return NextResponse.json(
          { success: false, error: [MISSING_END_TIME_ERROR, NONFINITE_SCHEDULE_ERROR].includes(error.message)
            ? error.message
            : 'The quote could not be issued. Verify the booking and pricing configuration.' },
          { status: 400 }
        );
      }
      return quoteResponse(data, String(currency), request.url);
    }

    if (input.action === 'manual_quote') {
      const bookingId = typeof input.booking_id === 'string' ? input.booking_id : '';
      const currency = input.currency;
      const expiresAt = input.expires_at;
      const amount = parseAmount(input.amount);
      if (!UUID_PATTERN.test(bookingId) || !['LKR', 'USD'].includes(String(currency)) ||
          typeof expiresAt !== 'string' || Number.isNaN(Date.parse(expiresAt)) || amount === null) {
        return NextResponse.json(
          { success: false, error: 'Enter a positive amount (up to two decimals), a currency and an expiry.' },
          { status: 400 }
        );
      }
      const { data, error } = await supabase.rpc('issue_manual_booking_quote', {
        p_booking_id: bookingId,
        p_currency: currency,
        p_expires_at: expiresAt,
        p_amount: amount,
      });
      if (error) {
        console.error('Manual quote issuance failed.', error.code);
        return NextResponse.json(
          { success: false, error: [MISSING_END_TIME_ERROR, NONFINITE_SCHEDULE_ERROR].includes(error.message)
            ? error.message
            : 'The quote could not be issued. Verify the booking, amount and expiry.' },
          { status: 400 }
        );
      }
      return quoteResponse(data, String(currency), request.url);
    }

    if (input.action === 'suggest_quote') {
      const bookingId = typeof input.booking_id === 'string' ? input.booking_id : '';
      const currency = input.currency;
      if (!UUID_PATTERN.test(bookingId) || !['LKR', 'USD'].includes(String(currency))) {
        return NextResponse.json({ success: false, error: 'Quote details are invalid.' }, { status: 400 });
      }
      const { data, error } = await supabase.rpc('suggest_booking_quote_total', {
        p_booking_id: bookingId,
        p_currency: currency,
      });
      if (error) {
        console.error('Quote suggestion failed.', error.code);
        return NextResponse.json(
          { success: false, error: [MISSING_END_TIME_ERROR, NONFINITE_SCHEDULE_ERROR].includes(error.message)
            ? error.message
            : 'A suggested price could not be calculated.' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { success: true, data: { suggested_total: data ?? null, currency } },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (input.action === 'set_review') {
      const bookingId = typeof input.booking_id === 'string' ? input.booking_id : '';
      if (!UUID_PATTERN.test(bookingId)) {
        return NextResponse.json({ success: false, error: 'Booking details are invalid.' }, { status: 400 });
      }
      const { error } = await supabase.rpc('set_booking_under_review', { p_booking_id: bookingId });
      if (error) {
        console.error('Mark under review failed.', error.code);
        return NextResponse.json(
          { success: false, error: 'Only pending bookings can be marked under review.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ success: true });
    }

    if (input.action === 'set_end_time') {
      const bookingId = typeof input.booking_id === 'string' ? input.booking_id : '';
      const sequenceNo = input.sequence_no;
      const plannedEndAt = typeof input.planned_end_at === 'string' ? input.planned_end_at : '';
      if (!UUID_PATTERN.test(bookingId) || typeof sequenceNo !== 'number' || !Number.isInteger(sequenceNo) ||
          sequenceNo < 1 || sequenceNo > 8 ||
          !hasExplicitTimezone(plannedEndAt) || Number.isNaN(Date.parse(plannedEndAt))) {
        return NextResponse.json(
          { success: false, error: 'Enter a valid expected end date and time.' },
          { status: 400 }
        );
      }
      const { error } = await supabase.rpc('set_booking_leg_end_time', {
        p_booking_id: bookingId,
        p_sequence_no: sequenceNo,
        p_planned_end_at: new Date(plannedEndAt).toISOString(),
      });
      if (error) {
        console.error('Setting leg end time failed.', error.code);
        return NextResponse.json(
          { success: false, error: 'The end time must be after pickup and the booking must not yet be quoted or assigned.' },
          { status: 400 }
        );
      }
      return NextResponse.json({ success: true });
    }

    if (input.action === 'assign') {
      const bookingId = typeof input.booking_id === 'string' ? input.booking_id : '';
      const driverId = typeof input.driver_user_id === 'string' ? input.driver_user_id : '';
      const vehicleId = typeof input.vehicle_id === 'string' ? input.vehicle_id : '';
      if (![bookingId, driverId, vehicleId].every((id) => UUID_PATTERN.test(id))) {
        return NextResponse.json({ success: false, error: 'Assignment details are invalid.' }, { status: 400 });
      }
      const { data, error } = await supabase.rpc('create_booking_assignment', {
        p_booking_id: bookingId,
        p_driver_user_id: driverId,
        p_vehicle_id: vehicleId,
      });
      if (error) {
        console.error('Booking assignment failed.', error.code);
        return NextResponse.json(
          { success: false, error: 'The assignment could not be made. Check vehicle/driver availability and the booking schedule.' },
          { status: 409 }
        );
      }
      const calendarSync = await syncBookingToGoogleCalendar(bookingId, supabase);
      return NextResponse.json({ success: true, data: { assignment_id: data }, calendar_sync: calendarSync }, { status: 201 });
    }

    if (input.action === 'release_assignment') {
      const bookingId = typeof input.booking_id === 'string' ? input.booking_id : '';
      const reason = typeof input.reason === 'string' ? input.reason.trim() : 'Assignment removed by Admin';
      if (!UUID_PATTERN.test(bookingId)) {
        return NextResponse.json({ success: false, error: 'Booking details are invalid.' }, { status: 400 });
      }
      if (reason.length < 3) {
        return NextResponse.json({ success: false, error: 'Provide a reason of at least 3 characters.' }, { status: 400 });
      }

      // Try RPC first
      const rpcResult = await supabase.rpc('admin_release_driver_assignment', {
        p_booking_id: bookingId,
        p_reason: reason,
      });

      if (rpcResult.error) {
        // Fallback for un-migrated databases using service role or direct updates
        const service = createServiceClient();
        if (service) {
          await service
            .from('booking_assignments')
            .update({
              assignment_status: 'released',
              released_at: new Date().toISOString(),
              release_reason: reason,
            })
            .eq('booking_id', bookingId)
            .in('assignment_status', ['offered', 'accepted']);

          await service
            .from('bookings')
            .update({ booking_status: 'confirmed' })
            .eq('id', bookingId);

          await supabase.rpc('admin_add_booking_internal_note', {
            p_booking_id: bookingId,
            p_note: `Driver assignment released. Reason: ${reason}`,
          });
        } else {
          console.error('Release driver assignment failed.', rpcResult.error.code);
          return NextResponse.json({ success: false, error: 'Assignment could not be released.' }, { status: 409 });
        }
      }

      const calendarSync = await syncBookingToGoogleCalendar(bookingId, supabase);
      return NextResponse.json({
        success: true,
        message: 'Driver assignment released and booking returned to confirmed.',
        calendar_sync: calendarSync,
      });
    }

    if (input.action === 'start_trip') {
      const bookingId = typeof input.booking_id === 'string' ? input.booking_id : '';
      if (!UUID_PATTERN.test(bookingId)) {
        return NextResponse.json({ success: false, error: 'Booking details are invalid.' }, { status: 400 });
      }

      const rpcResult = await supabase.rpc('admin_start_trip', { p_booking_id: bookingId });
      if (rpcResult.error) {
        const service = createServiceClient();
        if (service) {
          await service
            .from('booking_assignments')
            .update({ assignment_status: 'in_progress' })
            .eq('booking_id', bookingId)
            .in('assignment_status', ['offered', 'accepted']);

          await service
            .from('bookings')
            .update({ booking_status: 'in_progress' })
            .eq('id', bookingId);

          await service
            .from('booking_legs')
            .update({ trip_status: 'in_progress' })
            .eq('booking_id', bookingId)
            .eq('trip_status', 'not_started');
        } else {
          console.error('Trip start failed.', rpcResult.error.code);
          return NextResponse.json({ success: false, error: 'Trip could not be started.' }, { status: 409 });
        }
      }

      const calendarSync = await syncBookingToGoogleCalendar(bookingId, supabase);
      return NextResponse.json({
        success: true,
        message: 'Trip is now in progress.',
        calendar_sync: calendarSync,
      });
    }

    if (input.action === 'complete_trip') {
      const bookingId = typeof input.booking_id === 'string' ? input.booking_id : '';
      if (!UUID_PATTERN.test(bookingId)) {
        return NextResponse.json({ success: false, error: 'Booking details are invalid.' }, { status: 400 });
      }

      const rpcResult = await supabase.rpc('admin_complete_trip', { p_booking_id: bookingId });
      if (rpcResult.error) {
        const service = createServiceClient();
        if (service) {
          await service
            .from('booking_assignments')
            .update({ assignment_status: 'completed' })
            .eq('booking_id', bookingId)
            .eq('assignment_status', 'in_progress');

          await service
            .from('bookings')
            .update({ booking_status: 'completed' })
            .eq('id', bookingId);

          await service
            .from('booking_legs')
            .update({ trip_status: 'completed' })
            .eq('booking_id', bookingId)
            .in('trip_status', ['in_progress', 'not_started']);
        } else {
          console.error('Trip completion failed.', rpcResult.error.code);
          return NextResponse.json({ success: false, error: 'Trip could not be completed.' }, { status: 409 });
        }
      }

      const calendarSync = await syncBookingToGoogleCalendar(bookingId, supabase);
      return NextResponse.json({
        success: true,
        message: 'Trip completed successfully.',
        calendar_sync: calendarSync,
      });
    }

    if (input.action === 'cancel_booking') {
      const bookingId = typeof input.booking_id === 'string' ? input.booking_id : '';
      const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
      if (!UUID_PATTERN.test(bookingId)) {
        return NextResponse.json({ success: false, error: 'Booking details are invalid.' }, { status: 400 });
      }
      if (reason.length < 3) {
        return NextResponse.json({ success: false, error: 'Enter a cancellation reason of at least 3 characters.' }, { status: 400 });
      }

      const rpcResult = await supabase.rpc('admin_cancel_booking', {
        p_booking_id: bookingId,
        p_reason: reason,
      });

      if (rpcResult.error) {
        const service = createServiceClient();
        if (service) {
          await service
            .from('booking_assignments')
            .update({
              assignment_status: 'released',
              released_at: new Date().toISOString(),
              release_reason: reason,
            })
            .eq('booking_id', bookingId)
            .in('assignment_status', ['offered', 'accepted', 'in_progress']);

          await service
            .from('booking_quotes')
            .update({ quote_status: 'expired' })
            .eq('booking_id', bookingId)
            .in('quote_status', ['draft', 'sent']);

          await service
            .from('bookings')
            .update({ booking_status: 'cancelled' })
            .eq('id', bookingId);

          await service
            .from('booking_legs')
            .update({ trip_status: 'cancelled' })
            .eq('booking_id', bookingId)
            .neq('trip_status', 'completed');

          await supabase.rpc('admin_add_booking_internal_note', {
            p_booking_id: bookingId,
            p_note: `Booking cancelled by Admin. Reason: ${reason}`,
          });
        } else {
          console.error('Booking cancellation failed.', rpcResult.error.code);
          return NextResponse.json({ success: false, error: 'Booking could not be cancelled.' }, { status: 409 });
        }
      }

      const calendarSync = await syncBookingToGoogleCalendar(bookingId, supabase);
      return NextResponse.json({
        success: true,
        message: 'Booking has been cancelled.',
        calendar_sync: calendarSync,
      });
    }

    if (input.action === 'record_customer_payment') {
      const paymentInput = parseAdminCustomerPaymentInput(input);
      if (!paymentInput) {
        return NextResponse.json({ success: false, error: 'Customer payment details are invalid.' }, { status: 400 });
      }

      const { data, error } = await supabase.rpc('admin_record_customer_payment', {
        p_booking_id: paymentInput.bookingId,
        p_quote_id: paymentInput.quoteId,
        p_amount: paymentInput.amount,
        p_method: paymentInput.method,
        p_payment_date: paymentInput.paymentDate,
        p_reference: paymentInput.reference || null,
        p_request_id: paymentInput.requestId,
      });

      if (error) {
        console.error('Customer payment recording failed.', error.code);
        const friendlyError = error.message?.includes('exceed')
          ? 'Payment amount exceeds the remaining outstanding balance.'
          : error.message?.includes('confirmed booking')
            ? 'Booking must be confirmed before recording a payment.'
            : error.message?.includes('accepted booking quote')
              ? 'An accepted quote is required before recording a payment.'
              : 'Payment recording failed. Check remaining balance and accepted quote.';
        return NextResponse.json(
          { success: false, error: friendlyError },
          { status: 409 }
        );
      }

      const payment = Array.isArray(data) ? data[0] : null;
      let receiptDocumentId: string | null = null;
      if (payment?.payment_id) {
        const docResult = await supabase.rpc('admin_issue_payment_receipt_document', {
          p_payment_id: payment.payment_id,
        });
        const docRow = Array.isArray(docResult.data) ? docResult.data[0] : null;
        if (docRow && typeof docRow.document_id === 'string') {
          const docId: string = docRow.document_id;
          receiptDocumentId = docId;
          try {
            const paymentType =
              typeof input.payment_type === 'string' ? input.payment_type.trim() : null;
            const paymentNote =
              typeof input.payment_note === 'string' ? input.payment_note.trim().slice(0, 500) : null;
            const paymentRef =
              typeof input.payment_ref === 'string' ? input.payment_ref.trim().slice(0, 120) : null;
            await renderAndStoreBillingDocument(supabase, docId, {
              paymentType,
              paymentNote,
              paymentRef,
              bookingId: paymentInput.bookingId,
            });
          } catch (renderErr) {
            console.error('Automatic receipt PDF render failed.', renderErr instanceof Error ? renderErr.message : 'unknown');
          }
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          payment_id: payment?.payment_id,
          receipt_number: payment?.receipt_number,
          document_id: receiptDocumentId,
          created: payment?.created,
        },
        message: `Payment of ${paymentInput.amount} recorded. Receipt ${payment?.receipt_number ?? ''} generated.`,
      });
    }

    return NextResponse.json({ success: false, error: 'Unsupported operation.' }, { status: 400 });
  } catch (error) {
    return authorizationResponse(error);
  }
}
