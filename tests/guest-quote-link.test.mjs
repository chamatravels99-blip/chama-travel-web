import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { getGuestQuoteLinkState } from '../lib/guest-quote-link.ts';

const now = Date.parse('2026-11-12T12:00:00.000Z');
const activeGuestQuote = {
  has_guest_acceptance_link: true,
  quote_status: 'sent',
  expires_at: '2026-11-13T12:00:00.000Z',
  token_expires_at: '2026-11-13T12:00:00.000Z',
  token_consumed_at: null,
  token_revoked_at: null,
};

test('active guest quote link is available until both expiries', () => {
  assert.equal(getGuestQuoteLinkState(activeGuestQuote, now), 'active');
});

test('expired guest quote link is not available', () => {
  assert.equal(getGuestQuoteLinkState({
    ...activeGuestQuote,
    token_expires_at: '2026-11-12T11:59:59.999Z',
  }, now), 'expired');
});

test('revoked guest quote link remains revoked', () => {
  assert.equal(getGuestQuoteLinkState({
    ...activeGuestQuote,
    token_revoked_at: '2026-11-12T11:30:00.000Z',
  }, now), 'revoked');
});

test('accepted guest quote link is no longer active', () => {
  assert.equal(getGuestQuoteLinkState({
    ...activeGuestQuote,
    quote_status: 'accepted',
    token_consumed_at: '2026-11-12T11:45:00.000Z',
  }, now), 'accepted');
});
