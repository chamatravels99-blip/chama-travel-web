import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { renderInvoicePdf, renderReceiptPdf, formatMoney, sha256Hex } from '../lib/pdf/billing-documents.ts';
import { pdfSafeText } from '../lib/pdf/pdf-builder.ts';

const decode = (bytes) => new TextDecoder().decode(bytes);

const invoiceSnapshot = {
  invoice_number: 'CT-INV-2026-000001',
  revision: 1,
  quote_revision: 3,
  issued_at: '2026-11-14T08:00:00Z',
  currency: 'USD',
  total: 150,
  customer: { name: 'Ana (Guest) Smith', email: 'ana@example.com', phone: '+123456789' },
  booking: { booking_ref: 'CT-1', service_type: 'airport_transfer', journey_type: 'one_way', passenger_count: 2, luggage_count: 1 },
  legs: [{ sequence_no: 1, pickup_location: 'Colombo', dropoff_location: 'Galle', pickup_at: '2026-12-01T03:00:00Z' }],
  lines: [{ description: 'Transfer', quantity: 1, unit_amount: 150, line_total: 150 }],
  payment_status_at_issue: { paid: 50, balance: 100, status: 'partially_paid' },
};

test('invoice PDF is a well-formed PDF built from the snapshot', () => {
  const bytes = renderInvoicePdf(invoiceSnapshot);
  const text = decode(bytes);
  assert.ok(text.startsWith('%PDF-1.4'));
  assert.ok(text.trimEnd().endsWith('%%EOF'));
  assert.ok(text.includes('CT-INV-2026-000001'));
  assert.ok(text.includes('Chama Travels'));
  assert.ok(text.includes('Info@chamatravels.com'));
  assert.ok(text.includes('+94 754895335'));
  assert.ok(text.includes('https://chamatravels.com'));
  assert.ok(text.includes('Accepted quote'));
  assert.ok(text.includes('Payment instructions'));
  assert.ok(text.includes('Issued'));
  assert.ok(text.includes('ana@example.com'));
  assert.ok(text.includes('+123456789'));
  assert.ok(text.includes('USD 150.00'));
  assert.ok(text.includes('USD 100.00'));
  assert.ok(!text.includes('LKR'));
  assert.ok(text.includes('\\(Guest\\)'), 'parentheses are escaped in PDF strings');
});

test('xref offsets point at their objects', () => {
  const text = decode(renderInvoicePdf(invoiceSnapshot));
  const start = Number(/startxref\n(\d+)/.exec(text)[1]);
  assert.ok(text.slice(start).startsWith('xref'));
  const entries = [...text.slice(start).matchAll(/(\d{10}) 00000 n/g)].map((m) => Number(m[1]));
  entries.forEach((offset, index) => assert.ok(text.slice(offset).startsWith(`${index + 1} 0 obj`)));
});

test('receipt PDF states partial payment and uses LKR separately', () => {
  const text = decode(renderReceiptPdf({
    receipt_number: 'CT-R-2026-7', payment_date: '2026-11-14', currency: 'LKR', amount: 25000,
    method: 'bank_transfer', reference: 'REF1', recorded_at: '2026-11-14T08:10:00Z',
    customer: { name: 'Ana', email: 'ana@example.com', phone: '+123456789' }, booking_ref: 'CT-1',
    invoice_number: 'CT-INV-2026-000001', quote_total: 100000, paid_to_date: 25000, balance_after: 75000, is_partial_payment: true,
  }));
  assert.ok(text.includes('CT-R-2026-7'));
  assert.ok(text.includes('Info@chamatravels.com'));
  assert.ok(text.includes('+94 754895335'));
  assert.ok(text.includes('https://chamatravels.com'));
  assert.ok(text.includes('ana@example.com'));
  assert.ok(text.includes('+123456789'));
  assert.ok(text.includes('Verified'));
  assert.ok(text.includes('bank transfer'));
  assert.ok(text.includes('2026-11-14 08:10 UTC'));
  assert.ok(text.includes('LKR 25,000.00'));
  assert.ok(text.includes('partial payment'));
  assert.ok(!text.includes('USD'));
});

test('long documents paginate and text is sanitized', () => {
  const lines = Array.from({ length: 80 }, (_, i) => ({ description: `Item ${i}`, quantity: 1, unit_amount: 1, line_total: 1 }));
  const text = decode(renderInvoicePdf({ ...invoiceSnapshot, lines }));
  assert.ok((text.match(/\/Type \/Page /g) ?? []).length >= 2);
  assert.equal(pdfSafeText('Caf\u00e9\n\u0DC1'), 'Cafe ?');
});

test('money formatting never mixes currencies and hashes are hex', async () => {
  assert.equal(formatMoney(5, 'USD'), 'USD 5.00');
  assert.equal(formatMoney(5, 'LKR'), 'LKR 5.00');
  assert.throws(() => formatMoney(5, 'XXX'), /Unsupported billing currency/);
  assert.equal((await sha256Hex(new Uint8Array([1]))).length, 64);
});
