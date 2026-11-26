import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  formatDriverTripDispatchMessage,
  sriLankanWhatsAppNumber,
  whatsAppLink,
} from '../lib/whatsapp.ts';

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

test('formats driver trip dispatch WhatsApp message with all trip details and customer notes', () => {
  const msg = formatDriverTripDispatchMessage({
    bookingRef: 'CT-TEST-1001',
    driverName: 'Kamal Perera',
    customerName: 'Sarah Jenkins',
    customerPhone: '+44 7700 900123',
    pickupTimeColombo: '28 Nov 2026, 09:30',
    pickupLocation: 'Bandaranaike International Airport',
    dropoffLocation: 'Kandy City Hotel',
    passengerCount: 3,
    luggageCount: 4,
    vehicleName: 'Toyota KDH Flat Roof',
    vehicleRegistration: 'CAB-4521',
    customerNotes: 'Flight UL504 arriving at 09:00. Baby seat required.',
  });
  assert.match(msg, /Hello Kamal Perera,/);
  assert.match(msg, /CT-TEST-1001/);
  assert.match(msg, /Sarah Jenkins/);
  assert.match(msg, /\+44 7700 900123/);
  assert.match(msg, /28 Nov 2026, 09:30/);
  assert.match(msg, /Bandaranaike International Airport/);
  assert.match(msg, /Kandy City Hotel/);
  assert.match(msg, /3 pax · 4 bags/);
  assert.match(msg, /Toyota KDH Flat Roof \(Reg: CAB-4521\)/);
  assert.match(msg, /Flight UL504 arriving at 09:00\. Baby seat required\./);
});
