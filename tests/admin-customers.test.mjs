import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  aggregateCustomerCrmData,
  deriveCustomerNormalizedKey,
  normalizeCustomerEmail,
  normalizeCustomerPhone,
  parseCustomerCrmUpsertInput,
} from '../lib/admin-customers.ts';

test('normalizes emails, Sri Lankan/international phones, and CRM keys', () => {
  assert.equal(normalizeCustomerEmail('  Guest@Example.COM '), 'guest@example.com');
  assert.equal(normalizeCustomerEmail('not-an-email'), null);

  assert.equal(normalizeCustomerPhone('071 111 4901'), '94711114901');
  assert.equal(normalizeCustomerPhone('+94 71 111 4901'), '94711114901');
  assert.equal(normalizeCustomerPhone('754895335'), '94754895335');
  assert.equal(normalizeCustomerPhone('+44 7700 900077'), '447700900077');

  assert.equal(
    deriveCustomerNormalizedKey({ email: 'Kasun@Gmail.com', phone: '0711234567' }),
    'email:kasun@gmail.com'
  );
  assert.equal(
    deriveCustomerNormalizedKey({ email: '', phone: '071 123 4567' }),
    'phone:94711234567'
  );
});

test('aggregates guest bookings, multi-currency financials, invoices, receipts, and CRM profiles', () => {
  const overview = aggregateCustomerCrmData({
    crm_profiles: [
      {
        id: 'c08f4179-3a45-4191-8176-5321e5b27a11',
        normalized_key: 'email:kasun@gmail.com',
        full_name: 'Kasun Perera',
        email: 'kasun@gmail.com',
        phone: '+94711234567',
        whatsapp: '+94711234567',
        country: 'Sri Lanka',
        vip_status: 'vip',
        notes: 'Prefers Toyota KDH high-roof van.',
        created_at: '2026-11-10T08:00:00Z',
        updated_at: '2026-11-15T10:00:00Z',
      },
    ],
    bookings: [
      {
        id: 'b1111111-1111-4111-8111-111111111111',
        booking_ref: 'CT-AAA111111111',
        customer_name: 'kasun',
        customer_email: 'Kasun@gmail.com',
        customer_phone: '0711234567',
        service_type: 'round_tour',
        journey_type: 'return',
        booking_status: 'completed',
        requested_currency: 'LKR',
        passenger_count: 4,
        luggage_count: 4,
        customer_notes: null,
        created_at: '2026-11-11T10:00:00Z',
        legs: [
          {
            sequence_no: 1,
            pickup_location: 'Airport (CMB)',
            dropoff_location: 'Sigiriya',
            pickup_at: '2026-11-12T09:00:00Z',
            planned_end_at: '2026-11-12T14:00:00Z',
            trip_status: 'completed',
          },
        ],
      },
      {
        id: 'b2222222-2222-4222-8222-222222222222',
        booking_ref: 'CT-BBB222222222',
        customer_name: 'Kasun Perera',
        customer_email: 'kasun@gmail.com',
        customer_phone: '+94711234567',
        service_type: 'airport_transfer',
        journey_type: 'one_way',
        booking_status: 'confirmed',
        requested_currency: 'USD',
        passenger_count: 2,
        luggage_count: 2,
        customer_notes: null,
        created_at: '2026-11-14T12:00:00Z',
        legs: [
          {
            sequence_no: 1,
            pickup_location: 'Colombo',
            dropoff_location: 'Airport (CMB)',
            pickup_at: '2026-11-25T06:00:00Z',
            planned_end_at: '2026-11-25T07:30:00Z',
            trip_status: 'not_started',
          },
        ],
      },
    ],
    quotes: [
      {
        id: 'q1111111-1111-4111-8111-111111111111',
        booking_id: 'b1111111-1111-4111-8111-111111111111',
        revision: 1,
        currency: 'LKR',
        total: '200000.00',
        quote_status: 'accepted',
        issued_at: '2026-11-11T10:30:00Z',
        expires_at: '2026-11-12T00:00:00Z',
        accepted_at: '2026-11-11T11:00:00Z',
        created_at: '2026-11-11T10:30:00Z',
      },
      {
        id: 'q2222222-2222-4222-8222-222222222222',
        booking_id: 'b2222222-2222-4222-8222-222222222222',
        revision: 1,
        currency: 'USD',
        total: '150.00',
        quote_status: 'accepted',
        issued_at: '2026-11-14T12:30:00Z',
        expires_at: '2026-11-15T12:30:00Z',
        accepted_at: '2026-11-14T13:00:00Z',
        created_at: '2026-11-14T12:30:00Z',
      },
    ],
    payments: [
      {
        id: 'p1111111-1111-4111-8111-111111111111',
        booking_id: 'b1111111-1111-4111-8111-111111111111',
        booking_ref: 'CT-AAA111111111',
        quote_id: 'q1111111-1111-4111-8111-111111111111',
        entry_type: 'receipt',
        original_payment_id: null,
        amount: '200000.00',
        currency: 'LKR',
        method: 'bank_transfer',
        provider_reference: 'BOC-9988',
        refund_reason: null,
        receipt_number: 'CT-R-2026-10',
        payment_date: '2026-11-11',
        verified_at: '2026-11-11T12:00:00Z',
        created_at: '2026-11-11T12:00:00Z',
        document_id: 'd1111111-1111-4111-8111-111111111111',
        file_status: 'stored',
      },
      {
        id: 'p2222222-2222-4222-8222-222222222222',
        booking_id: 'b2222222-2222-4222-8222-222222222222',
        booking_ref: 'CT-BBB222222222',
        quote_id: 'q2222222-2222-4222-8222-222222222222',
        entry_type: 'receipt',
        original_payment_id: null,
        amount: '50.00',
        currency: 'USD',
        method: 'cash',
        provider_reference: 'Advance',
        refund_reason: null,
        receipt_number: 'CT-R-2026-11',
        payment_date: '2026-11-14',
        verified_at: '2026-11-14T14:00:00Z',
        created_at: '2026-11-14T14:00:00Z',
        document_id: 'd2222222-2222-4222-8222-222222222222',
        file_status: 'stored',
      },
    ],
    invoices: [
      {
        id: 'i1111111-1111-4111-8111-111111111111',
        invoice_number: 'CT-INV-2026-000010',
        booking_id: 'b1111111-1111-4111-8111-111111111111',
        booking_ref: 'CT-AAA111111111',
        quote_id: 'q1111111-1111-4111-8111-111111111111',
        currency: 'LKR',
        total: '200000.00',
        revision: 1,
        invoice_status: 'issued',
        issued_at: '2026-11-11T11:15:00Z',
        cancelled_at: null,
        cancellation_reason: null,
        document_id: 'd3333333-3333-4333-8333-333333333333',
        file_status: 'stored',
      },
    ],
  });

  assert.equal(overview.kpis.total_customers, 1);
  assert.equal(overview.kpis.repeat_and_vip_customers, 1);
  assert.equal(overview.kpis.revenue_collected.LKR, 200000);
  assert.equal(overview.kpis.revenue_collected.USD, 50);
  assert.equal(overview.kpis.outstanding_balances.LKR, 0);
  assert.equal(overview.kpis.outstanding_balances.USD, 100);

  const customer = overview.customers[0];
  assert.equal(customer.full_name, 'Kasun Perera');
  assert.equal(customer.effective_tier, 'vip');
  assert.equal(customer.total_bookings, 2);
  assert.equal(customer.completed_bookings, 1);
  assert.equal(customer.active_upcoming_bookings, 1);
  assert.equal(customer.financials.LKR.net_paid, 200000);
  assert.equal(customer.financials.USD.net_paid, 50);
  assert.equal(customer.financials.USD.outstanding_balance, 100);
  assert.equal(customer.invoices.length, 1);
  assert.equal(
    customer.invoices[0].download_url,
    '/api/documents/download?id=d3333333-3333-4333-8333-333333333333'
  );
  assert.equal(customer.receipts.length, 2);
});

test('validates CRM profile upsert input and rejects invalid payloads', () => {
  const valid = parseCustomerCrmUpsertInput({
    full_name: '  Elena Rossi ',
    email: 'Elena@Rossi.it ',
    phone: '+39 06 1234 5678',
    whatsapp: '+39 06 1234 5678',
    country: 'Italy',
    vip_status: 'vip',
    notes: 'Honeymoon round tour inquiry.',
  });
  assert.ok(valid.data);
  assert.equal(valid.data.normalized_key, 'email:elena@rossi.it');
  assert.equal(valid.data.full_name, 'Elena Rossi');
  assert.equal(valid.data.vip_status, 'vip');

  assert.ok(parseCustomerCrmUpsertInput({ full_name: 'A' }).error);
  assert.ok(parseCustomerCrmUpsertInput({ full_name: 'John Doe' }).error);
  assert.ok(
    parseCustomerCrmUpsertInput({
      full_name: 'John Doe',
      email: 'bad-email',
    }).error
  );
});
