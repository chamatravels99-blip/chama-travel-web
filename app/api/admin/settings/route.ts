import { NextResponse } from 'next/server';
import {
  authorizationResponse,
  isSameOriginRequest,
  requireRoles,
} from '@/lib/server/authorization';
import {
  DEFAULT_SITE_SETTINGS,
  normalizeHeroImageUrl,
  normalizeOptionalHttpUrl,
  normalizeSiteSettingsRow,
  normalizeWhatsAppDigits,
  type SettingsCurrency,
} from '@/lib/site-settings';

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function validateOptionalUrlField(raw: unknown, label: string): { value: string | null; error?: string } {
  if (raw === null || raw === undefined) return { value: null };
  if (typeof raw !== 'string') return { value: null, error: `Enter a valid ${label} URL.` };
  const trimmed = raw.trim();
  if (!trimmed) return { value: null };
  const normalized = normalizeOptionalHttpUrl(trimmed);
  if (!normalized) {
    return { value: null, error: `${label} must be a valid http:// or https:// URL.` };
  }
  return { value: normalized };
}

export async function GET() {
  try {
    const { supabase, user, roles } = await requireRoles(['admin', 'super_admin']);
    const isSuperAdmin = roles.includes('super_admin');

    const { data, error } = await supabase
      .from('site_settings')
      .select('*')
      .eq('id', 'default')
      .maybeSingle();

    if (error) {
      console.error('Failed to load site settings:', error.code);
      return NextResponse.json(
        { success: false, error: 'System settings could not be loaded.' },
        { status: 503 }
      );
    }

    const settings = data ? normalizeSiteSettingsRow(data) : { ...DEFAULT_SITE_SETTINGS };
    const fullName =
      typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name.trim()
        ? user.user_metadata.full_name.trim()
        : user.email ?? 'Admin user';

    return NextResponse.json(
      {
        success: true,
        data: {
          settings,
          roles,
          is_super_admin: isSuperAdmin,
          account: {
            id: user.id,
            email: user.email ?? '',
            full_name: fullName,
            roles,
          },
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return authorizationResponse(error);
  }
}

async function handleSave(request: Request) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json(
        { success: false, error: 'Request origin is not allowed.' },
        { status: 403 }
      );
    }

    const { supabase, user, roles } = await requireRoles(['admin', 'super_admin']);
    const isSuperAdmin = roles.includes('super_admin');

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid request body.' },
        { status: 400 }
      );
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json(
        { success: false, error: 'Invalid settings payload.' },
        { status: 400 }
      );
    }

    const input = body as Record<string, unknown>;
    const section = typeof input.section === 'string' ? input.section.trim() : '';

    // -----------------------------------------------------------------
    // Section: Account Profile (Display Name) — both admin & super_admin
    // -----------------------------------------------------------------
    if (section === 'account_profile') {
      const fullName = typeof input.full_name === 'string' ? input.full_name.trim() : '';
      if (fullName.length < 2 || fullName.length > 120) {
        return NextResponse.json(
          { success: false, error: 'Full name must be between 2 and 120 characters.' },
          { status: 400 }
        );
      }

      const { error: authError } = await supabase.auth.updateUser({
        data: { full_name: fullName },
      });
      if (authError) {
        console.error('Failed to update user display name:', authError.code);
        return NextResponse.json(
          { success: false, error: authError.message || 'Display name could not be updated.' },
          { status: 400 }
        );
      }

      // Best-effort sync to public.profiles if row exists
      await supabase.from('profiles').update({ full_name: fullName }).eq('id', user.id);

      return NextResponse.json({
        success: true,
        data: { full_name: fullName },
        message: 'Display name updated successfully.',
      });
    }

    // -----------------------------------------------------------------
    // Section: Business & Contact Info
    // Operational contact fields: admin + super_admin
    // Brand identity / legal registration: super_admin only
    // -----------------------------------------------------------------
    if (section === 'business_contact') {
      const primaryPhone = typeof input.primary_phone === 'string' ? input.primary_phone.trim() : '';
      const rawWhatsApp = typeof input.whatsapp_number === 'string' ? input.whatsapp_number.trim() : '';
      const whatsappDigits = rawWhatsApp.replace(/\D/g, '');
      const contactEmail = typeof input.contact_email === 'string' ? input.contact_email.trim() : '';
      const officeAddress = typeof input.office_address === 'string' ? input.office_address.trim() : '';

      if (primaryPhone.length < 7 || primaryPhone.length > 40) {
        return NextResponse.json(
          { success: false, error: 'Enter a valid primary phone number (7–40 characters).' },
          { status: 400 }
        );
      }
      if (whatsappDigits.length < 7 || whatsappDigits.length > 15) {
        return NextResponse.json(
          {
            success: false,
            error: 'WhatsApp number must contain 7–15 digits in international format (e.g. 94711114901).',
          },
          { status: 400 }
        );
      }
      if (!EMAIL_PATTERN.test(contactEmail) || contactEmail.length > 254) {
        return NextResponse.json(
          { success: false, error: 'Enter a valid official email address.' },
          { status: 400 }
        );
      }
      if (officeAddress.length < 3 || officeAddress.length > 400) {
        return NextResponse.json(
          { success: false, error: 'Office address must be between 3 and 400 characters.' },
          { status: 400 }
        );
      }

      const fb = validateOptionalUrlField(input.facebook_url, 'Facebook');
      if (fb.error) return NextResponse.json({ success: false, error: fb.error }, { status: 400 });
      const ig = validateOptionalUrlField(input.instagram_url, 'Instagram');
      if (ig.error) return NextResponse.json({ success: false, error: ig.error }, { status: 400 });
      const ta = validateOptionalUrlField(input.tripadvisor_url, 'TripAdvisor');
      if (ta.error) return NextResponse.json({ success: false, error: ta.error }, { status: 400 });
      const gr = validateOptionalUrlField(input.google_review_url, 'Google Review');
      if (gr.error) return NextResponse.json({ success: false, error: gr.error }, { status: 400 });

      const updatePayload: Record<string, unknown> = {
        primary_phone: primaryPhone,
        whatsapp_number: normalizeWhatsAppDigits(whatsappDigits),
        contact_email: contactEmail,
        office_address: officeAddress,
        facebook_url: fb.value,
        instagram_url: ig.value,
        tripadvisor_url: ta.value,
        google_review_url: gr.value,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      };

      if (isSuperAdmin) {
        const businessName =
          typeof input.business_name === 'string' ? input.business_name.trim() : '';
        const tagline = typeof input.tagline === 'string' ? input.tagline.trim() : '';
        const registrationNumber =
          typeof input.registration_number === 'string'
            ? input.registration_number.trim().slice(0, 120) || null
            : null;

        if (businessName.length < 2 || businessName.length > 160) {
          return NextResponse.json(
            { success: false, error: 'Business name must be between 2 and 160 characters.' },
            { status: 400 }
          );
        }
        if (tagline.length < 2 || tagline.length > 240) {
          return NextResponse.json(
            { success: false, error: 'Tagline must be between 2 and 240 characters.' },
            { status: 400 }
          );
        }
        updatePayload.business_name = businessName;
        updatePayload.tagline = tagline;
        updatePayload.registration_number = registrationNumber;
      }

      const { data, error } = await supabase
        .from('site_settings')
        .upsert({ id: 'default', ...updatePayload }, { onConflict: 'id' })
        .select('*')
        .single();

      if (error) {
        console.error('Failed to save business & contact settings:', error.code);
        return NextResponse.json(
          { success: false, error: 'Business & contact settings could not be saved.' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        data: normalizeSiteSettingsRow(data),
        message: isSuperAdmin
          ? 'Business & contact settings saved.'
          : 'Operational contact & social settings saved.',
      });
    }

    // -----------------------------------------------------------------
    // Section: Booking, Quotation & Billing Defaults (Super Admin only)
    // -----------------------------------------------------------------
    if (section === 'billing_defaults') {
      if (!isSuperAdmin) {
        return NextResponse.json(
          {
            success: false,
            error: 'Only a Super Admin can modify financial & billing default settings.',
          },
          { status: 403 }
        );
      }

      const rawCurrency =
        typeof input.default_currency === 'string' ? input.default_currency.trim().toUpperCase() : '';
      if (rawCurrency !== 'USD' && rawCurrency !== 'LKR') {
        return NextResponse.json(
          { success: false, error: 'Default currency must be USD or LKR.' },
          { status: 400 }
        );
      }
      const defaultCurrency: SettingsCurrency = rawCurrency;

      const validityHours = Number(input.default_quote_validity_hours);
      if (!Number.isInteger(validityHours) || validityHours < 1 || validityHours > 720) {
        return NextResponse.json(
          {
            success: false,
            error: 'Default quotation validity must be a whole number between 1 and 720 hours.',
          },
          { status: 400 }
        );
      }

      const bankDetailsRaw =
        typeof input.bank_account_details === 'string' ? input.bank_account_details.trim() : '';
      if (bankDetailsRaw.length > 2000) {
        return NextResponse.json(
          { success: false, error: 'Bank account details must be 2,000 characters or fewer.' },
          { status: 400 }
        );
      }

      const footerNote =
        typeof input.invoice_footer_note === 'string' ? input.invoice_footer_note.trim() : '';
      if (footerNote.length < 3 || footerNote.length > 400) {
        return NextResponse.json(
          { success: false, error: 'Invoice footer note must be between 3 and 400 characters.' },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from('site_settings')
        .upsert(
          {
            id: 'default',
            default_currency: defaultCurrency,
            default_quote_validity_hours: validityHours,
            bank_account_details: bankDetailsRaw || null,
            invoice_footer_note: footerNote,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        )
        .select('*')
        .single();

      if (error) {
        console.error('Failed to save billing settings:', error.code);
        return NextResponse.json(
          { success: false, error: 'Billing & quotation defaults could not be saved.' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        data: normalizeSiteSettingsRow(data),
        message: 'Booking, quotation & billing defaults saved.',
      });
    }

    // -----------------------------------------------------------------
    // Section: Website Hero & Booking Switch (Super Admin only)
    // -----------------------------------------------------------------
    if (section === 'website_hero') {
      if (!isSuperAdmin) {
        return NextResponse.json(
          {
            success: false,
            error: 'Only a Super Admin can modify website hero content or online booking availability.',
          },
          { status: 403 }
        );
      }

      const heroBadge = typeof input.hero_badge === 'string' ? input.hero_badge.trim() : '';
      const heroTitle = typeof input.hero_title === 'string' ? input.hero_title.trim() : '';
      const heroSubtitle = typeof input.hero_subtitle === 'string' ? input.hero_subtitle.trim() : '';
      const rawHeroImage = typeof input.hero_image_url === 'string' ? input.hero_image_url.trim() : '';
      const acceptingPublicBookings = Boolean(input.accepting_public_bookings);

      if (heroBadge.length < 2 || heroBadge.length > 80) {
        return NextResponse.json(
          { success: false, error: 'Hero badge must be between 2 and 80 characters.' },
          { status: 400 }
        );
      }
      if (heroTitle.length < 4 || heroTitle.length > 160) {
        return NextResponse.json(
          { success: false, error: 'Hero headline must be between 4 and 160 characters.' },
          { status: 400 }
        );
      }
      if (heroSubtitle.length < 10 || heroSubtitle.length > 500) {
        return NextResponse.json(
          { success: false, error: 'Hero subtitle must be between 10 and 500 characters.' },
          { status: 400 }
        );
      }

      const heroImageUrl = normalizeHeroImageUrl(rawHeroImage);

      const { data, error } = await supabase
        .from('site_settings')
        .upsert(
          {
            id: 'default',
            hero_badge: heroBadge,
            hero_title: heroTitle,
            hero_subtitle: heroSubtitle,
            hero_image_url: heroImageUrl,
            accepting_public_bookings: acceptingPublicBookings,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        )
        .select('*')
        .single();

      if (error) {
        console.error('Failed to save website hero settings:', error.code);
        return NextResponse.json(
          { success: false, error: 'Website hero & booking settings could not be saved.' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        data: normalizeSiteSettingsRow(data),
        message: acceptingPublicBookings
          ? 'Website hero & online booking settings saved (Bookings LIVE).'
          : 'Website hero & online booking settings saved (Online bookings paused).',
      });
    }

    return NextResponse.json(
      { success: false, error: 'Unsupported settings section.' },
      { status: 400 }
    );
  } catch (error) {
    return authorizationResponse(error);
  }
}

export async function PATCH(request: Request) {
  return handleSave(request);
}

export async function POST(request: Request) {
  return handleSave(request);
}
