import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { isGuestBookingToken } from '../lib/guest-booking-token.ts';

test('accepts a 256-bit hexadecimal guest tracker token', () => {
  assert.equal(isGuestBookingToken('a'.repeat(64)), true);
  assert.equal(isGuestBookingToken('A1'.repeat(32)), true);
});

test('rejects malformed, short, or non-hex tracker tokens', () => {
  for (const token of ['', 'a'.repeat(63), 'a'.repeat(65), 'g'.repeat(64), 123]) {
    assert.equal(isGuestBookingToken(token), false);
  }
});
