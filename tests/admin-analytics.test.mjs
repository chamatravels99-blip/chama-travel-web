import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  aggregateBusinessAnalytics,
  getColomboYearMonth,
} from '../lib/admin-analytics.ts';

test('parses Colombo year and month across UTC boundaries and date strings', () => {
  assert.deepEqual(getColomboYearMonth('2026-11-14'), {
    year: 2026,
    monthIndex: 10,
    monthKey: '2026-11',
  });
  assert.deepEqual(getColomboYearMonth('2026-11-14T16:40:47.217Z'), {
    year: 2026,
    monthIndex: 10,
    monthKey: '2026-11',
  });
  assert.equal(getColomboYearMonth('invalid-date'), null);
});

test('aggregates multi-currency KPIs, monthly trends, top packages, destinations, and driver performance without mixing currencies', () => {
  const report = aggregateBusinessAnalytics(
    {
      bookings: [
        {
          id: 'b-1',
          booking_ref: 'CT-1001',
          customer_name: 'Chamika',
          customer_email: 'chamika@gmail.com',
          customer_phone: '0767721553',
          service_type: 'round_tour',
          journey_type: 'return',
          booking_status: 'completed',
          requested_currency: 'LKR',
          passenger_count: 4,
          luggage_count: 3,
          customer_notes:
            'Booking title: 8-Day Highlights of Sri Lanka\nItinerary: Sigiriya -> Kandy -> Mirissa',
          created_at: '2026-11-14T10:00:00Z',
          legs: [
            {
              sequence_no: 1,
              pickup_location: 'airport',
              dropoff_location: 'Mirissa',
              pickup_at: '2026-11-15T04:40:00Z',
              planned_end_at: '2026-11-20T06:40:00Z',
              trip_status: 'completed',
            },
          ],
        },
        {
          id: 'b-2',
          booking_ref: 'CT-1002',
          customer_name: 'David',
          customer_email: 'david@example.com',
          customer_phone: '+447700900077',
          service_type: 'airport_transfer',
          journey_type: 'one_way',
          booking_status: 'confirmed',
          requested_currency: 'USD',
          passenger_count: 2,
          luggage_count: 2,
          customer_notes: 'Booking title: Airport transfer',
          created_at: '2026-11-16T08:00:00Z',
          legs: [
            {
              sequence_no: 1,
              pickup_location: 'BIA',
              dropoff_location: 'Galle',
              pickup_at: '2026-11-25T05:00:00Z',
              planned_end_at: '2026-11-25T08:00:00Z',
              trip_status: 'not_started',
            },
          ],
        },
        {
          id: 'b-3',
          booking_ref: 'CT-1003',
          customer_name: 'Cancelled Guest',
          customer_email: 'cancel@example.com',
          customer_phone: '0711111111',
          service_type: 'day_trip',
          journey_type: 'one_way',
          booking_status: 'cancelled',
          requested_currency: 'LKR',
          passenger_count: 2,
          luggage_count: 0,
          customer_notes: null,
          created_at: '2026-11-12T08:00:00Z',
          legs: [],
        },
      ],
      quotes: [
        {
          id: 'q-1',
          booking_id: 'b-1',
          revision: 1,
          currency: 'LKR',
          total: '100000.00',
          quote_status: 'accepted',
          issued_at: '2026-11-14T10:30:00Z',
          accepted_at: '2026-11-14T11:00:00Z',
          created_at: '2026-11-14T10:30:00Z',
        },
        {
          id: 'q-2',
          booking_id: 'b-2',
          revision: 1,
          currency: 'USD',
          total: '120.00',
          quote_status: 'accepted',
          issued_at: '2026-11-16T08:30:00Z',
          accepted_at: '2026-11-16T09:00:00Z',
          created_at: '2026-11-16T08:30:00Z',
        },
      ],
      payments: [
        {
          id: 'p-1',
          booking_id: 'b-1',
          quote_id: 'q-1',
          entry_type: 'receipt',
          original_payment_id: null,
          amount: '100000.00',
          currency: 'LKR',
          method: 'cash',
          receipt_number: 'CT-R-2026-1',
          payment_date: '2026-11-14',
          verified_at: '2026-11-14T12:00:00Z',
          created_at: '2026-11-14T12:00:00Z',
        },
        {
          id: 'p-2',
          booking_id: 'b-2',
          quote_id: 'q-2',
          entry_type: 'receipt',
          original_payment_id: null,
          amount: '50.00',
          currency: 'USD',
          method: 'bank_transfer',
          receipt_number: 'CT-R-2026-2',
          payment_date: '2026-11-16',
          verified_at: '2026-11-16T10:00:00Z',
          created_at: '2026-11-16T10:00:00Z',
        },
      ],
      assignments: [
        {
          id: 'a-1',
          booking_id: 'b-1',
          driver_user_id: 'd-1',
          driver_name: 'Dihara',
          driver_phone: '0771234567',
          vehicle_id: 'v-1',
          vehicle_name: 'Toyota Prius',
          vehicle_registration: 'WP KY-5689',
          vehicle_category: 'Sedan',
          assignment_status: 'completed',
          assigned_at: '2026-11-14T11:30:00Z',
          responded_at: '2026-11-14T11:35:00Z',
          released_at: null,
        },
      ],
      drivers: [
        {
          id: 'd-1',
          full_name: 'Dihara',
          phone: '0771234567',
          license_number: 'B123456',
          account_status: 'active',
          default_vehicle_id: 'v-1',
          default_vehicle_name: 'Toyota Prius',
          default_vehicle_registration: 'WP KY-5689',
          default_vehicle_category: 'Sedan',
        },
      ],
      vehicles: [],
      driver_settlements: [
        {
          id: 's-1',
          assignment_id: 'a-1',
          booking_id: 'b-1',
          driver_user_id: 'd-1',
          quote_id: 'q-1',
          currency: 'LKR',
          amount: '25000.00',
          settlement_status: 'paid',
          payout_method: 'bank_transfer',
          created_at: '2026-11-15T10:00:00Z',
          paid_at: '2026-11-15T11:00:00Z',
        },
      ],
      driver_hire_offers: [],
      driver_hire_payouts: [],
      tour_packages: [
        {
          id: 'tp-1',
          title: '8-Day Highlights of Sri Lanka',
          slug: '8-day-highlights-of-sri-lanka',
          category: 'Multi-Day Round Tours',
          duration: '8 Days / 7 Nights',
          days_count: 8,
          price_usd: 550,
          price_lkr: 165000,
          destinations_covered: ['Sigiriya', 'Kandy', 'Mirissa'],
          is_active: true,
        },
      ],
      destinations: [
        { id: 'dest-1', name: 'Sigiriya', slug: 'sigiriya', region: 'Cultural Triangle', is_active: true },
        { id: 'dest-2', name: 'Kandy', slug: 'kandy', region: 'Cultural Triangle', is_active: true },
        { id: 'dest-3', name: 'Mirissa', slug: 'mirissa', region: 'South Coast', is_active: true },
        { id: 'dest-4', name: 'Galle', slug: 'galle', region: 'South Coast', is_active: true },
      ],
    },
    '2026'
  );

  assert.equal(report.selected_year, '2026');
  assert.equal(report.kpis.total_bookings, 3);
  assert.equal(report.kpis.completed_trips, 1);
  assert.equal(report.kpis.active_upcoming_trips, 1);
  assert.equal(report.kpis.cancelled_rejected_trips, 1);

  // Strict LKR vs USD separation
  assert.equal(report.kpis.financials.LKR.gross_booked_value, 100000);
  assert.equal(report.kpis.financials.LKR.net_payments_collected, 100000);
  assert.equal(report.kpis.financials.LKR.outstanding_balance, 0);
  assert.equal(report.kpis.financials.LKR.driver_payouts_paid, 25000);

  assert.equal(report.kpis.financials.USD.gross_booked_value, 120);
  assert.equal(report.kpis.financials.USD.net_payments_collected, 50);
  assert.equal(report.kpis.financials.USD.outstanding_balance, 70);

  // November (index 10) trend verification
  const nov = report.monthly_series[10];
  assert.equal(nov.bookingsCount, 3);
  assert.equal(nov.bookedLKR, 100000);
  assert.equal(nov.collectedLKR, 100000);
  assert.equal(nov.bookedUSD, 120);
  assert.equal(nov.collectedUSD, 50);

  // Top packages & destinations
  assert.ok(report.top_packages.some((p) => p.title === '8-Day Highlights of Sri Lanka'));
  assert.ok(report.top_destinations.some((d) => d.destination === 'Mirissa'));

  // Driver performance
  assert.equal(report.driver_performance.length, 1);
  assert.equal(report.driver_performance[0].driver_name, 'Dihara');
  assert.equal(report.driver_performance[0].completed_trips, 1);
  assert.equal(report.driver_performance[0].completion_rate_pct, 100);
  assert.equal(report.driver_performance[0].settled_lkr, 25000);
});
