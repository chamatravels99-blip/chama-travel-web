import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import { PDF_LOGO_JPG_BASE64 } from './logo-asset.ts';

type Json = Record<string, unknown>;

export const COMPANY_NAME = 'Chama Travel & Tours';
export const COMPANY_ADDRESS = '152/1, Kahambilihena, Udathuththiripitiya, Gampaha, Sri Lanka';
export const COMPANY_PHONE = '+94 71 111 4901';
export const COMPANY_EMAIL = 'info@chamatravels.com';
export const COMPANY_WEBSITE = 'www.chamatravels.com';

export const DEFAULT_INVOICE_CUSTOMER_NOTE =
  'Includes private air-conditioned vehicle, fuel, driver allowance, and highway tolls. Entrance tickets and personal expenses are excluded unless specified.';

export const DEFAULT_RECEIPT_CUSTOMER_NOTE =
  'Payment received with thanks. Thank you for choosing Chama Travel & Tours for your journey in Sri Lanka!';

export interface InvoiceRenderOptions {
  invoiceNote?: string | null;
}

export interface ReceiptRenderOptions {
  paymentType?: 'full' | 'advance' | 'part' | string | null;
  paymentNote?: string | null;
  paymentRef?: string | null;
  journey?: {
    service_type?: string | null;
    journey_type?: string | null;
    passenger_count?: number | null;
    luggage_count?: number | null;
    pickup_location?: string | null;
    dropoff_location?: string | null;
    pickup_at?: string | null;
  } | null;
}

// A4 dimensions in points
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 42;
const MARGIN_TOP = 40;
const FOOTER_RESERVE = 64;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

// Luxury high-contrast palette
const COLOR_NAVY = rgb(15 / 255, 23 / 255, 42 / 255);        // #0F172A
const COLOR_BLUE = rgb(29 / 255, 78 / 255, 216 / 255);       // #1D4ED8
const COLOR_BLUE_LIGHT = rgb(239 / 255, 246 / 255, 255 / 255); // #EFF6FF
const COLOR_EMERALD = rgb(4 / 255, 120 / 255, 87 / 255);     // #047857
const COLOR_EMERALD_BG = rgb(236 / 255, 253 / 255, 245 / 255); // #ECFDF5
const COLOR_AMBER = rgb(180 / 255, 83 / 255, 9 / 255);       // #B45309
const COLOR_AMBER_BG = rgb(255 / 255, 251 / 255, 235 / 255); // #FFFBEB
const COLOR_ROSE = rgb(190 / 255, 18 / 255, 60 / 255);       // #BE123C
const COLOR_ROSE_BG = rgb(255 / 255, 241 / 255, 242 / 255);  // #FFF1F2
const COLOR_SLATE_700 = rgb(51 / 255, 65 / 255, 85 / 255);   // #334155
const COLOR_SLATE_500 = rgb(100 / 255, 116 / 255, 139 / 255); // #64748B
const COLOR_CARD_BG = rgb(248 / 255, 250 / 255, 252 / 255);  // #F8FAFC
const COLOR_TABLE_HEAD = rgb(241 / 255, 245 / 255, 249 / 255); // #F1F5F9
const COLOR_BORDER = rgb(226 / 255, 232 / 255, 240 / 255);   // #E2E8F0
const COLOR_WHITE = rgb(1, 1, 1);

function str(value: unknown, fallback = '-'): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return fallback;
}

function obj(value: unknown): Json {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : {};
}

/** Sanitizes text into WinAnsi-safe ASCII/Latin-1 for pdf-lib StandardFonts. */
export function sanitizePdfText(value: string): string {
  return value
    .replace(/\u2192/g, '->')
    .replace(/\u2014|\u2013/g, '-')
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201C|\u201D/g, '"')
    .replace(/\u2022/g, '·')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[^\x20-\x7e\xA0-\xFF]/g, '?');
}

export function formatMoney(amount: unknown, currency: unknown): string {
  if (currency !== 'LKR' && currency !== 'USD') {
    throw new Error('Unsupported billing currency.');
  }
  const number = Number(amount);
  if (!Number.isFinite(number)) return `${currency} -`;
  return `${currency} ${number.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', {
    timeZone: 'Asia/Colombo',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-GB', {
    timeZone: 'Asia/Colombo',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatServiceLabel(serviceType: unknown, journeyType?: unknown): string {
  const s = typeof serviceType === 'string' ? serviceType.trim() : '';
  const serviceMap: Record<string, string> = {
    airport_transfer: 'Airport Transfer',
    day_trip: 'Day Trip',
    round_tour: 'Chauffeur / Multi-Day Tour',
    vehicle_hire: 'Private Vehicle Hire',
    custom: 'Tailor-Made Sri Lanka Tour',
  };
  const label = serviceMap[s] || (s ? s.replaceAll('_', ' ') : 'Private Tour & Transport');
  const j = typeof journeyType === 'string' ? journeyType.trim().replaceAll('_', ' ') : '';
  return j ? `${label} (${j})` : label;
}

function formatMethodLabel(method: unknown): string {
  const m = typeof method === 'string' ? method.trim().toLowerCase() : '';
  if (m === 'bank_transfer') return 'Bank Transfer';
  if (m === 'cash') return 'Cash';
  if (m === 'card') return 'Card';
  return m ? m.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Cash / Transfer';
}

function decodeBase64ToBytes(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(base64, 'base64');
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const clean = sanitizePdfText(text).trim();
  if (!clean) return [''];
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      if (font.widthOfTextAtSize(word, size) <= maxWidth) {
        current = word;
      } else {
        // Hard-break very long tokens
        let chunk = '';
        for (const ch of word) {
          if (font.widthOfTextAtSize(chunk + ch, size) > maxWidth && chunk) {
            lines.push(chunk);
            chunk = ch;
          } else {
            chunk += ch;
          }
        }
        current = chunk;
      }
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

function drawRightAlignedText(
  page: PDFPage,
  text: string,
  rightX: number,
  y: number,
  font: PDFFont,
  size: number,
  color: RGB
) {
  const safe = sanitizePdfText(text);
  const width = font.widthOfTextAtSize(safe, size);
  page.drawText(safe, {
    x: rightX - width,
    y,
    size,
    font,
    color,
  });
}

function drawStatusPill(
  page: PDFPage,
  label: string,
  rightX: number,
  y: number,
  fontBold: PDFFont,
  variant: 'paid' | 'partial' | 'unpaid'
) {
  const safe = sanitizePdfText(label.toUpperCase());
  const size = 8;
  const textWidth = fontBold.widthOfTextAtSize(safe, size);
  const padX = 8;
  const pillW = textWidth + padX * 2;
  const pillH = 16;
  const bg =
    variant === 'paid'
      ? COLOR_EMERALD_BG
      : variant === 'partial'
        ? COLOR_AMBER_BG
        : COLOR_ROSE_BG;
  const fg =
    variant === 'paid'
      ? COLOR_EMERALD
      : variant === 'partial'
        ? COLOR_AMBER
        : COLOR_ROSE;

  page.drawRectangle({
    x: rightX - pillW,
    y: y - 4,
    width: pillW,
    height: pillH,
    color: bg,
    borderColor: fg,
    borderWidth: 0.75,
  });

  page.drawText(safe, {
    x: rightX - pillW + padX,
    y: y + 1,
    size,
    font: fontBold,
    color: fg,
  });
}

function drawBrandedFooter(
  pages: PDFPage[],
  fontRegular: PDFFont,
  fontBold: PDFFont
) {
  const totalPages = pages.length;
  pages.forEach((page, index) => {
    const dividerY = 44;
    page.drawLine({
      start: { x: MARGIN_X, y: dividerY },
      end: { x: PAGE_WIDTH - MARGIN_X, y: dividerY },
      thickness: 0.75,
      color: COLOR_BORDER,
    });

    const footerMain = sanitizePdfText(
      `Thank you for traveling with ${COMPANY_NAME}!  ·  24/7 Hotline: ${COMPANY_PHONE}  ·  ${COMPANY_EMAIL}`
    );
    page.drawText(footerMain, {
      x: MARGIN_X,
      y: 28,
      size: 8,
      font: fontBold,
      color: COLOR_SLATE_700,
    });

    drawRightAlignedText(
      page,
      `Page ${index + 1} of ${totalPages}`,
      PAGE_WIDTH - MARGIN_X,
      28,
      fontRegular,
      8,
      COLOR_SLATE_500
    );
  });
}

async function drawBrandedHeader(params: {
  pdfDoc: PDFDocument;
  page: PDFPage;
  fontRegular: PDFFont;
  fontBold: PDFFont;
  fontMono: PDFFont;
  docType: 'invoice' | 'receipt';
  documentNumber: string;
  issueDate: string;
  bookingRef: string;
  paymentStatusLabel: string;
  paymentStatusVariant: 'paid' | 'partial' | 'unpaid';
}): Promise<{ leftY: number; rightBottomY: number }> {
  const {
    pdfDoc,
    page,
    fontRegular,
    fontBold,
    fontMono,
    docType,
    documentNumber,
    issueDate,
    bookingRef,
    paymentStatusLabel,
    paymentStatusVariant,
  } = params;

  const topY = PAGE_HEIGHT - MARGIN_TOP;
  const accentColor = docType === 'receipt' ? COLOR_EMERALD : COLOR_BLUE;
  const leftColWidth = 310;

  // Top luxury accent bar across full width
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 8,
    width: PAGE_WIDTH,
    height: 8,
    color: accentColor,
  });

  // 1. Top-left: Logo, followed directly below by the left-aligned "From" block
  let leftY = topY;
  try {
    const logoBytes = decodeBase64ToBytes(PDF_LOGO_JPG_BASE64);
    const logoImg = await pdfDoc.embedJpg(logoBytes);
    const dims = logoImg.scaleToFit(155, 158);
    page.drawImage(logoImg, {
      x: MARGIN_X,
      y: topY - dims.height + 6,
      width: dims.width,
      height: dims.height,
    });
    leftY = topY - dims.height - 14;
  } catch {
    // Graceful fallback if logo cannot be embedded
    leftY = topY - 4;
  }

  // "From" block (left-aligned directly below the logo)
  page.drawText('FROM', {
    x: MARGIN_X,
    y: leftY,
    size: 7.5,
    font: fontBold,
    color: accentColor,
  });
  leftY -= 12;

  page.drawText(sanitizePdfText(COMPANY_NAME), {
    x: MARGIN_X,
    y: leftY,
    size: 11,
    font: fontBold,
    color: COLOR_NAVY,
  });
  leftY -= 12.5;

  const addrLines = wrapText(COMPANY_ADDRESS, fontRegular, 8, leftColWidth);
  for (const line of addrLines) {
    page.drawText(line, {
      x: MARGIN_X,
      y: leftY,
      size: 8,
      font: fontRegular,
      color: COLOR_SLATE_500,
    });
    leftY -= 10.5;
  }

  page.drawText(sanitizePdfText(`Phone / WhatsApp: ${COMPANY_PHONE}`), {
    x: MARGIN_X,
    y: leftY,
    size: 8,
    font: fontBold,
    color: COLOR_SLATE_700,
  });
  leftY -= 10.5;

  page.drawText(sanitizePdfText(`Email: ${COMPANY_EMAIL}  |  Web: ${COMPANY_WEBSITE}`), {
    x: MARGIN_X,
    y: leftY,
    size: 8,
    font: fontRegular,
    color: COLOR_SLATE_500,
  });
  leftY -= 14;

  // 2. Top-right Document Title Badge + Metadata (unchanged)
  const rightX = PAGE_WIDTH - MARGIN_X;
  const badgeLabel = docType === 'receipt' ? 'PAYMENT RECEIPT' : 'INVOICE';
  const badgeTextW = fontBold.widthOfTextAtSize(badgeLabel, 12);
  const badgeW = badgeTextW + 24;
  const badgeH = 24;

  page.drawRectangle({
    x: rightX - badgeW,
    y: topY - 14,
    width: badgeW,
    height: badgeH,
    color: accentColor,
  });

  page.drawText(badgeLabel, {
    x: rightX - badgeW + 12,
    y: topY - 6,
    size: 12,
    font: fontBold,
    color: COLOR_WHITE,
  });

  drawRightAlignedText(page, documentNumber, rightX, topY - 29, fontMono, 10, COLOR_NAVY);
  drawRightAlignedText(
    page,
    `Issue Date: ${issueDate}`,
    rightX,
    topY - 42,
    fontRegular,
    8.5,
    COLOR_SLATE_700
  );
  drawRightAlignedText(
    page,
    `Booking Ref: ${bookingRef}`,
    rightX,
    topY - 54,
    fontBold,
    8.5,
    COLOR_SLATE_700
  );

  drawStatusPill(page, paymentStatusLabel, rightX, topY - 72, fontBold, paymentStatusVariant);

  return {
    leftY,
    rightBottomY: topY - 84,
  };
}

function drawLeftAlignedInfoStack(params: {
  page: PDFPage;
  startY: number;
  rightBottomY: number;
  fontRegular: PDFFont;
  fontBold: PDFFont;
  customerTitle: string;
  customerRows: Array<{ label: string; value: string; bold?: boolean }>;
  journeyTitle: string;
  journeyRows: Array<{ label: string; value: string; bold?: boolean }>;
  accentColor: RGB;
}): number {
  const {
    page,
    startY,
    rightBottomY,
    fontRegular,
    fontBold,
    customerTitle,
    customerRows,
    journeyTitle,
    journeyRows,
    accentColor,
  } = params;

  const maxBlockWidth = 360;
  let y = startY;

  const drawBlock = (
    title: string,
    rows: Array<{ label: string; value: string; bold?: boolean }>
  ) => {
    page.drawText(sanitizePdfText(title.toUpperCase()), {
      x: MARGIN_X,
      y,
      size: 7.5,
      font: fontBold,
      color: accentColor,
    });
    y -= 12;

    for (const row of rows) {
      const font = row.bold ? fontBold : fontRegular;
      const size = row.bold ? 9.5 : 8.5;
      const color = row.bold ? COLOR_NAVY : COLOR_SLATE_700;
      const prefix = row.bold ? '' : `${row.label}: `;
      const lines = wrapText(`${prefix}${row.value}`, font, size, maxBlockWidth);
      for (const line of lines) {
        page.drawText(line, {
          x: MARGIN_X,
          y,
          size,
          font,
          color,
        });
        y -= row.bold ? 12 : 11;
      }
    }
    y -= 10;
  };

  // Directly below From block on the LEFT side:
  drawBlock(customerTitle, customerRows);
  // Directly below Bill to / Received from block on the LEFT side:
  drawBlock(journeyTitle, journeyRows);

  const dividerY = Math.min(y + 2, rightBottomY - 8);
  page.drawLine({
    start: { x: MARGIN_X, y: dividerY },
    end: { x: PAGE_WIDTH - MARGIN_X, y: dividerY },
    thickness: 1,
    color: COLOR_BORDER,
  });

  return dividerY - 14;
}

function drawBoxedCard(params: {
  page: PDFPage;
  startY: number;
  width: number;
  x: number;
  title: string;
  bodyLines: Array<{ label?: string; text: string; bold?: boolean }>;
  fontRegular: PDFFont;
  fontBold: PDFFont;
  bgColor?: RGB;
  borderColor?: RGB;
  titleColor?: RGB;
}): number {
  const {
    page,
    startY,
    width,
    x,
    title,
    bodyLines,
    fontRegular,
    fontBold,
    bgColor = COLOR_CARD_BG,
    borderColor = COLOR_BORDER,
    titleColor = COLOR_NAVY,
  } = params;

  const pad = 12;
  const innerW = width - pad * 2;
  const renderedLines: Array<{ text: string; font: PDFFont; color: RGB; size: number; gapAfter: number }> = [];

  for (const item of bodyLines) {
    const fullText = item.label ? `${item.label}: ${item.text}` : item.text;
    const font = item.bold ? fontBold : fontRegular;
    const wrapped = wrapText(fullText, font, 8.6, innerW);
    wrapped.forEach((line, idx) => {
      renderedLines.push({
        text: line,
        font,
        color: item.bold ? COLOR_NAVY : COLOR_SLATE_700,
        size: 8.6,
        gapAfter: idx === wrapped.length - 1 ? 4 : 0,
      });
    });
  }

  const contentHeight = renderedLines.reduce((acc, l) => acc + 11.5 + l.gapAfter, 0);
  const boxH = 26 + contentHeight + 8;
  const bottomY = startY - boxH;

  page.drawRectangle({
    x,
    y: bottomY,
    width,
    height: boxH,
    color: bgColor,
    borderColor,
    borderWidth: 0.8,
  });

  let y = startY - 16;
  page.drawText(sanitizePdfText(title.toUpperCase()), {
    x: x + pad,
    y,
    size: 8,
    font: fontBold,
    color: titleColor,
  });
  y -= 14;

  for (const line of renderedLines) {
    page.drawText(line.text, {
      x: x + pad,
      y,
      size: line.size,
      font: line.font,
      color: line.color,
    });
    y -= 11.5 + line.gapAfter;
  }

  return bottomY - 12;
}

function parsePaymentReferenceDetails(
  rawReference: unknown,
  explicitType?: string | null,
  explicitNote?: string | null,
  explicitRef?: string | null,
  isPartialPayment?: boolean
): { paymentTypeLabel: string; transactionRef: string | null; paymentNote: string } {
  const refStr = typeof rawReference === 'string' ? rawReference.trim() : '';

  let paymentTypeLabel = isPartialPayment ? 'Part Payment' : 'Full Balance Payment';
  if (explicitType === 'advance') {
    paymentTypeLabel = 'Advance Payment';
  } else if (explicitType === 'part') {
    paymentTypeLabel = 'Part Payment';
  } else if (explicitType === 'full') {
    paymentTypeLabel = 'Full Balance Payment';
  } else if (/^advance\b/i.test(refStr)) {
    paymentTypeLabel = 'Advance Payment';
  } else if (/^part payment\b/i.test(refStr)) {
    paymentTypeLabel = 'Part Payment';
  } else if (/^balance payment\b|^full balance/i.test(refStr)) {
    paymentTypeLabel = 'Full Balance Payment';
  }

  let transactionRef: string | null = explicitRef?.trim() || null;
  let paymentNote = explicitNote?.trim() || '';

  if (!transactionRef && !paymentNote && refStr) {
    const parts = refStr.split(' - ').map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0 && /^(advance|part payment|balance payment|full balance payment)$/i.test(parts[0])) {
      parts.shift();
    }
    if (parts.length === 1) {
      transactionRef = parts[0];
    } else if (parts.length >= 2) {
      transactionRef = parts[0];
      paymentNote = parts.slice(1).join(' - ');
    }
  }

  return {
    paymentTypeLabel,
    transactionRef,
    paymentNote: paymentNote || DEFAULT_RECEIPT_CUSTOMER_NOTE,
  };
}

/** Renders a luxury branded Invoice PDF strictly from its immutable issue-time snapshot. */
export async function renderInvoicePdf(
  snapshotInput: unknown,
  options: InvoiceRenderOptions = {}
): Promise<Uint8Array> {
  const snapshot = obj(snapshotInput);
  const currency = snapshot.currency;
  // Validate currency upfront
  formatMoney(snapshot.total ?? 0, currency);

  const customer = obj(snapshot.customer);
  const booking = obj(snapshot.booking);
  const payment = obj(snapshot.payment_status_at_issue);
  const legs = Array.isArray(snapshot.legs) ? snapshot.legs.map(obj) : [];
  const lines = Array.isArray(snapshot.lines) ? snapshot.lines.map(obj) : [];

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`Invoice ${str(snapshot.invoice_number)}`);
  pdfDoc.setAuthor(COMPANY_NAME);

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  const statusRaw = String(payment.status ?? 'unpaid').toLowerCase();
  const statusVariant: 'paid' | 'partial' | 'unpaid' =
    statusRaw === 'paid' ? 'paid' : statusRaw === 'partially_paid' ? 'partial' : 'unpaid';
  const statusLabel =
    statusVariant === 'paid'
      ? 'PAID'
      : statusVariant === 'partial'
        ? 'PARTIALLY PAID'
        : 'UNPAID';

  const headerPos = await drawBrandedHeader({
    pdfDoc,
    page,
    fontRegular,
    fontBold,
    fontMono,
    docType: 'invoice',
    documentNumber: str(snapshot.invoice_number),
    issueDate: formatDate(snapshot.issued_at),
    bookingRef: str(booking.booking_ref),
    paymentStatusLabel: statusLabel,
    paymentStatusVariant: statusVariant,
  });

  // Build route summary from legs
  const firstLeg = legs[0];
  const lastLeg = legs[legs.length - 1] ?? firstLeg;
  const routeText = firstLeg
    ? `${str(firstLeg.pickup_location)} -> ${str(lastLeg?.dropoff_location ?? firstLeg.dropoff_location)}`
    : 'Custom Sri Lanka Itinerary';
  const travelDateText = firstLeg?.pickup_at ? formatDateTime(firstLeg.pickup_at) : 'As scheduled';

  const leftRows: Array<{ label: string; value: string; bold?: boolean }> = [
    { label: 'Customer Name', value: str(customer.name), bold: true },
    ...(customer.email ? [{ label: 'Email', value: str(customer.email) }] : []),
    ...(customer.phone ? [{ label: 'Phone / WhatsApp', value: str(customer.phone) }] : []),
  ];

  const rightRows: Array<{ label: string; value: string; bold?: boolean }> = [
    { label: 'Route', value: routeText },
    { label: 'Date & Time', value: travelDateText },
    { label: 'Service Type', value: formatServiceLabel(booking.service_type, booking.journey_type) },
    {
      label: 'Passengers',
      value: `${str(booking.passenger_count, '1')} Passenger(s) · ${str(booking.luggage_count, '0')} Bag(s)`,
    },
  ];

  let cursorY = drawLeftAlignedInfoStack({
    page,
    startY: headerPos.leftY,
    rightBottomY: headerPos.rightBottomY,
    fontRegular,
    fontBold,
    customerTitle: 'Bill to',
    customerRows: leftRows,
    journeyTitle: 'Journey details',
    journeyRows: rightRows,
    accentColor: COLOR_BLUE,
  });

  // Optional Multi-Leg Summary if more than 1 leg
  if (legs.length > 1) {
    const legLines = legs.map((leg, i) => ({
      text: `Leg ${str(leg.sequence_no, String(i + 1))}: ${str(leg.pickup_location)} -> ${str(leg.dropoff_location)} (${formatDateTime(leg.pickup_at)})`,
    }));
    cursorY = drawBoxedCard({
      page,
      startY: cursorY,
      x: MARGIN_X,
      width: CONTENT_WIDTH,
      title: 'ITINERARY SCHEDULE',
      bodyLines: legLines,
      fontRegular,
      fontBold,
      titleColor: COLOR_BLUE,
    });
  }

  // Itemized Service Table
  const ensureSpace = (needed: number) => {
    if (cursorY - needed < FOOTER_RESERVE) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      page.drawRectangle({
        x: 0,
        y: PAGE_HEIGHT - 8,
        width: PAGE_WIDTH,
        height: 8,
        color: COLOR_BLUE,
      });
      cursorY = PAGE_HEIGHT - MARGIN_TOP;
    }
  };

  const drawTableHeader = () => {
    ensureSpace(32);
    const headerH = 24;
    page.drawRectangle({
      x: MARGIN_X,
      y: cursorY - headerH,
      width: CONTENT_WIDTH,
      height: headerH,
      color: COLOR_TABLE_HEAD,
      borderColor: COLOR_BORDER,
      borderWidth: 0.75,
    });
    const textY = cursorY - 15.5;
    page.drawText('SERVICE DESCRIPTION', {
      x: MARGIN_X + 10,
      y: textY,
      size: 8,
      font: fontBold,
      color: COLOR_SLATE_700,
    });
    drawRightAlignedText(page, 'QTY', MARGIN_X + 325, textY, fontBold, 8, COLOR_SLATE_700);
    drawRightAlignedText(page, 'UNIT PRICE', MARGIN_X + 415, textY, fontBold, 8, COLOR_SLATE_700);
    drawRightAlignedText(page, 'AMOUNT', PAGE_WIDTH - MARGIN_X - 10, textY, fontBold, 8, COLOR_SLATE_700);
    cursorY -= headerH;
  };

  drawTableHeader();

  const effectiveLines =
    lines.length > 0
      ? lines
      : [
          {
            description: `${formatServiceLabel(booking.service_type)} (${routeText})`,
            quantity: 1,
            unit_amount: snapshot.total,
            line_total: snapshot.total,
          },
        ];

  effectiveLines.forEach((line, idx) => {
    const descLines = wrapText(str(line.description, 'Chauffeur & Transport Service'), fontRegular, 9, 270);
    const rowH = Math.max(24, descLines.length * 12 + 10);
    if (cursorY - rowH < FOOTER_RESERVE) {
      ensureSpace(rowH + 30);
      drawTableHeader();
    }

    const rowBottom = cursorY - rowH;
    if (idx % 2 === 1) {
      page.drawRectangle({
        x: MARGIN_X,
        y: rowBottom,
        width: CONTENT_WIDTH,
        height: rowH,
        color: COLOR_CARD_BG,
      });
    }

    page.drawLine({
      start: { x: MARGIN_X, y: rowBottom },
      end: { x: PAGE_WIDTH - MARGIN_X, y: rowBottom },
      thickness: 0.5,
      color: COLOR_BORDER,
    });

    let lineY = cursorY - 14;
    for (const dl of descLines) {
      page.drawText(dl, {
        x: MARGIN_X + 10,
        y: lineY,
        size: 9,
        font: fontRegular,
        color: COLOR_NAVY,
      });
      lineY -= 12;
    }

    const valY = cursorY - 14;
    drawRightAlignedText(page, str(line.quantity, '1'), MARGIN_X + 325, valY, fontRegular, 9, COLOR_SLATE_700);
    drawRightAlignedText(page, formatMoney(line.unit_amount, currency), MARGIN_X + 415, valY, fontRegular, 9, COLOR_SLATE_700);
    drawRightAlignedText(page, formatMoney(line.line_total, currency), PAGE_WIDTH - MARGIN_X - 10, valY, fontBold, 9, COLOR_NAVY);

    cursorY = rowBottom;
  });

  cursorY -= 14;

  // Right-Aligned Financial Totals Summary Box
  ensureSpace(96);
  const totalsW = 245;
  const totalsX = PAGE_WIDTH - MARGIN_X - totalsW;
  const totalsH = 82;
  const totalsBottom = cursorY - totalsH;

  page.drawRectangle({
    x: totalsX,
    y: totalsBottom,
    width: totalsW,
    height: totalsH,
    color: COLOR_CARD_BG,
    borderColor: COLOR_BORDER,
    borderWidth: 0.9,
  });

  let ty = cursorY - 18;
  page.drawText('Total Quoted Amount', {
    x: totalsX + 12,
    y: ty,
    size: 9,
    font: fontBold,
    color: COLOR_SLATE_700,
  });
  drawRightAlignedText(page, formatMoney(snapshot.total, currency), PAGE_WIDTH - MARGIN_X - 12, ty, fontBold, 9.5, COLOR_NAVY);

  ty -= 18;
  page.drawText('Total Paid to Date', {
    x: totalsX + 12,
    y: ty,
    size: 9,
    font: fontRegular,
    color: COLOR_SLATE_700,
  });
  drawRightAlignedText(page, formatMoney(payment.paid ?? 0, currency), PAGE_WIDTH - MARGIN_X - 12, ty, fontBold, 9, COLOR_EMERALD);

  ty -= 12;
  page.drawLine({
    start: { x: totalsX + 10, y: ty },
    end: { x: PAGE_WIDTH - MARGIN_X - 10, y: ty },
    thickness: 0.8,
    color: COLOR_BORDER,
  });

  ty -= 18;
  page.drawText('Remaining Balance', {
    x: totalsX + 12,
    y: ty,
    size: 10.5,
    font: fontBold,
    color: COLOR_NAVY,
  });
  const balanceNum = Number(payment.balance ?? 0);
  drawRightAlignedText(
    page,
    formatMoney(balanceNum, currency),
    PAGE_WIDTH - MARGIN_X - 12,
    ty,
    fontBold,
    11,
    balanceNum > 0 ? COLOR_BLUE : COLOR_EMERALD
  );

  // Revision / Quote meta on left side next to Totals box
  let metaY = cursorY - 16;
  const metaItems = [
    `Invoice Revision: #${str(snapshot.revision, '1')}`,
    ...(snapshot.quote_revision ? [`Accepted Quote: Revision #${str(snapshot.quote_revision)}`] : []),
    ...(snapshot.supersedes_invoice_number
      ? [`Replaces Invoice: ${str(snapshot.supersedes_invoice_number)}`]
      : []),
    `Currency: ${str(currency)}`,
  ];
  for (const m of metaItems) {
    page.drawText(sanitizePdfText(m), {
      x: MARGIN_X,
      y: metaY,
      size: 8.2,
      font: fontRegular,
      color: COLOR_SLATE_500,
    });
    metaY -= 13;
  }

  cursorY = totalsBottom - 16;

  // Payment Information Card (No dummy bank account numbers)
  ensureSpace(95);
  cursorY = drawBoxedCard({
    page,
    startY: cursorY,
    x: MARGIN_X,
    width: CONTENT_WIDTH,
    title: 'PAYMENT INFORMATION & TERMS',
    bodyLines: [
      {
        label: 'Accepted Payment Methods',
        text: 'Cash on Arrival  |  Bank Transfer (bank details shared upon request)',
        bold: true,
      },
      {
        label: 'Payment Terms',
        text: 'Advance payment confirms your reservation; remaining balance payable prior to or upon tour commencement.',
      },
    ],
    fontRegular,
    fontBold,
    bgColor: COLOR_BLUE_LIGHT,
    borderColor: COLOR_BORDER,
    titleColor: COLOR_BLUE,
  });

  // Customer-Facing Notes & Inclusions Card (NEVER internal admin notes)
  const customerNote =
    (typeof options.invoiceNote === 'string' && options.invoiceNote.trim()) ||
    (typeof snapshot.invoice_note === 'string' && snapshot.invoice_note.trim()) ||
    DEFAULT_INVOICE_CUSTOMER_NOTE;

  ensureSpace(80);
  drawBoxedCard({
    page,
    startY: cursorY,
    x: MARGIN_X,
    width: CONTENT_WIDTH,
    title: 'NOTES & INCLUSIONS',
    bodyLines: [{ text: customerNote }],
    fontRegular,
    fontBold,
    bgColor: COLOR_CARD_BG,
    borderColor: COLOR_BORDER,
    titleColor: COLOR_NAVY,
  });

  drawBrandedFooter(pdfDoc.getPages(), fontRegular, fontBold);
  return pdfDoc.save();
}

/** Renders a luxury branded Payment Receipt PDF from its recorded payment snapshot. */
export async function renderReceiptPdf(
  snapshotInput: unknown,
  options: ReceiptRenderOptions = {}
): Promise<Uint8Array> {
  const snapshot = obj(snapshotInput);
  const currency = snapshot.currency;
  formatMoney(snapshot.amount ?? 0, currency);

  const customer = obj(snapshot.customer);
  const bookingObj = obj(snapshot.booking);
  const journeyOpt = options.journey;

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`Payment Receipt ${str(snapshot.receipt_number)}`);
  pdfDoc.setAuthor(COMPANY_NAME);

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);

  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  const balanceAfter = Number(snapshot.balance_after ?? 0);
  const isPartial = Boolean(snapshot.is_partial_payment) || balanceAfter > 0;
  const statusVariant: 'paid' | 'partial' = isPartial ? 'partial' : 'paid';
  const statusLabel = isPartial ? 'PARTIALLY PAID' : 'PAID IN FULL';

  const headerPos = await drawBrandedHeader({
    pdfDoc,
    page,
    fontRegular,
    fontBold,
    fontMono,
    docType: 'receipt',
    documentNumber: str(snapshot.receipt_number),
    issueDate: formatDate(snapshot.payment_date || snapshot.recorded_at),
    bookingRef: str(snapshot.booking_ref || bookingObj.booking_ref),
    paymentStatusLabel: statusLabel,
    paymentStatusVariant: statusVariant,
  });

  const leftRows: Array<{ label: string; value: string; bold?: boolean }> = [
    { label: 'Customer Name', value: str(customer.name), bold: true },
    ...(customer.email ? [{ label: 'Email', value: str(customer.email) }] : []),
    ...(customer.phone ? [{ label: 'Phone / WhatsApp', value: str(customer.phone) }] : []),
  ];

  const routeFromJourney =
    journeyOpt?.pickup_location && journeyOpt?.dropoff_location
      ? `${journeyOpt.pickup_location} -> ${journeyOpt.dropoff_location}`
      : null;

  const rightRows: Array<{ label: string; value: string; bold?: boolean }> = [
    ...(routeFromJourney ? [{ label: 'Route', value: routeFromJourney }] : []),
    ...(journeyOpt?.pickup_at
      ? [{ label: 'Date & Time', value: formatDateTime(journeyOpt.pickup_at) }]
      : []),
    ...(journeyOpt?.service_type
      ? [{ label: 'Service Type', value: formatServiceLabel(journeyOpt.service_type, journeyOpt.journey_type) }]
      : []),
    ...(journeyOpt?.passenger_count
      ? [
          {
            label: 'Passengers',
            value: `${journeyOpt.passenger_count} Passenger(s)${
              journeyOpt.luggage_count ? ` · ${journeyOpt.luggage_count} Bag(s)` : ''
            }`,
          },
        ]
      : []),
    ...(snapshot.invoice_number
      ? [{ label: 'Linked Invoice', value: str(snapshot.invoice_number) }]
      : []),
    ...(!journeyOpt?.pickup_location && !journeyOpt?.service_type && !snapshot.invoice_number
      ? [{ label: 'Booking Ref', value: str(snapshot.booking_ref || bookingObj.booking_ref) }]
      : []),
  ];

  let cursorY = drawLeftAlignedInfoStack({
    page,
    startY: headerPos.leftY,
    rightBottomY: headerPos.rightBottomY,
    fontRegular,
    fontBold,
    customerTitle: 'Received from',
    customerRows: leftRows,
    journeyTitle: 'Journey details',
    journeyRows: rightRows,
    accentColor: COLOR_EMERALD,
  });

  const { paymentTypeLabel, transactionRef, paymentNote } = parsePaymentReferenceDetails(
    snapshot.reference,
    options.paymentType,
    options.paymentNote,
    options.paymentRef,
    isPartial
  );

  // Payment Summary Table
  const headerH = 24;
  page.drawRectangle({
    x: MARGIN_X,
    y: cursorY - headerH,
    width: CONTENT_WIDTH,
    height: headerH,
    color: COLOR_TABLE_HEAD,
    borderColor: COLOR_BORDER,
    borderWidth: 0.75,
  });
  page.drawText('PAYMENT DESCRIPTION', {
    x: MARGIN_X + 10,
    y: cursorY - 15.5,
    size: 8,
    font: fontBold,
    color: COLOR_SLATE_700,
  });
  drawRightAlignedText(
    page,
    'AMOUNT RECEIVED',
    PAGE_WIDTH - MARGIN_X - 10,
    cursorY - 15.5,
    fontBold,
    8,
    COLOR_SLATE_700
  );
  cursorY -= headerH;

  const descText = `${paymentTypeLabel} for Booking ${str(snapshot.booking_ref)} (${formatMethodLabel(snapshot.method)})`;
  const rowH = 30;
  page.drawRectangle({
    x: MARGIN_X,
    y: cursorY - rowH,
    width: CONTENT_WIDTH,
    height: rowH,
    color: COLOR_WHITE,
    borderColor: COLOR_BORDER,
    borderWidth: 0.5,
  });
  page.drawText(sanitizePdfText(descText), {
    x: MARGIN_X + 10,
    y: cursorY - 18.5,
    size: 9.5,
    font: fontBold,
    color: COLOR_NAVY,
  });
  drawRightAlignedText(
    page,
    formatMoney(snapshot.amount, currency),
    PAGE_WIDTH - MARGIN_X - 10,
    cursorY - 18.5,
    fontBold,
    10.5,
    COLOR_EMERALD
  );
  cursorY -= rowH + 16;

  // Right-Aligned Financial Totals Box
  const totalsW = 265;
  const totalsX = PAGE_WIDTH - MARGIN_X - totalsW;
  const totalsH = 104;
  const totalsBottom = cursorY - totalsH;

  page.drawRectangle({
    x: totalsX,
    y: totalsBottom,
    width: totalsW,
    height: totalsH,
    color: COLOR_CARD_BG,
    borderColor: COLOR_BORDER,
    borderWidth: 0.9,
  });

  // Highlighted "Amount Paid This Receipt" banner inside totals card
  page.drawRectangle({
    x: totalsX,
    y: cursorY - 26,
    width: totalsW,
    height: 26,
    color: COLOR_EMERALD_BG,
    borderColor: COLOR_BORDER,
    borderWidth: 0.5,
  });
  page.drawText('Amount Paid This Receipt', {
    x: totalsX + 12,
    y: cursorY - 16.5,
    size: 9.5,
    font: fontBold,
    color: COLOR_EMERALD,
  });
  drawRightAlignedText(
    page,
    formatMoney(snapshot.amount, currency),
    PAGE_WIDTH - MARGIN_X - 12,
    cursorY - 16.5,
    fontBold,
    10.5,
    COLOR_EMERALD
  );

  let ty = cursorY - 42;
  page.drawText('Total Quoted Amount', {
    x: totalsX + 12,
    y: ty,
    size: 8.8,
    font: fontRegular,
    color: COLOR_SLATE_700,
  });
  drawRightAlignedText(
    page,
    formatMoney(snapshot.quote_total, currency),
    PAGE_WIDTH - MARGIN_X - 12,
    ty,
    fontBold,
    9,
    COLOR_NAVY
  );

  ty -= 17;
  page.drawText('Total Paid to Date', {
    x: totalsX + 12,
    y: ty,
    size: 8.8,
    font: fontRegular,
    color: COLOR_SLATE_700,
  });
  drawRightAlignedText(
    page,
    formatMoney(snapshot.paid_to_date, currency),
    PAGE_WIDTH - MARGIN_X - 12,
    ty,
    fontBold,
    9,
    COLOR_EMERALD
  );

  ty -= 11;
  page.drawLine({
    start: { x: totalsX + 10, y: ty },
    end: { x: PAGE_WIDTH - MARGIN_X - 10, y: ty },
    thickness: 0.8,
    color: COLOR_BORDER,
  });

  ty -= 17;
  page.drawText('Remaining Balance', {
    x: totalsX + 12,
    y: ty,
    size: 10,
    font: fontBold,
    color: COLOR_NAVY,
  });
  drawRightAlignedText(
    page,
    formatMoney(balanceAfter, currency),
    PAGE_WIDTH - MARGIN_X - 12,
    ty,
    fontBold,
    10.5,
    balanceAfter > 0 ? COLOR_AMBER : COLOR_EMERALD
  );

  // Left side Verified Payment Details Card
  const leftCardW = CONTENT_WIDTH - totalsW - 14;
  drawBoxedCard({
    page,
    startY: cursorY,
    x: MARGIN_X,
    width: leftCardW,
    title: 'VERIFIED PAYMENT DETAILS',
    bodyLines: [
      { label: 'Payment Status', text: 'Verified', bold: true },
      { label: 'Payment Method', text: formatMethodLabel(snapshot.method) },
      { label: 'Payment Type', text: paymentTypeLabel },
      { label: 'Payment Date', text: formatDate(snapshot.payment_date || snapshot.recorded_at) },
      ...(transactionRef ? [{ label: 'Reference / Slip No', text: transactionRef }] : []),
    ],
    fontRegular,
    fontBold,
    bgColor: COLOR_EMERALD_BG,
    borderColor: COLOR_BORDER,
    titleColor: COLOR_EMERALD,
  });

  cursorY = Math.min(totalsBottom, cursorY - 122) - 16;

  // Customer-Facing Payment Notes Card
  drawBoxedCard({
    page,
    startY: cursorY,
    x: MARGIN_X,
    width: CONTENT_WIDTH,
    title: 'PAYMENT NOTES',
    bodyLines: [{ text: paymentNote }],
    fontRegular,
    fontBold,
    bgColor: COLOR_CARD_BG,
    borderColor: COLOR_BORDER,
    titleColor: COLOR_NAVY,
  });

  drawBrandedFooter(pdfDoc.getPages(), fontRegular, fontBold);
  return pdfDoc.save();
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource));
  return Array.from(hash, (b) => b.toString(16).padStart(2, '0')).join('');
}
