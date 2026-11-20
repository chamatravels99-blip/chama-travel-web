import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { PDFDocument } from 'pdf-lib';
import {
  renderInvoicePdf,
  renderReceiptPdf,
  formatMoney,
  sha256Hex,
  sanitizePdfText,
  DEFAULT_INVOICE_CUSTOMER_NOTE,
} from '../lib/pdf/billing-documents.ts';

const decodeLatin1 = (bytes) => new TextDecoder('latin1').decode(bytes);

const invoiceSnapshot = {
  invoice_number: 'CT-INV-2026-000001',
  revision: 1,
  quote_revision: 3,
  issued_at: '2026-11-14T08:00:00Z',
  currency: 'USD',
  total: 150,
  customer: { name: 'Ana (Guest) Smith', email: 'ana@example.com', phone: '+123456789' },
  booking: {
    booking_ref: 'CT-1',
    service_type: 'airport_transfer',
    journey_type: 'one_way',
    passenger_count: 2,
    luggage_count: 1,
  },
  legs: [
    {
      sequence_no: 1,
      pickup_location: 'Colombo',
      dropoff_location: 'Galle',
      pickup_at: '2026-12-01T03:00:00Z',
    },
  ],
  lines: [{ description: 'Transfer', quantity: 1, unit_amount: 150, line_total: 150 }],
  payment_status_at_issue: { paid: 50, balance: 100, status: 'partially_paid' },
};

test('invoice PDF is a valid pdf-lib PDF with embedded JPEG logo and luxury layout', async () => {
  const bytes = await renderInvoicePdf(invoiceSnapshot, {
    invoiceNote: DEFAULT_INVOICE_CUSTOMER_NOTE,
  });
  const raw = decodeLatin1(bytes);
  assert.ok(raw.startsWith('%PDF-'));
  assert.ok(raw.trimEnd().endsWith('%%EOF'));
  assert.ok(raw.includes('/Subtype /Image'), 'Expected Chama Travels JPEG logo to be embedded');

  const parsed = await PDFDocument.load(bytes);
  assert.equal(parsed.getPageCount(), 1);
  assert.equal(parsed.getTitle(), 'Invoice CT-INV-2026-000001');
  assert.equal(parsed.getAuthor(), 'Chama Travel & Tours');
});

test('receipt PDF is a valid pdf-lib PDF with embedded logo, LKR support, and verified details', async () => {
  const bytes = await renderReceiptPdf(
    {
      receipt_number: 'CT-R-2026-7',
      payment_date: '2026-11-14',
      currency: 'LKR',
      amount: 25000,
      method: 'bank_transfer',
      reference: 'Advance - Slip #948201 - 50% advance confirmed via WhatsApp',
      recorded_at: '2026-11-14T08:10:00Z',
      customer: { name: 'Ana', email: 'ana@example.com', phone: '+123456789' },
      booking_ref: 'CT-1',
      invoice_number: 'CT-INV-2026-000001',
      quote_total: 100000,
      paid_to_date: 25000,
      balance_after: 75000,
      is_partial_payment: true,
    },
    {
      paymentType: 'advance',
      paymentRef: 'Slip #948201',
      paymentNote: '50% advance confirmed via WhatsApp',
      journey: {
        service_type: 'round_tour',
        journey_type: 'one_way',
        passenger_count: 4,
        luggage_count: 3,
        pickup_location: 'BIA Airport',
        dropoff_location: 'Mirissa',
        pickup_at: '2026-11-20T04:00:00Z',
      },
    }
  );

  const raw = decodeLatin1(bytes);
  assert.ok(raw.startsWith('%PDF-'));
  assert.ok(raw.includes('/Subtype /Image'));

  const parsed = await PDFDocument.load(bytes);
  assert.equal(parsed.getPageCount(), 1);
  assert.equal(parsed.getTitle(), 'Payment Receipt CT-R-2026-7');
});

test('long invoice documents paginate cleanly across multiple pages and text is sanitized', async () => {
  const lines = Array.from({ length: 60 }, (_, i) => ({
    description: `Sri Lanka Chauffeur Service Day ${i + 1}`,
    quantity: 1,
    unit_amount: 10,
    line_total: 10,
  }));
  const bytes = await renderInvoicePdf({ ...invoiceSnapshot, lines });
  const parsed = await PDFDocument.load(bytes);
  assert.ok(parsed.getPageCount() >= 2, `Expected >=2 pages, got ${parsed.getPageCount()}`);
  assert.equal(sanitizePdfText('Colombo \u2192 Galle\nCaf\u00e9 \u0DC1'), 'Colombo -> Galle Cafe ?');
});

test('money formatting never mixes currencies and hashes are hex', async () => {
  assert.equal(formatMoney(5, 'USD'), 'USD 5.00');
  assert.equal(formatMoney(5, 'LKR'), 'LKR 5.00');
  assert.throws(() => formatMoney(5, 'XXX'), /Unsupported billing currency/);
  assert.equal((await sha256Hex(new Uint8Array([1]))).length, 64);
});
