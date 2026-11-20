export type PromoDiscountType = 'percentage' | 'fixed';
export type PromoCurrency = 'USD' | 'LKR' | 'ALL';
export type ApplicableServiceType =
  | 'all'
  | 'round_tour'
  | 'airport_transfer'
  | 'day_trip'
  | 'vehicle_hire'
  | 'custom';

export type BannerThemeVariant = 'emerald' | 'amber' | 'slate';
export type MarketingTemplateCategory =
  | 'seasonal_offer'
  | 'review_request'
  | 'airport_promo'
  | 'follow_up';

export interface PromoCodeRecord {
  id: string;
  code: string;
  title: string;
  discount_type: PromoDiscountType;
  discount_value: number;
  currency: PromoCurrency;
  min_booking_amount: number;
  applicable_service: ApplicableServiceType;
  max_uses: number | null;
  used_count: number;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MarketingBannerRecord {
  id: string;
  badge_text: string | null;
  headline: string;
  cta_label: string | null;
  cta_link: string | null;
  promo_code: string | null;
  theme_variant: BannerThemeVariant;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MarketingTemplateRecord {
  id: string;
  title: string;
  category: MarketingTemplateCategory;
  message_body: string;
  created_at: string;
  updated_at: string;
}

export interface MarketingCustomerRecipient {
  id: string;
  full_name: string;
  phone: string;
  whatsapp: string;
  email: string | null;
  country: string | null;
  vip_status: string;
  total_bookings: number;
  last_booking_ref: string | null;
}

export interface PromoValidationOptions {
  serviceType?: string | null;
  bookingAmount?: number | null;
  currency?: string | null;
  now?: Date;
}

export interface PromoValidationResult {
  valid: boolean;
  error?: string;
  code?: string;
  title?: string;
  discount_type?: PromoDiscountType;
  discount_value?: number;
  currency?: PromoCurrency;
  applicable_service?: ApplicableServiceType;
  min_booking_amount?: number;
  discount_label?: string;
  booking_note_tag?: string;
}

export function normalizePromoCodeString(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 40);
}

export function formatPromoDiscountLabel(
  promo: Pick<PromoCodeRecord, 'discount_type' | 'discount_value' | 'currency'>
): string {
  const value = Number(promo.discount_value) || 0;
  if (promo.discount_type === 'percentage') {
    return `${value}% OFF`;
  }
  const currencyPrefix = promo.currency === 'LKR' ? 'LKR ' : 'USD ';
  return `${currencyPrefix}${value.toLocaleString('en-US', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })} OFF`;
}

export function formatApplicableServiceLabel(service: string): string {
  switch (service) {
    case 'all':
      return 'All Services & Tours';
    case 'round_tour':
      return 'Multi-Day & Chauffeur Tours';
    case 'airport_transfer':
      return 'Airport Transfers';
    case 'day_trip':
      return 'Day Trips';
    case 'vehicle_hire':
      return 'Vehicle Hire / Point-to-Point';
    case 'custom':
      return 'Custom Journeys';
    default:
      return service.replace(/_/g, ' ');
  }
}

export function validatePromoCodeRecord(
  promo: PromoCodeRecord | null | undefined,
  options: PromoValidationOptions = {}
): PromoValidationResult {
  if (!promo) {
    return {
      valid: false,
      error: 'Invalid or unrecognized promo code.',
    };
  }

  if (!promo.is_active) {
    return {
      valid: false,
      error: 'This promo code is currently paused or inactive.',
    };
  }

  const now = options.now ?? new Date();
  if (promo.valid_from) {
    const fromDate = new Date(promo.valid_from);
    if (!Number.isNaN(fromDate.getTime()) && now.getTime() < fromDate.getTime()) {
      return {
        valid: false,
        error: 'This promo code is not yet active.',
      };
    }
  }

  if (promo.valid_until) {
    const untilDate = new Date(promo.valid_until);
    if (!Number.isNaN(untilDate.getTime()) && now.getTime() > untilDate.getTime()) {
      return {
        valid: false,
        error: 'This promo code has expired.',
      };
    }
  }

  if (
    promo.max_uses !== null &&
    promo.max_uses !== undefined &&
    Number(promo.used_count) >= Number(promo.max_uses)
  ) {
    return {
      valid: false,
      error: 'This promo code has reached its maximum redemption limit.',
    };
  }

  if (
    promo.applicable_service &&
    promo.applicable_service !== 'all' &&
    options.serviceType &&
    options.serviceType !== promo.applicable_service
  ) {
    return {
      valid: false,
      error: `Code ${promo.code} applies only to ${formatApplicableServiceLabel(
        promo.applicable_service
      )}.`,
    };
  }

  const minAmount = Number(promo.min_booking_amount) || 0;
  if (
    minAmount > 0 &&
    typeof options.bookingAmount === 'number' &&
    options.bookingAmount > 0 &&
    options.bookingAmount < minAmount
  ) {
    const currLabel = promo.currency === 'ALL' ? options.currency || 'USD' : promo.currency;
    return {
      valid: false,
      error: `Code ${promo.code} requires a minimum booking value of ${currLabel} ${minAmount}.`,
    };
  }

  const discountLabel = formatPromoDiscountLabel(promo);
  const minNote =
    minAmount > 0
      ? ` (Min booking: ${promo.currency === 'ALL' ? '' : `${promo.currency} `}${minAmount})`
      : '';

  return {
    valid: true,
    code: promo.code,
    title: promo.title,
    discount_type: promo.discount_type,
    discount_value: Number(promo.discount_value),
    currency: promo.currency,
    applicable_service: promo.applicable_service,
    min_booking_amount: minAmount,
    discount_label: discountLabel,
    booking_note_tag: `Promo code applied: ${promo.code} (${discountLabel} — ${promo.title}${minNote})`,
  };
}

export function renderMarketingTemplate(
  messageBody: string,
  variables: {
    customerName?: string | null;
    promoCode?: string | null;
    websiteUrl?: string | null;
  }
): string {
  const safeName = variables.customerName?.trim() || 'Valued Guest';
  const safeCode = variables.promoCode?.trim().toUpperCase() || 'WELCOME10';
  const safeUrl = (variables.websiteUrl?.trim() || 'https://chamatravels.com').replace(/\/+$/, '');

  return messageBody
    .replace(/\{customer_name\}/gi, safeName)
    .replace(/\{promo_code\}/gi, safeCode)
    .replace(/\{website_url\}/gi, safeUrl);
}
