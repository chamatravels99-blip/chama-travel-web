const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AdminDriverHireOfferInput = {
  assignmentId: string;
  amount: string;
  currency: 'LKR' | 'USD';
  requestId: string;
};

export type AdminDriverHirePayoutInput = {
  assignmentId: string;
  amount: string;
  paymentDate: string;
  method: 'cash' | 'bank_transfer';
  reference: string;
  requestId: string;
};

function isValidAmount(value: string) {
  return /^\d{1,10}(?:\.\d{1,2})?$/.test(value) &&
    Number.isFinite(Number(value)) &&
    Number(value) > 0;
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function parseAdminDriverHireOfferInput(input: unknown): AdminDriverHireOfferInput | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const body = input as Record<string, unknown>;
  const assignmentId = typeof body.assignment_id === 'string' ? body.assignment_id : '';
  const amount = typeof body.amount === 'string' ? body.amount : String(body.amount ?? '');
  const currency = body.currency;
  const requestId = typeof body.request_id === 'string' ? body.request_id : '';
  if (!UUID_PATTERN.test(assignmentId) || !UUID_PATTERN.test(requestId) ||
      !isValidAmount(amount) || (currency !== 'LKR' && currency !== 'USD')) {
    return null;
  }
  return { assignmentId, amount, currency, requestId };
}

export function parseAdminDriverHirePayoutInput(input: unknown): AdminDriverHirePayoutInput | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const body = input as Record<string, unknown>;
  const assignmentId = typeof body.assignment_id === 'string' ? body.assignment_id : '';
  const amount = typeof body.amount === 'string' ? body.amount : String(body.amount ?? '');
  const paymentDate = typeof body.payment_date === 'string' ? body.payment_date : '';
  const method = body.method;
  const reference = typeof body.reference === 'string' ? body.reference.trim() : '';
  const requestId = typeof body.request_id === 'string' ? body.request_id : '';
  if (!UUID_PATTERN.test(assignmentId) || !UUID_PATTERN.test(requestId) ||
      !isValidAmount(amount) || !isValidDate(paymentDate) ||
      (method !== 'cash' && method !== 'bank_transfer') ||
      (body.reference !== undefined && body.reference !== null && typeof body.reference !== 'string') ||
      reference.length > 160) {
    return null;
  }
  return { assignmentId, amount, paymentDate, method, reference, requestId };
}
