import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  parseAdminDriverHireOfferInput,
  parseAdminDriverHirePayoutInput,
} from '../lib/admin-driver-hire.ts';

const assignmentId = 'a52d3397-536e-4e8e-b66b-b8739cc54756';
const requestId = 'f5bfc24f-6cec-4cb0-82e3-3fb973f94bef';

test('parses hire offer amount, currency, and request identifier', () => {
  assert.deepEqual(parseAdminDriverHireOfferInput({
    assignment_id: assignmentId,
    amount: '125.50',
    currency: 'USD',
    request_id: requestId,
  }), {
    assignmentId,
    amount: '125.50',
    currency: 'USD',
    requestId,
  });
});

test('rejects invalid hire offer amounts and currencies', () => {
  for (const invalid of [
    { amount: '0' },
    { amount: '1.999' },
    { amount: '10000000000' },
    { currency: 'EUR' },
    { assignment_id: 'not-a-uuid' },
  ]) {
    assert.equal(parseAdminDriverHireOfferInput({
      assignment_id: assignmentId,
      amount: '125.50',
      currency: 'LKR',
      request_id: requestId,
      ...invalid,
    }), null);
  }
});

test('parses payout details and trims its reference', () => {
  assert.deepEqual(parseAdminDriverHirePayoutInput({
    assignment_id: assignmentId,
    amount: '25.00',
    payment_date: '2026-11-12',
    method: 'bank_transfer',
    reference: ' BANK-4 ',
    request_id: requestId,
  }), {
    assignmentId,
    amount: '25.00',
    paymentDate: '2026-11-12',
    method: 'bank_transfer',
    reference: 'BANK-4',
    requestId,
  });
});

test('rejects invalid payout dates, methods, precision, and references', () => {
  for (const invalid of [
    { payment_date: '2026-02-30' },
    { method: 'card' },
    { amount: '1.999' },
    { reference: 'x'.repeat(161) },
  ]) {
    assert.equal(parseAdminDriverHirePayoutInput({
      assignment_id: assignmentId,
      amount: '25.00',
      payment_date: '2026-11-12',
      method: 'cash',
      reference: '',
      request_id: requestId,
      ...invalid,
    }), null);
  }
});
