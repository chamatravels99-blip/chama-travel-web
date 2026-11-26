export type SettingsCurrency = 'USD' | 'LKR';

export interface SiteSettings {
  id: 'default';
  business_name: string;
  tagline: string;
  primary_phone: string;
  whatsapp_number: string;
  contact_email: string;
  office_address: string;
  registration_number: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  tripadvisor_url: string | null;
  google_review_url: string | null;
  default_currency: SettingsCurrency;
  default_quote_validity_hours: number;
  bank_account_details: string | null;
  invoice_footer_note: string;
  hero_badge: string;
  hero_title: string;
  hero_subtitle: string;
  hero_image_url: string;
  accepting_public_bookings: boolean;
  updated_by: string | null;
  updated_at: string | null;
}

export interface PublicSiteSettings {
  business_name: string;
  tagline: string;
  primary_phone: string;
  whatsapp_number: string;
  contact_email: string;
  office_address: string;
  registration_number: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  tripadvisor_url: string | null;
  google_review_url: string | null;
  default_currency: SettingsCurrency;
  hero_badge: string;
  hero_title: string;
  hero_subtitle: string;
  hero_image_url: string;
  accepting_public_bookings: boolean;
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  id: 'default',
  business_name: 'Chama Travel & Tours',
  tagline: 'Discover Sri Lanka With Chama Travels',
  primary_phone: '+94 71 111 4901',
  whatsapp_number: '94711114901',
  contact_email: 'info@chamatravels.com',
  office_address: '152/1 Kahambilihena, Udathuththiripitiya, Gampaha 11054, Sri Lanka',
  registration_number: null,
  facebook_url: 'https://www.facebook.com/share/14sG15NeKV3/?mibextid=wwXIfr',
  instagram_url: 'https://www.instagram.com/chamatravels99?stkn=eGY2aW52MTJhY2V5&utm_source=qr',
  tripadvisor_url:
    'https://www.tripadvisor.com/Attraction_Review-g293962-d32748314-Reviews-Chama_Travel_Tours-Colombo_Western_Province.html',
  google_review_url:
    'https://www.google.com/maps/place/Chama+Travel+%26+Tours/data=!4m7!3m6!1s0x2554543128f9092d:0x2780ba119100211a!8m2!3d7.0815764!4d80.0870175!16s%2Fg%2F11lypjsjpg!19sChIJLQn5KDFUVCURGiEAkRG6gCc',
  default_currency: 'USD',
  default_quote_validity_hours: 48,
  bank_account_details: null,
  invoice_footer_note: 'Thank you for travelling with Chama Travel & Tours.',
  hero_badge: 'Explore Sri Lanka',
  hero_title: 'Discover Sri Lanka With Chama Travels',
  hero_subtitle:
    'Experience beautiful places, unforgettable adventures and comfortable journeys across Sri Lanka with friendly local service.',
  hero_image_url: '/images/beach.jpg',
  accepting_public_bookings: true,
  updated_by: null,
  updated_at: null,
};

export function normalizeWhatsAppDigits(
  value: string | null | undefined,
  fallback = DEFAULT_SITE_SETTINGS.whatsapp_number
): string {
  if (typeof value !== 'string') return fallback;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return fallback;
  return digits;
}

export function buildWhatsAppUrl(whatsappNumber: string, text?: string): string {
  const digits = normalizeWhatsAppDigits(whatsappNumber);
  if (text && text.trim()) {
    return `https://wa.me/${digits}?text=${encodeURIComponent(text.trim())}`;
  }
  return `https://wa.me/${digits}`;
}

export function normalizeOptionalHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function normalizeHeroImageUrl(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_SITE_SETTINGS.hero_image_url;
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_SITE_SETTINGS.hero_image_url;
  if (trimmed.startsWith('/')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    // Fall through to default
  }
  return DEFAULT_SITE_SETTINGS.hero_image_url;
}

function nonEmptyString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function normalizeSiteSettingsRow(row: unknown): SiteSettings {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return { ...DEFAULT_SITE_SETTINGS };
  }
  const r = row as Record<string, unknown>;
  const rawCurrency = typeof r.default_currency === 'string' ? r.default_currency.toUpperCase() : '';
  const defaultCurrency: SettingsCurrency = rawCurrency === 'LKR' ? 'LKR' : 'USD';
  const rawValidity = Number(r.default_quote_validity_hours);
  const defaultValidity =
    Number.isInteger(rawValidity) && rawValidity >= 1 && rawValidity <= 720
      ? rawValidity
      : DEFAULT_SITE_SETTINGS.default_quote_validity_hours;

  return {
    id: 'default',
    business_name: nonEmptyString(r.business_name, DEFAULT_SITE_SETTINGS.business_name),
    tagline: nonEmptyString(r.tagline, DEFAULT_SITE_SETTINGS.tagline),
    primary_phone: nonEmptyString(r.primary_phone, DEFAULT_SITE_SETTINGS.primary_phone),
    whatsapp_number: normalizeWhatsAppDigits(
      typeof r.whatsapp_number === 'string' ? r.whatsapp_number : null,
      DEFAULT_SITE_SETTINGS.whatsapp_number
    ),
    contact_email: nonEmptyString(r.contact_email, DEFAULT_SITE_SETTINGS.contact_email),
    office_address: nonEmptyString(r.office_address, DEFAULT_SITE_SETTINGS.office_address),
    registration_number: nullableString(r.registration_number),
    facebook_url:
      r.facebook_url === undefined
        ? DEFAULT_SITE_SETTINGS.facebook_url
        : normalizeOptionalHttpUrl(r.facebook_url),
    instagram_url:
      r.instagram_url === undefined
        ? DEFAULT_SITE_SETTINGS.instagram_url
        : normalizeOptionalHttpUrl(r.instagram_url),
    tripadvisor_url:
      r.tripadvisor_url === undefined
        ? DEFAULT_SITE_SETTINGS.tripadvisor_url
        : normalizeOptionalHttpUrl(r.tripadvisor_url),
    google_review_url:
      r.google_review_url === undefined
        ? DEFAULT_SITE_SETTINGS.google_review_url
        : normalizeOptionalHttpUrl(r.google_review_url),
    default_currency: defaultCurrency,
    default_quote_validity_hours: defaultValidity,
    bank_account_details: nullableString(r.bank_account_details),
    invoice_footer_note: nonEmptyString(
      r.invoice_footer_note,
      DEFAULT_SITE_SETTINGS.invoice_footer_note
    ),
    hero_badge: nonEmptyString(r.hero_badge, DEFAULT_SITE_SETTINGS.hero_badge),
    hero_title: nonEmptyString(r.hero_title, DEFAULT_SITE_SETTINGS.hero_title),
    hero_subtitle: nonEmptyString(r.hero_subtitle, DEFAULT_SITE_SETTINGS.hero_subtitle),
    hero_image_url: normalizeHeroImageUrl(r.hero_image_url),
    accepting_public_bookings:
      typeof r.accepting_public_bookings === 'boolean'
        ? r.accepting_public_bookings
        : DEFAULT_SITE_SETTINGS.accepting_public_bookings,
    updated_by: nullableString(r.updated_by),
    updated_at: nullableString(r.updated_at),
  };
}

export function toPublicSiteSettings(settings: SiteSettings): PublicSiteSettings {
  return {
    business_name: settings.business_name,
    tagline: settings.tagline,
    primary_phone: settings.primary_phone,
    whatsapp_number: settings.whatsapp_number,
    contact_email: settings.contact_email,
    office_address: settings.office_address,
    registration_number: settings.registration_number,
    facebook_url: settings.facebook_url,
    instagram_url: settings.instagram_url,
    tripadvisor_url: settings.tripadvisor_url,
    google_review_url: settings.google_review_url,
    default_currency: settings.default_currency,
    hero_badge: settings.hero_badge,
    hero_title: settings.hero_title,
    hero_subtitle: settings.hero_subtitle,
    hero_image_url: settings.hero_image_url,
    accepting_public_bookings: settings.accepting_public_bookings,
  };
}

export const DEFAULT_PUBLIC_SITE_SETTINGS: PublicSiteSettings = toPublicSiteSettings(
  DEFAULT_SITE_SETTINGS
);

export const QUOTE_VALIDITY_PRESETS = [
  { hours: 24, label: '24 Hours (1 Day)' },
  { hours: 48, label: '48 Hours (2 Days)' },
  { hours: 72, label: '72 Hours (3 Days)' },
  { hours: 168, label: '168 Hours (7 Days)' },
] as const;
