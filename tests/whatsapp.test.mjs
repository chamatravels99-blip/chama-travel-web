import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { sriLankanWhatsAppNumber, whatsAppLink } from '../lib/whatsapp.ts';

test('normalizes Sri Lankan mobile numbers', () => {
  for (const phone of ['077 123 4567', '+94 77 123 4567', '0094771234567', '94771234567']) {
    assert.equal(sriLankanWhatsAppNumber(phone), '94771234567');
  }
});

test('rejects invalid numbers and escapes the message', () => {
  for (const phone of ['123456', '+1 555 123 4567', '0771234567&text=bad', '0112345678']) {
    assert.equal(sriLankanWhatsAppNumber(phone), null);
  }
  assert.equal(whatsAppLink('0771234567', 'Booking #A&B'), 'https://wa.me/94771234567?text=Booking%20%23A%26B');
});
