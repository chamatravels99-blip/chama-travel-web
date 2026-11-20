export type CustomerVipStatus = 'standard' | 'repeat' | 'vip';
export type SupportedCurrency = 'LKR' | 'USD';

export type RawCrmProfileRow = {
  id: string;
  normalized_key: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  country: string | null;
  vip_status: CustomerVipStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type RawCustomerBookingLeg = {
  sequence_no: number;
  pickup_location: string;
  dropoff_location: string;
  pickup_at: string;
  planned_end_at: string | null;
  trip_status: string;
};

export type RawCustomerBookingRow = {
  id: string;
  booking_ref: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  service_type: string;
  journey_type: string;
  booking_status: string;
  requested_currency: string;
  passenger_count: number;
  luggage_count: number;
  customer_notes: string | null;
  created_at: string;
  updated_at?: string;
  legs?: RawCustomerBookingLeg[];
};

export type RawCustomerQuoteRow = {
  id: string;
  booking_id: string;
  revision: number;
  currency: string;
  total: number | string;
  quote_status: string;
  issued_at: string | null;
  expires_at: string | null;
  accepted_at: string | null;
  created_at: string;
};

export type RawCustomerPaymentRow = {
  id: string;
  booking_id: string;
  booking_ref?: string;
  quote_id: string;
  entry_type: 'receipt' | 'refund' | string;
  original_payment_id: string | null;
  amount: number | string;
  currency: string;
  method: string;
  provider_reference: string | null;
  refund_reason: string | null;
  receipt_number: string | null;
  payment_date: string | null;
  verified_at: string;
  created_at: string;
  document_id?: string | null;
  file_status?: 'pending' | 'stored' | string | null;
};

export type RawCustomerInvoiceRow = {
  id: string;
  invoice_number: string;
  booking_id: string;
  booking_ref?: string;
  quote_id: string;
  currency: string;
  total: number | string;
  revision: number;
  invoice_status: string;
  issued_at: string;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  document_id?: string | null;
  file_status?: 'pending' | 'stored' | string | null;
};

export type CustomerCrmSourceData = {
  crm_profiles: RawCrmProfileRow[];
  bookings: RawCustomerBookingRow[];
  quotes: RawCustomerQuoteRow[];
  payments: RawCustomerPaymentRow[];
  invoices: RawCustomerInvoiceRow[];
};

export type CurrencyFinancialSummary = {
  currency: SupportedCurrency;
  total_quoted: number;
  total_booked: number;
  total_paid: number;
  total_refunded: number;
  net_paid: number;
  outstanding_balance: number;
};

export type CustomerBookingRecord = {
  id: string;
  booking_ref: string;
  service_type: string;
  journey_type: string;
  booking_status: string;
  passenger_count: number;
  luggage_count: number;
  customer_notes: string | null;
  created_at: string;
  pickup_at: string | null;
  route_summary: string;
  legs: RawCustomerBookingLeg[];
  currency: SupportedCurrency;
  quoted_amount: number | null;
  quote_status: string | null;
  total_paid: number;
  total_refunded: number;
  net_paid: number;
  outstanding_balance: number;
  payment_status: 'paid' | 'partially_paid' | 'unpaid' | 'refunded' | 'no_quote';
  booking_link: string;
};

export type CustomerPaymentRecord = {
  id: string;
  booking_id: string;
  booking_ref: string;
  quote_id: string;
  entry_type: 'receipt' | 'refund';
  original_payment_id: string | null;
  amount: number;
  currency: SupportedCurrency;
  method: string;
  reference: string | null;
  refund_reason: string | null;
  receipt_number: string | null;
  payment_date: string | null;
  verified_at: string;
  created_at: string;
  status: 'verified' | 'refunded';
  document_id: string | null;
  file_status: 'pending' | 'stored' | null;
  download_url: string | null;
  view_url: string | null;
};

export type CustomerInvoiceRecord = {
  id: string;
  invoice_number: string;
  booking_id: string;
  booking_ref: string;
  quote_id: string;
  currency: SupportedCurrency;
  total: number;
  revision: number;
  status: string;
  issued_at: string;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  document_id: string | null;
  file_status: 'pending' | 'stored' | null;
  download_url: string | null;
  view_url: string | null;
};

export type CustomerReceiptRecord = {
  id: string;
  payment_id: string;
  receipt_number: string;
  booking_id: string;
  booking_ref: string;
  quote_id: string;
  currency: SupportedCurrency;
  amount: number;
  method: string;
  reference: string | null;
  payment_date: string | null;
  verified_at: string;
  document_id: string | null;
  file_status: 'pending' | 'stored' | null;
  download_url: string | null;
  view_url: string | null;
};

export type UnifiedCustomerProfile = {
  id: string;
  crm_profile_id: string | null;
  normalized_key: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  country: string | null;
  vip_status: CustomerVipStatus;
  effective_tier: CustomerVipStatus;
  is_repeat_or_vip: boolean;
  notes: string | null;
  total_bookings: number;
  completed_bookings: number;
  active_upcoming_bookings: number;
  cancelled_bookings: number;
  first_booking_date: string | null;
  last_booking_date: string | null;
  last_trip_date: string | null;
  last_activity_at: string;
  has_outstanding_balance: boolean;
  has_upcoming_trips: boolean;
  financials: {
    LKR: CurrencyFinancialSummary;
    USD: CurrencyFinancialSummary;
  };
  bookings: CustomerBookingRecord[];
  payments: CustomerPaymentRecord[];
  invoices: CustomerInvoiceRecord[];
  receipts: CustomerReceiptRecord[];
};

export type CustomerCrmKpiSummary = {
  total_customers: number;
  repeat_and_vip_customers: number;
  customers_with_outstanding: number;
  customers_with_upcoming_trips: number;
  revenue_collected: {
    LKR: number;
    USD: number;
  };
  outstanding_balances: {
    LKR: number;
    USD: number;
  };
  total_quoted: {
    LKR: number;
    USD: number;
  };
};

export type CustomerCrmOverview = {
  kpis: CustomerCrmKpiSummary;
  customers: UnifiedCustomerProfile[];
};

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_ALLOWED_REGEX = /^\+?[0-9\s().-]{7,30}$/;
const VIP_STATUSES = new Set<CustomerVipStatus>(['standard', 'repeat', 'vip']);

export function normalizeCustomerEmail(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') return null;
  const cleaned = value.trim().toLowerCase();
  if (!cleaned || cleaned.length > 254 || !EMAIL_REGEX.test(cleaned)) return null;
  return cleaned;
}

export function normalizeCustomerPhone(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const compact = trimmed.replace(/[\s().-]/g, '');
  let digitsOnly = compact.replace(/^\+/, '');
  if (digitsOnly.startsWith('00')) {
    digitsOnly = digitsOnly.slice(2);
  }
  if (!/^\d{7,15}$/.test(digitsOnly)) return null;

  // Normalize Sri Lankan mobile/landline formats (e.g. 0711114901, 754895335, +94711114901) to 94XXXXXXXXX
  if (digitsOnly.startsWith('94') && digitsOnly.length === 11) {
    return digitsOnly;
  }
  if (digitsOnly.startsWith('0') && digitsOnly.length === 10) {
    return `94${digitsOnly.slice(1)}`;
  }
  if (digitsOnly.startsWith('7') && digitsOnly.length === 9) {
    return `94${digitsOnly}`;
  }
  return digitsOnly;
}

export function normalizeCustomerName(value: string | null | undefined): string {
  if (!value || typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function deriveCustomerNormalizedKey(input: {
  normalized_key?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
}): string | null {
  if (typeof input.normalized_key === 'string') {
    const explicit = input.normalized_key.trim().toLowerCase();
    if (explicit.length >= 2 && explicit.length <= 254) {
      return explicit;
    }
  }
  const email = normalizeCustomerEmail(input.email);
  if (email) return `email:${email}`;
  const phone = normalizeCustomerPhone(input.phone) ?? normalizeCustomerPhone(input.whatsapp);
  if (phone) return `phone:${phone}`;
  return null;
}

function toCurrency(value: string | null | undefined): SupportedCurrency {
  return value?.trim().toUpperCase() === 'USD' ? 'USD' : 'LKR';
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function emptyCurrencySummary(currency: SupportedCurrency): CurrencyFinancialSummary {
  return {
    currency,
    total_quoted: 0,
    total_booked: 0,
    total_paid: 0,
    total_refunded: 0,
    net_paid: 0,
    outstanding_balance: 0,
  };
}

function buildRouteSummary(legs: RawCustomerBookingLeg[]): string {
  if (!Array.isArray(legs) || legs.length === 0) return 'Custom Itinerary';
  const sorted = [...legs].sort((a, b) => a.sequence_no - b.sequence_no);
  const stops: string[] = [];
  for (const leg of sorted) {
    const pickup = leg.pickup_location?.trim();
    const dropoff = leg.dropoff_location?.trim();
    if (pickup && stops[stops.length - 1] !== pickup) {
      stops.push(pickup);
    }
    if (dropoff && stops[stops.length - 1] !== dropoff) {
      stops.push(dropoff);
    }
  }
  return stops.length > 0 ? stops.join(' → ') : 'Custom Itinerary';
}

export function aggregateCustomerCrmData(source: CustomerCrmSourceData): CustomerCrmOverview {
  const crmProfiles = Array.isArray(source.crm_profiles) ? source.crm_profiles : [];
  const rawBookings = Array.isArray(source.bookings) ? source.bookings : [];
  const rawQuotes = Array.isArray(source.quotes) ? source.quotes : [];
  const rawPayments = Array.isArray(source.payments) ? source.payments : [];
  const rawInvoices = Array.isArray(source.invoices) ? source.invoices : [];

  // Index quotes, payments, invoices by booking_id
  const quotesByBookingId = new Map<string, RawCustomerQuoteRow[]>();
  for (const q of rawQuotes) {
    const list = quotesByBookingId.get(q.booking_id) ?? [];
    list.push(q);
    quotesByBookingId.set(q.booking_id, list);
  }
  for (const list of quotesByBookingId.values()) {
    list.sort((a, b) => Number(b.revision) - Number(a.revision));
  }

  const paymentsByBookingId = new Map<string, RawCustomerPaymentRow[]>();
  for (const p of rawPayments) {
    const list = paymentsByBookingId.get(p.booking_id) ?? [];
    list.push(p);
    paymentsByBookingId.set(p.booking_id, list);
  }

  const invoicesByBookingId = new Map<string, RawCustomerInvoiceRow[]>();
  for (const inv of rawInvoices) {
    const list = invoicesByBookingId.get(inv.booking_id) ?? [];
    list.push(inv);
    invoicesByBookingId.set(inv.booking_id, list);
  }

  type CustomerGroup = {
    normalized_key: string;
    crm_profile: RawCrmProfileRow | null;
    full_name: string;
    email: string | null;
    phone: string | null;
    whatsapp: string | null;
    country: string | null;
    vip_status: CustomerVipStatus;
    notes: string | null;
    created_at: string;
    updated_at: string;
    emails: Set<string>;
    phones: Set<string>;
    name_phone_pairs: Set<string>;
    bookings: RawCustomerBookingRow[];
  };

  const groupsByKey = new Map<string, CustomerGroup>();
  const keyByEmail = new Map<string, string>();
  const keyByPhoneOnly = new Map<string, string>();
  const keyByNameAndPhone = new Map<string, string>();

  function registerGroupAliases(group: CustomerGroup) {
    const normEmail = normalizeCustomerEmail(group.email);
    const normPhone = normalizeCustomerPhone(group.phone) ?? normalizeCustomerPhone(group.whatsapp);
    const normName = normalizeCustomerName(group.full_name);

    if (normEmail) {
      group.emails.add(normEmail);
      if (!keyByEmail.has(normEmail)) {
        keyByEmail.set(normEmail, group.normalized_key);
      }
    }
    if (normPhone) {
      group.phones.add(normPhone);
      if (!normEmail && !keyByPhoneOnly.has(normPhone)) {
        keyByPhoneOnly.set(normPhone, group.normalized_key);
      }
      if (normName) {
        const pairKey = `${normName}|${normPhone}`;
        group.name_phone_pairs.add(pairKey);
        if (!keyByNameAndPhone.has(pairKey)) {
          keyByNameAndPhone.set(pairKey, group.normalized_key);
        }
      }
    }
  }

  // 1. Seed groups from saved customer_crm_profiles first
  for (const profile of crmProfiles) {
    const key = profile.normalized_key.trim().toLowerCase();
    const group: CustomerGroup = {
      normalized_key: key,
      crm_profile: profile,
      full_name: profile.full_name.trim(),
      email: normalizeCustomerEmail(profile.email) ?? (profile.email?.trim() || null),
      phone: profile.phone?.trim() || null,
      whatsapp: profile.whatsapp?.trim() || profile.phone?.trim() || null,
      country: profile.country?.trim() || null,
      vip_status: VIP_STATUSES.has(profile.vip_status) ? profile.vip_status : 'standard',
      notes: profile.notes ?? null,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
      emails: new Set<string>(),
      phones: new Set<string>(),
      name_phone_pairs: new Set<string>(),
      bookings: [],
    };
    groupsByKey.set(key, group);
    registerGroupAliases(group);
  }

  // Sort bookings chronological (newest first) so the latest contact name/phone/email wins when filling missing fields
  const sortedBookings = [...rawBookings].sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)
  );

  // 2. Assign each booking to an existing or new unified customer group
  for (const booking of sortedBookings) {
    const normEmail = normalizeCustomerEmail(booking.customer_email);
    const normPhone = normalizeCustomerPhone(booking.customer_phone);
    const normName = normalizeCustomerName(booking.customer_name);
    const namePhonePair = normName && normPhone ? `${normName}|${normPhone}` : null;

    const candidateEmailKey = normEmail ? `email:${normEmail}` : null;
    const candidatePhoneKey = normPhone ? `phone:${normPhone}` : null;

    let matchedKey: string | undefined;

    if (candidateEmailKey && groupsByKey.has(candidateEmailKey)) {
      matchedKey = candidateEmailKey;
    } else if (normEmail && keyByEmail.has(normEmail)) {
      matchedKey = keyByEmail.get(normEmail);
    } else if (namePhonePair && keyByNameAndPhone.has(namePhonePair)) {
      matchedKey = keyByNameAndPhone.get(namePhonePair);
    } else if (!normEmail && candidatePhoneKey && groupsByKey.has(candidatePhoneKey)) {
      matchedKey = candidatePhoneKey;
    } else if (normPhone && keyByPhoneOnly.has(normPhone)) {
      matchedKey = keyByPhoneOnly.get(normPhone);
    }

    if (!matchedKey) {
      matchedKey = candidateEmailKey ?? candidatePhoneKey ?? `booking:${booking.id}`;
    }

    let group = groupsByKey.get(matchedKey);
    if (!group) {
      group = {
        normalized_key: matchedKey,
        crm_profile: null,
        full_name: booking.customer_name.trim() || 'Guest Customer',
        email: normEmail ?? (booking.customer_email?.trim() || null),
        phone: booking.customer_phone?.trim() || null,
        whatsapp: booking.customer_phone?.trim() || null,
        country: null,
        vip_status: 'standard',
        notes: null,
        created_at: booking.created_at,
        updated_at: booking.updated_at ?? booking.created_at,
        emails: new Set<string>(),
        phones: new Set<string>(),
        name_phone_pairs: new Set<string>(),
        bookings: [],
      };
      groupsByKey.set(matchedKey, group);
    } else {
      if (!group.email && (normEmail || booking.customer_email?.trim())) {
        group.email = normEmail ?? booking.customer_email.trim();
      }
      if (!group.phone && booking.customer_phone?.trim()) {
        group.phone = booking.customer_phone.trim();
      }
      if (!group.whatsapp && booking.customer_phone?.trim()) {
        group.whatsapp = booking.customer_phone.trim();
      }
      if (!group.crm_profile && booking.customer_name?.trim()) {
        // Keep most recent booking's full name if not overridden by CRM profile
        if (group.bookings.length === 0) {
          group.full_name = booking.customer_name.trim();
        }
      }
    }

    group.bookings.push(booking);

    if (normEmail) {
      group.emails.add(normEmail);
      if (!keyByEmail.has(normEmail)) keyByEmail.set(normEmail, group.normalized_key);
    }
    if (normPhone) {
      group.phones.add(normPhone);
      if (!normEmail && !keyByPhoneOnly.has(normPhone)) {
        keyByPhoneOnly.set(normPhone, group.normalized_key);
      }
      if (namePhonePair && !keyByNameAndPhone.has(namePhonePair)) {
        keyByNameAndPhone.set(namePhonePair, group.normalized_key);
      }
    }
  }

  // 3. Build UnifiedCustomerProfile list
  const unifiedCustomers: UnifiedCustomerProfile[] = [];

  for (const group of groupsByKey.values()) {
    const financials: { LKR: CurrencyFinancialSummary; USD: CurrencyFinancialSummary } = {
      LKR: emptyCurrencySummary('LKR'),
      USD: emptyCurrencySummary('USD'),
    };

    const customerBookings: CustomerBookingRecord[] = [];
    const customerPayments: CustomerPaymentRecord[] = [];
    const customerInvoices: CustomerInvoiceRecord[] = [];
    const customerReceipts: CustomerReceiptRecord[] = [];

    let completedCount = 0;
    let activeUpcomingCount = 0;
    let cancelledCount = 0;
    let firstBookingDate: string | null = null;
    let lastBookingDate: string | null = null;
    let lastTripDate: string | null = null;

    const groupBookingsSorted = [...group.bookings].sort(
      (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)
    );

    for (const b of groupBookingsSorted) {
      if (b.booking_status === 'completed') {
        completedCount += 1;
      } else if (b.booking_status === 'cancelled' || b.booking_status === 'rejected') {
        cancelledCount += 1;
      } else {
        activeUpcomingCount += 1;
      }

      if (!firstBookingDate || Date.parse(b.created_at) < Date.parse(firstBookingDate)) {
        firstBookingDate = b.created_at;
      }
      if (!lastBookingDate || Date.parse(b.created_at) > Date.parse(lastBookingDate)) {
        lastBookingDate = b.created_at;
      }

      const legs = Array.isArray(b.legs)
        ? [...b.legs].sort((x, y) => x.sequence_no - y.sequence_no)
        : [];
      const firstPickup = legs[0]?.pickup_at ?? null;
      if (firstPickup) {
        if (!lastTripDate || Date.parse(firstPickup) > Date.parse(lastTripDate)) {
          lastTripDate = firstPickup;
        }
      }

      const bQuotes = quotesByBookingId.get(b.id) ?? [];
      const acceptedQuote = bQuotes.find((q) => q.quote_status === 'accepted') ?? null;
      const latestSentQuote = bQuotes.find((q) => q.quote_status === 'sent') ?? null;
      const primaryQuote = acceptedQuote ?? latestSentQuote ?? bQuotes[0] ?? null;

      const bPayments = paymentsByBookingId.get(b.id) ?? [];
      let bookingPaid = 0;
      let bookingRefunded = 0;

      for (const p of bPayments) {
        const pCurrency = toCurrency(p.currency);
        const pAmount = roundMoney(Number(p.amount) || 0);
        const isRefund = p.entry_type === 'refund';

        if (isRefund) {
          bookingRefunded = roundMoney(bookingRefunded + pAmount);
          financials[pCurrency].total_refunded = roundMoney(
            financials[pCurrency].total_refunded + pAmount
          );
        } else {
          bookingPaid = roundMoney(bookingPaid + pAmount);
          financials[pCurrency].total_paid = roundMoney(
            financials[pCurrency].total_paid + pAmount
          );
        }

        const docId = typeof p.document_id === 'string' ? p.document_id : null;
        const fileStatus =
          p.file_status === 'stored' || p.file_status === 'pending' ? p.file_status : null;
        const downloadUrl =
          docId && fileStatus === 'stored' ? `/api/documents/download?id=${docId}` : null;
        const viewUrl =
          docId && fileStatus === 'stored' ? `/api/documents/download?id=${docId}&view=1` : null;

        const paymentRecord: CustomerPaymentRecord = {
          id: p.id,
          booking_id: b.id,
          booking_ref: b.booking_ref,
          quote_id: p.quote_id,
          entry_type: isRefund ? 'refund' : 'receipt',
          original_payment_id: p.original_payment_id ?? null,
          amount: pAmount,
          currency: pCurrency,
          method: p.method,
          reference: p.provider_reference ?? null,
          refund_reason: p.refund_reason ?? null,
          receipt_number: p.receipt_number ?? null,
          payment_date: p.payment_date ?? null,
          verified_at: p.verified_at,
          created_at: p.created_at,
          status: isRefund ? 'refunded' : 'verified',
          document_id: docId,
          file_status: fileStatus,
          download_url: downloadUrl,
          view_url: viewUrl,
        };
        customerPayments.push(paymentRecord);

        if (!isRefund && p.receipt_number) {
          customerReceipts.push({
            id: p.id,
            payment_id: p.id,
            receipt_number: p.receipt_number,
            booking_id: b.id,
            booking_ref: b.booking_ref,
            quote_id: p.quote_id,
            currency: pCurrency,
            amount: pAmount,
            method: p.method,
            reference: p.provider_reference ?? null,
            payment_date: p.payment_date ?? null,
            verified_at: p.verified_at,
            document_id: docId,
            file_status: fileStatus,
            download_url: downloadUrl,
            view_url: viewUrl,
          });
        }
      }

      const bookingNetPaid = roundMoney(bookingPaid - bookingRefunded);
      const bookingCurrency = toCurrency(primaryQuote?.currency ?? b.requested_currency);
      const quotedAmount = primaryQuote ? roundMoney(Number(primaryQuote.total) || 0) : null;
      const isCancelledOrRejected =
        b.booking_status === 'cancelled' || b.booking_status === 'rejected';

      if (primaryQuote && quotedAmount !== null && !isCancelledOrRejected) {
        if (
          primaryQuote.quote_status === 'accepted' ||
          primaryQuote.quote_status === 'sent'
        ) {
          financials[bookingCurrency].total_quoted = roundMoney(
            financials[bookingCurrency].total_quoted + quotedAmount
          );
        }
      }

      let bookingOutstanding = 0;
      if (acceptedQuote && !isCancelledOrRejected) {
        const acceptedTotal = roundMoney(Number(acceptedQuote.total) || 0);
        const acceptedCurrency = toCurrency(acceptedQuote.currency);
        financials[acceptedCurrency].total_booked = roundMoney(
          financials[acceptedCurrency].total_booked + acceptedTotal
        );
        bookingOutstanding = roundMoney(Math.max(acceptedTotal - bookingNetPaid, 0));
        financials[acceptedCurrency].outstanding_balance = roundMoney(
          financials[acceptedCurrency].outstanding_balance + bookingOutstanding
        );
      }

      let paymentStatus: CustomerBookingRecord['payment_status'] = 'no_quote';
      if (acceptedQuote) {
        const acceptedTotal = roundMoney(Number(acceptedQuote.total) || 0);
        if (bookingRefunded > 0 && bookingNetPaid <= 0) {
          paymentStatus = 'refunded';
        } else if (bookingNetPaid >= acceptedTotal && acceptedTotal > 0) {
          paymentStatus = 'paid';
        } else if (bookingNetPaid > 0) {
          paymentStatus = 'partially_paid';
        } else {
          paymentStatus = 'unpaid';
        }
      }

      customerBookings.push({
        id: b.id,
        booking_ref: b.booking_ref,
        service_type: b.service_type,
        journey_type: b.journey_type,
        booking_status: b.booking_status,
        passenger_count: Number(b.passenger_count) || 1,
        luggage_count: Number(b.luggage_count) || 0,
        customer_notes: b.customer_notes ?? null,
        created_at: b.created_at,
        pickup_at: firstPickup,
        route_summary: buildRouteSummary(legs),
        legs,
        currency: bookingCurrency,
        quoted_amount: quotedAmount,
        quote_status: primaryQuote?.quote_status ?? null,
        total_paid: bookingPaid,
        total_refunded: bookingRefunded,
        net_paid: bookingNetPaid,
        outstanding_balance: bookingOutstanding,
        payment_status: paymentStatus,
        booking_link: `/admin/bookings?booking_id=${encodeURIComponent(b.id)}`,
      });

      const bInvoices = invoicesByBookingId.get(b.id) ?? [];
      for (const inv of bInvoices) {
        const invDocId = typeof inv.document_id === 'string' ? inv.document_id : null;
        const invFileStatus =
          inv.file_status === 'stored' || inv.file_status === 'pending' ? inv.file_status : null;
        customerInvoices.push({
          id: inv.id,
          invoice_number: inv.invoice_number,
          booking_id: b.id,
          booking_ref: b.booking_ref,
          quote_id: inv.quote_id,
          currency: toCurrency(inv.currency),
          total: roundMoney(Number(inv.total) || 0),
          revision: Number(inv.revision) || 1,
          status: inv.invoice_status,
          issued_at: inv.issued_at,
          cancelled_at: inv.cancelled_at ?? null,
          cancellation_reason: inv.cancellation_reason ?? null,
          document_id: invDocId,
          file_status: invFileStatus,
          download_url:
            invDocId && invFileStatus === 'stored'
              ? `/api/documents/download?id=${invDocId}`
              : null,
          view_url:
            invDocId && invFileStatus === 'stored'
              ? `/api/documents/download?id=${invDocId}&view=1`
              : null,
        });
      }
    }

    financials.LKR.net_paid = roundMoney(
      financials.LKR.total_paid - financials.LKR.total_refunded
    );
    financials.USD.net_paid = roundMoney(
      financials.USD.total_paid - financials.USD.total_refunded
    );

    customerPayments.sort(
      (a, b) =>
        Date.parse(b.payment_date || b.verified_at || b.created_at) -
        Date.parse(a.payment_date || a.verified_at || a.created_at)
    );
    customerInvoices.sort((a, b) => Date.parse(b.issued_at) - Date.parse(a.issued_at));
    customerReceipts.sort(
      (a, b) =>
        Date.parse(b.payment_date || b.verified_at) -
        Date.parse(a.payment_date || a.verified_at)
    );

    const totalBookings = customerBookings.length;
    const storedVipStatus: CustomerVipStatus = group.crm_profile
      ? group.vip_status
      : totalBookings >= 2
        ? 'repeat'
        : 'standard';

    const effectiveTier: CustomerVipStatus =
      storedVipStatus === 'vip'
        ? 'vip'
        : storedVipStatus === 'repeat' || totalBookings >= 2
          ? 'repeat'
          : 'standard';

    const isRepeatOrVip = effectiveTier === 'vip' || effectiveTier === 'repeat';
    const hasOutstandingBalance =
      financials.LKR.outstanding_balance > 0 || financials.USD.outstanding_balance > 0;
    const hasUpcomingTrips = activeUpcomingCount > 0;

    const activityTimestamps = [
      lastBookingDate,
      group.crm_profile?.updated_at ?? null,
      customerPayments[0]?.verified_at ?? null,
      customerInvoices[0]?.issued_at ?? null,
    ].filter((value): value is string => Boolean(value));

    const lastActivityAt =
      activityTimestamps.sort((a, b) => Date.parse(b) - Date.parse(a))[0] ??
      group.updated_at;

    unifiedCustomers.push({
      id: group.crm_profile?.id ?? group.normalized_key,
      crm_profile_id: group.crm_profile?.id ?? null,
      normalized_key: group.normalized_key,
      full_name: group.full_name,
      email: group.email,
      phone: group.phone,
      whatsapp: group.whatsapp ?? group.phone,
      country: group.country,
      vip_status: storedVipStatus,
      effective_tier: effectiveTier,
      is_repeat_or_vip: isRepeatOrVip,
      notes: group.notes,
      total_bookings: totalBookings,
      completed_bookings: completedCount,
      active_upcoming_bookings: activeUpcomingCount,
      cancelled_bookings: cancelledCount,
      first_booking_date: firstBookingDate,
      last_booking_date: lastBookingDate,
      last_trip_date: lastTripDate ?? lastBookingDate,
      last_activity_at: lastActivityAt,
      has_outstanding_balance: hasOutstandingBalance,
      has_upcoming_trips: hasUpcomingTrips,
      financials,
      bookings: customerBookings,
      payments: customerPayments,
      invoices: customerInvoices,
      receipts: customerReceipts,
    });
  }

  // Default sort: Most Recent Activity descending
  unifiedCustomers.sort(
    (a, b) => Date.parse(b.last_activity_at) - Date.parse(a.last_activity_at)
  );

  // 4. Compute Top KPI Summary Bar
  const kpis: CustomerCrmKpiSummary = {
    total_customers: unifiedCustomers.length,
    repeat_and_vip_customers: unifiedCustomers.filter((c) => c.is_repeat_or_vip).length,
    customers_with_outstanding: unifiedCustomers.filter((c) => c.has_outstanding_balance).length,
    customers_with_upcoming_trips: unifiedCustomers.filter((c) => c.has_upcoming_trips).length,
    revenue_collected: {
      LKR: roundMoney(
        unifiedCustomers.reduce((sum, c) => sum + c.financials.LKR.net_paid, 0)
      ),
      USD: roundMoney(
        unifiedCustomers.reduce((sum, c) => sum + c.financials.USD.net_paid, 0)
      ),
    },
    outstanding_balances: {
      LKR: roundMoney(
        unifiedCustomers.reduce((sum, c) => sum + c.financials.LKR.outstanding_balance, 0)
      ),
      USD: roundMoney(
        unifiedCustomers.reduce((sum, c) => sum + c.financials.USD.outstanding_balance, 0)
      ),
    },
    total_quoted: {
      LKR: roundMoney(
        unifiedCustomers.reduce((sum, c) => sum + c.financials.LKR.total_quoted, 0)
      ),
      USD: roundMoney(
        unifiedCustomers.reduce((sum, c) => sum + c.financials.USD.total_quoted, 0)
      ),
    },
  };

  return {
    kpis,
    customers: unifiedCustomers,
  };
}

export type ParsedCustomerCrmUpsertInput = {
  normalized_key: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  country: string | null;
  vip_status: CustomerVipStatus;
  notes: string | null;
};

export function parseCustomerCrmUpsertInput(
  input: Record<string, unknown>
): { data?: ParsedCustomerCrmUpsertInput; error?: string } {
  const fullName = typeof input.full_name === 'string' ? input.full_name.trim() : '';
  if (fullName.length < 2 || fullName.length > 160) {
    return { error: 'Customer full name must be between 2 and 160 characters.' };
  }

  const rawEmail = typeof input.email === 'string' ? input.email.trim() : '';
  let email: string | null = null;
  if (rawEmail) {
    email = normalizeCustomerEmail(rawEmail);
    if (!email) {
      return { error: 'Enter a valid customer email address.' };
    }
  }

  const rawPhone = typeof input.phone === 'string' ? input.phone.trim() : '';
  if (rawPhone && (!PHONE_ALLOWED_REGEX.test(rawPhone) || !normalizeCustomerPhone(rawPhone))) {
    return { error: 'Enter a valid phone number (7 to 15 digits).' };
  }
  const phone = rawPhone || null;

  const rawWhatsapp = typeof input.whatsapp === 'string' ? input.whatsapp.trim() : '';
  if (
    rawWhatsapp &&
    (!PHONE_ALLOWED_REGEX.test(rawWhatsapp) || !normalizeCustomerPhone(rawWhatsapp))
  ) {
    return { error: 'Enter a valid WhatsApp number (7 to 15 digits).' };
  }
  const whatsapp = rawWhatsapp || phone;

  const rawCountry = typeof input.country === 'string' ? input.country.trim() : '';
  if (rawCountry.length > 100) {
    return { error: 'Country name must be 100 characters or fewer.' };
  }
  const country = rawCountry || null;

  const rawVipStatus =
    typeof input.vip_status === 'string' ? input.vip_status.trim().toLowerCase() : 'standard';
  if (!VIP_STATUSES.has(rawVipStatus as CustomerVipStatus)) {
    return { error: 'VIP status must be standard, repeat, or vip.' };
  }
  const vipStatus = rawVipStatus as CustomerVipStatus;

  const rawNotes = typeof input.notes === 'string' ? input.notes.trim() : '';
  if (rawNotes.length > 4000) {
    return { error: 'Admin CRM notes must be 4000 characters or fewer.' };
  }
  const notes = rawNotes || null;

  const explicitKey =
    typeof input.normalized_key === 'string' ? input.normalized_key.trim() : null;
  const normalizedKey = deriveCustomerNormalizedKey({
    normalized_key: explicitKey,
    email,
    phone,
    whatsapp,
  });

  if (!normalizedKey) {
    return {
      error: 'Provide at least a valid email address or phone/WhatsApp number for this customer.',
    };
  }

  return {
    data: {
      normalized_key: normalizedKey,
      full_name: fullName,
      email,
      phone,
      whatsapp,
      country,
      vip_status: vipStatus,
      notes,
    },
  };
}
