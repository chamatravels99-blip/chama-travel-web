import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { parseAdminCustomerPaymentInput } from '../lib/admin-customer-payment.ts';

const validPayment = {
  booking_id: 'a52d3397-536e-4e8e-b66b-b8739cc54756',
  quote_id: 'b3df82e5-b542-4bdb-a509-860bde06bed6',
  amount: '125.50',
  method: 'bank_transfer',
  payment_date: '2026-11-12',
  reference: ' BANK-123 ',
  request_id: 'f5bfc24f-6cec-4cb0-82e3-3fb973f94bef',
};

test('parses valid direct payment details and normalizes optional reference', () => {
  assert.deepEqual(parseAdminCustomerPaymentInput(validPayment), {
    bookingId: validPayment.booking_id,
    quoteId: validPayment.quote_id,
    amount: '125.50',
    method: 'bank_transfer',
    paymentDate: '2026-11-12',
    reference: 'BANK-123',
    requestId: validPayment.request_id,
  });
});

test('rejects invalid amounts, methods, dates, UUIDs, and oversized references', () => {
  for (const invalid of [
    { amount: '0' },
    { amount: '1.999' },
    { method: 'card' },
    { payment_date: '2026-02-30' },
    { booking_id: 'not-a-uuid' },
    { request_id: 'not-a-uuid' },
    { reference: 'x'.repeat(161) },
  ]) {
    assert.equal(parseAdminCustomerPaymentInput({ ...validPayment, ...invalid }), null);
  }
});
