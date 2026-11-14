export type AdminCustomerPaymentInput = {
  bookingId: string;
  quoteId: string;
  amount: string;
  method: 'cash' | 'bank_transfer';
  paymentDate: string;
  reference: string;
  requestId: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseAdminCustomerPaymentInput(input: unknown): AdminCustomerPaymentInput | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;

  const body = input as Record<string, unknown>;
  const bookingId = typeof body.booking_id === 'string' ? body.booking_id : '';
  const quoteId = typeof body.quote_id === 'string' ? body.quote_id : '';
  const amount = typeof body.amount === 'string' ? body.amount : String(body.amount ?? '');
  const method = body.method;
  const paymentDate = typeof body.payment_date === 'string' ? body.payment_date : '';
  const reference = typeof body.reference === 'string' ? body.reference.trim() : '';
  const requestId = typeof body.request_id === 'string' ? body.request_id : '';
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(paymentDate)
    ? new Date(`${paymentDate}T00:00:00Z`)
    : null;

  if (method !== 'cash' && method !== 'bank_transfer') return null;
  if (!UUID_PATTERN.test(bookingId) || !UUID_PATTERN.test(quoteId) ||
      !UUID_PATTERN.test(requestId) ||
      !/^\d{1,10}(?:\.\d{1,2})?$/.test(amount) ||
      !Number.isFinite(Number(amount)) || Number(amount) <= 0 ||
      !parsedDate || Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== paymentDate ||
      reference.length > 160) {
    return null;
  }

  return {
    bookingId,
    quoteId,
    amount,
    method,
    paymentDate,
    reference,
    requestId,
  };
}
