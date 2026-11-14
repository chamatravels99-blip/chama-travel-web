import { PdfBuilder } from './pdf-builder.ts';

type Json = Record<string, unknown>;

const COMPANY = 'Chama Travels';
const BUSINESS_EMAIL = 'Info@chamatravels.com';
const BUSINESS_PHONE = '+94 754895335';
const BUSINESS_WEBSITE = 'https://chamatravels.com';

function str(value: unknown, fallback = '-') {
  return typeof value === 'string' && value.trim() ? value : typeof value === 'number' ? String(value) : fallback;
}

function obj(value: unknown): Json {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : {};
}

export function formatMoney(amount: unknown, currency: unknown) {
  if (currency !== 'LKR' && currency !== 'USD') {
    throw new Error('Unsupported billing currency.');
  }
  const code = currency;
  const number = Number(amount);
  if (!Number.isFinite(number)) return `${code} -`;
  return `${code} ${number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value: unknown) {
  if (typeof value !== 'string') return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10);
}

function formatDateTime(value: unknown) {
  if (typeof value !== 'string') return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

function header(pdf: PdfBuilder, title: string, number: string) {
  pdf.text(COMPANY, pdf.left, 20, 'bold');
  pdf.text(title, pdf.right, 20, 'bold', 'right');
  pdf.moveDown(16);
  pdf.text(`${BUSINESS_EMAIL} | ${BUSINESS_PHONE} | ${BUSINESS_WEBSITE}`, pdf.left, 8);
  pdf.moveDown(14);
  pdf.text(number, pdf.right, 11, 'mono', 'right');
  pdf.moveDown(14);
  pdf.rule();
  pdf.moveDown(18);
}

function labelled(pdf: PdfBuilder, label: string, value: string) {
  pdf.ensureSpace(16);
  pdf.text(label, pdf.left, 9, 'bold');
  pdf.paragraph(value, pdf.left + 120, pdf.contentWidth - 120, 10);
}

/** Renders an invoice strictly from its immutable issue-time snapshot. */
export function renderInvoicePdf(snapshotInput: unknown) {
  const snapshot = obj(snapshotInput);
  const currency = snapshot.currency;
  const customer = obj(snapshot.customer);
  const booking = obj(snapshot.booking);
  const payment = obj(snapshot.payment_status_at_issue);
  const pdf = new PdfBuilder();

  header(pdf, 'INVOICE', str(snapshot.invoice_number));
  labelled(pdf, 'Invoice status', 'Issued');
  labelled(pdf, 'Issue date', formatDate(snapshot.issued_at));
  labelled(pdf, 'Revision', str(snapshot.revision, '1'));
  if (snapshot.quote_revision) labelled(pdf, 'Accepted quote', `Revision ${str(snapshot.quote_revision)}`);
  if (snapshot.supersedes_invoice_number) labelled(pdf, 'Replaces', str(snapshot.supersedes_invoice_number));
  labelled(pdf, 'Booking', str(booking.booking_ref));
  labelled(pdf, 'Billed to', str(customer.name));
  if (customer.email) labelled(pdf, 'Email', str(customer.email));
  if (customer.phone) labelled(pdf, 'Phone', str(customer.phone));
  labelled(pdf, 'Service', `${str(booking.service_type).replaceAll('_', ' ')} / ${str(booking.journey_type).replaceAll('_', ' ')}`);
  labelled(pdf, 'Currency', str(currency));
  labelled(pdf, 'Passengers', `${str(booking.passenger_count)} (luggage: ${str(booking.luggage_count, '0')})`);
  pdf.moveDown(6);

  const legs = Array.isArray(snapshot.legs) ? snapshot.legs : [];
  if (legs.length) {
    pdf.ensureSpace(30);
    pdf.text('Trip details', pdf.left, 11, 'bold');
    pdf.moveDown(16);
    for (const raw of legs) {
      const leg = obj(raw);
      pdf.paragraph(
        `${str(leg.sequence_no)}. ${str(leg.pickup_location)} to ${str(leg.dropoff_location)} - ${formatDateTime(leg.pickup_at)}`,
        pdf.left, pdf.contentWidth, 10
      );
    }
    pdf.moveDown(6);
  }

  pdf.ensureSpace(40);
  pdf.rule();
  pdf.moveDown(12);
  pdf.text('Description', pdf.left, 9, 'bold');
  pdf.text('Qty', pdf.left + 300, 9, 'bold');
  pdf.text('Unit', pdf.left + 380, 9, 'bold');
  pdf.text('Amount', pdf.right, 9, 'bold', 'right');
  pdf.moveDown(8);
  pdf.rule();
  pdf.moveDown(14);

  const lines = Array.isArray(snapshot.lines) ? snapshot.lines : [];
  for (const raw of lines) {
    const line = obj(raw);
    pdf.ensureSpace(18);
    pdf.text(str(line.description).slice(0, 52), pdf.left, 10);
    pdf.text(str(line.quantity), pdf.left + 300, 10);
    pdf.text(formatMoney(line.unit_amount, currency), pdf.left + 380, 10);
    pdf.text(formatMoney(line.line_total, currency), pdf.right, 10, 'regular', 'right');
    pdf.moveDown(16);
  }

  pdf.rule();
  pdf.moveDown(16);
  pdf.ensureSpace(70);
  pdf.text('Total', pdf.left + 380, 11, 'bold');
  pdf.text(formatMoney(snapshot.total, currency), pdf.right, 11, 'bold', 'right');
  pdf.moveDown(18);
  pdf.text('Paid at issue', pdf.left + 380, 10);
  pdf.text(formatMoney(payment.paid, currency), pdf.right, 10, 'regular', 'right');
  pdf.moveDown(14);
  pdf.text('Balance at issue', pdf.left + 380, 10);
  pdf.text(formatMoney(payment.balance, currency), pdf.right, 10, 'regular', 'right');
  pdf.moveDown(24);
  pdf.paragraph(
    `Payment status at issue: ${str(payment.status)}. Amounts are in ${currency === 'USD' ? 'USD' : 'LKR'} as agreed in the accepted quote.`,
    pdf.left, pdf.contentWidth, 9
  );
  pdf.moveDown(12);
  const paymentInstructions = (
    process.env.INVOICE_PAYMENT_INSTRUCTIONS?.trim()
      || `Contact ${BUSINESS_EMAIL} or ${BUSINESS_PHONE} for payment instructions. Please quote booking reference ${str(booking.booking_ref)}.`
  ).slice(0, 1200);
  pdf.paragraph(`Payment instructions: ${paymentInstructions}`, pdf.left, pdf.contentWidth, 9);
  return pdf.build();
}

/** Renders a receipt from the snapshot taken when the payment was recorded. */
export function renderReceiptPdf(snapshotInput: unknown) {
  const snapshot = obj(snapshotInput);
  const currency = snapshot.currency;
  const customer = obj(snapshot.customer);
  const pdf = new PdfBuilder();

  header(pdf, 'PAYMENT RECEIPT', str(snapshot.receipt_number));
  labelled(pdf, 'Receipt date', formatDateTime(snapshot.recorded_at));
  labelled(pdf, 'Payment date', formatDate(snapshot.payment_date));
  labelled(pdf, 'Received from', str(customer.name));
  if (customer.email) labelled(pdf, 'Email', str(customer.email));
  if (customer.phone) labelled(pdf, 'Phone', str(customer.phone));
  labelled(pdf, 'Booking', str(snapshot.booking_ref));
  if (snapshot.invoice_number) labelled(pdf, 'Invoice', str(snapshot.invoice_number));
  labelled(pdf, 'Payment status', 'Verified');
  labelled(pdf, 'Method', str(snapshot.method).replaceAll('_', ' '));
  labelled(pdf, 'Reference', str(snapshot.reference));
  labelled(pdf, 'Currency', str(currency));
  pdf.moveDown(8);
  pdf.rule();
  pdf.moveDown(18);
  pdf.text('Amount received', pdf.left, 12, 'bold');
  pdf.text(formatMoney(snapshot.amount, currency), pdf.right, 12, 'bold', 'right');
  pdf.moveDown(22);
  pdf.text('Quote total', pdf.left, 10);
  pdf.text(formatMoney(snapshot.quote_total, currency), pdf.right, 10, 'regular', 'right');
  pdf.moveDown(14);
  pdf.text('Paid to date', pdf.left, 10);
  pdf.text(formatMoney(snapshot.paid_to_date, currency), pdf.right, 10, 'regular', 'right');
  pdf.moveDown(14);
  pdf.text('Balance remaining', pdf.left, 10);
  pdf.text(formatMoney(snapshot.balance_after, currency), pdf.right, 10, 'regular', 'right');
  pdf.moveDown(24);
  pdf.paragraph(
    snapshot.is_partial_payment
      ? 'This is a partial payment; a balance remains outstanding.'
      : 'This payment settles the quoted amount in full.',
    pdf.left, pdf.contentWidth, 9
  );
  return pdf.build();
}

export async function sha256Hex(bytes: Uint8Array) {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource));
  return Array.from(hash, (b) => b.toString(16).padStart(2, '0')).join('');
}
