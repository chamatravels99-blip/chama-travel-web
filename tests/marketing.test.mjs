import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  formatPromoDiscountLabel,
  normalizePromoCodeString,
  renderMarketingTemplate,
  validatePromoCodeRecord,
} from '../lib/marketing.ts';

const WELCOME_PROMO = {
  id: 'p-1',
  code: 'WELCOME10',
  title: 'First-Time Guest Welcome Discount (10% OFF)',
  discount_type: 'percentage',
  discount_value: 10,
  currency: 'ALL',
  min_booking_amount: 0,
  applicable_service: 'all',
  max_uses: null,
  used_count: 5,
  valid_from: '2026-01-01T00:00:00Z',
  valid_until: null,
  is_active: true,
  created_at: '2026-11-20T00:00:00Z',
  updated_at: '2026-11-20T00:00:00Z',
};

const AIRPORT_PROMO = {
  id: 'p-2',
  code: 'AIRPORT15',
  title: 'Airport Transfer Special ($15 OFF)',
  discount_type: 'fixed',
  discount_value: 15,
  currency: 'USD',
  min_booking_amount: 50,
  applicable_service: 'airport_transfer',
  max_uses: 100,
  used_count: 12,
  valid_from: '2026-01-01T00:00:00Z',
  valid_until: '2027-12-31T23:59:59Z',
  is_active: true,
  created_at: '2026-11-20T00:00:00Z',
  updated_at: '2026-11-20T00:00:00Z',
};

test('normalizes promo code strings to uppercase alphanumeric tokens', () => {
  assert.equal(normalizePromoCodeString('  welcome10 '), 'WELCOME10');
  assert.equal(normalizePromoCodeString('airport-15!@#'), 'AIRPORT-15');
  assert.equal(normalizePromoCodeString(null), '');
});

test('formats percentage and fixed-currency promo discount labels', () => {
  assert.equal(formatPromoDiscountLabel(WELCOME_PROMO), '10% OFF');
  assert.equal(formatPromoDiscountLabel(AIRPORT_PROMO), 'USD 15 OFF');
  assert.equal(
    formatPromoDiscountLabel({
      discount_type: 'fixed',
      discount_value: 5000,
      currency: 'LKR',
    }),
    'LKR 5,000 OFF'
  );
});

test('validates active promo codes and rejects inactive, expired, maxed-out, or mismatched codes', () => {
  const validWelcome = validatePromoCodeRecord(WELCOME_PROMO, {
    serviceType: 'round_tour',
    now: new Date('2026-11-20T10:00:00Z'),
  });
  assert.equal(validWelcome.valid, true);
  assert.equal(validWelcome.discount_label, '10% OFF');
  assert.match(validWelcome.booking_note_tag ?? '', /Promo code applied: WELCOME10/);

  // Service mismatch
  const wrongService = validatePromoCodeRecord(AIRPORT_PROMO, {
    serviceType: 'round_tour',
    now: new Date('2026-11-20T10:00:00Z'),
  });
  assert.equal(wrongService.valid, false);
  assert.match(wrongService.error ?? '', /Airport Transfers/);

  // Minimum amount check
  const belowMin = validatePromoCodeRecord(AIRPORT_PROMO, {
    serviceType: 'airport_transfer',
    bookingAmount: 35,
    now: new Date('2026-11-20T10:00:00Z'),
  });
  assert.equal(belowMin.valid, false);
  assert.match(belowMin.error ?? '', /minimum booking value/i);

  // Max uses reached
  const maxedOut = validatePromoCodeRecord(
    { ...AIRPORT_PROMO, used_count: 100 },
    { serviceType: 'airport_transfer', now: new Date('2026-11-20T10:00:00Z') }
  );
  assert.equal(maxedOut.valid, false);
  assert.match(maxedOut.error ?? '', /maximum redemption limit/i);

  // Expired code
  const expired = validatePromoCodeRecord(AIRPORT_PROMO, {
    serviceType: 'airport_transfer',
    now: new Date('2028-01-05T00:00:00Z'),
  });
  assert.equal(expired.valid, false);
  assert.match(expired.error ?? '', /expired/i);

  // Inactive code
  const paused = validatePromoCodeRecord({ ...WELCOME_PROMO, is_active: false });
  assert.equal(paused.valid, false);
  assert.match(paused.error ?? '', /paused or inactive/i);
});

test('personalizes WhatsApp marketing templates with customer_name, promo_code, and website_url', () => {
  const rendered = renderMarketingTemplate(
    'Ayubowan {customer_name}! Use code *{promo_code}* at {website_url}/tours',
    {
      customerName: 'Sonia',
      promoCode: 'welcome10',
      websiteUrl: 'https://chamatravels.com/',
    }
  );
  assert.equal(
    rendered,
    'Ayubowan Sonia! Use code *WELCOME10* at https://chamatravels.com/tours'
  );
});
