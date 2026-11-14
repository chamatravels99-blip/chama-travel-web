import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { colomboInput, colomboInputToInstant } from '../lib/booking-time.ts';

test('Sri Lanka input converts to UTC across date boundaries', () => {
  assert.equal(colomboInputToInstant('2026-11-11T00:15'), '2026-11-10T18:45:00.000Z');
  assert.equal(colomboInput('2026-11-10T18:45:00.000Z'), '2026-11-11T00:15');
});

test('invalid or ambiguous dates are rejected', () => {
  for (const value of ['', '2026-02-30T12:00', '2026-11-11', '2026-11-11T25:00']) {
    assert.throws(() => colomboInputToInstant(value));
  }
  assert.equal(colomboInput('invalid'), '');
});
