import { NextResponse } from 'next/server';
import {
  authorizationResponse,
  isSameOriginRequest,
  requireRoles,
} from '@/lib/server/authorization';
import {
  aggregateCustomerCrmData,
  type CustomerCrmSourceData,
} from '@/lib/admin-customers';
import {
  type ApplicableServiceType,
  type BannerThemeVariant,
  type MarketingBannerRecord,
  type MarketingCustomerRecipient,
  type MarketingTemplateCategory,
  type MarketingTemplateRecord,
  normalizePromoCodeString,
  type PromoCodeRecord,
  type PromoCurrency,
  type PromoDiscountType,
} from '@/lib/marketing';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_DISCOUNT_TYPES = new Set<PromoDiscountType>(['percentage', 'fixed']);
const ALLOWED_CURRENCIES = new Set<PromoCurrency>(['USD', 'LKR', 'ALL']);
const ALLOWED_SERVICES = new Set<ApplicableServiceType>([
  'all',
  'round_tour',
  'airport_transfer',
  'day_trip',
  'vehicle_hire',
  'custom',
]);
const ALLOWED_THEMES = new Set<BannerThemeVariant>(['emerald', 'amber', 'slate']);
const ALLOWED_TEMPLATE_CATEGORIES = new Set<MarketingTemplateCategory>([
  'seasonal_offer',
  'review_request',
  'airport_promo',
  'follow_up',
]);

export async function GET() {
  try {
    const { supabase, roles } = await requireRoles(['admin', 'super_admin']);

    const [promosRes, bannersRes, templatesRes, crmRes] = await Promise.all([
      supabase
        .from('promo_codes')
        .select('*')
        .order('is_active', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('marketing_banners')
        .select('*')
        .order('is_active', { ascending: false })
        .order('updated_at', { ascending: false }),
      supabase
        .from('marketing_templates')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase.rpc('admin_get_customer_crm_source_data'),
    ]);

    if (promosRes.error || bannersRes.error || templatesRes.error) {
      console.error(
        'Failed to load marketing data:',
        promosRes.error?.code,
        bannersRes.error?.code,
        templatesRes.error?.code
      );
      return NextResponse.json(
        {
          success: false,
          error: 'Marketing & Promotions data could not be loaded.',
        },
        { status: 503 }
      );
    }

    const promoCodes = (promosRes.data ?? []) as PromoCodeRecord[];
    const banners = (bannersRes.data ?? []) as MarketingBannerRecord[];
    const templates = (templatesRes.data ?? []) as MarketingTemplateRecord[];

    // Build customer recipients list & count booking note promo redemptions
    let recipients: MarketingCustomerRecipient[] = [];
    const noteUsageCounts = new Map<string, number>();

    if (!crmRes.error && crmRes.data && typeof crmRes.data === 'object') {
      const sourceData = crmRes.data as CustomerCrmSourceData;
      for (const b of sourceData.bookings ?? []) {
        if (b.customer_notes) {
          const match = b.customer_notes.match(/Promo code applied:\s*([A-Z0-9_-]+)/i);
          if (match?.[1]) {
            const codeKey = match[1].toUpperCase();
            noteUsageCounts.set(codeKey, (noteUsageCounts.get(codeKey) ?? 0) + 1);
          }
        }
      }

      const crmOverview = aggregateCustomerCrmData(sourceData);
      recipients = crmOverview.customers
        .filter((c) => Boolean(c.whatsapp || c.phone))
        .map((c) => ({
          id: c.id,
          full_name: c.full_name,
          phone: c.phone || c.whatsapp || '',
          whatsapp: c.whatsapp || c.phone || '',
          email: c.email,
          country: c.country,
          vip_status: c.effective_tier,
          total_bookings: c.total_bookings,
          last_booking_ref: c.bookings[0]?.booking_ref ?? null,
        }));
    }

    const enrichedPromoCodes = promoCodes.map((p) => {
      const noteUses = noteUsageCounts.get(p.code.toUpperCase()) ?? 0;
      const effectiveUsedCount = Math.max(Number(p.used_count) || 0, noteUses);
      return {
        ...p,
        discount_value: Number(p.discount_value),
        min_booking_amount: Number(p.min_booking_amount) || 0,
        used_count: effectiveUsedCount,
      };
    });

    const activeBanner = banners.find((b) => b.is_active) ?? banners[0] ?? null;
    const totalRedemptions = enrichedPromoCodes.reduce(
      (sum, p) => sum + (Number(p.used_count) || 0),
      0
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          promo_codes: enrichedPromoCodes,
          banners,
          active_banner: activeBanner,
          templates,
          customers: recipients,
          kpis: {
            active_promo_codes: enrichedPromoCodes.filter((p) => p.is_active).length,
            total_promo_codes: enrichedPromoCodes.length,
            total_redemptions: totalRedemptions,
            banner_live: Boolean(banners.some((b) => b.is_active)),
            templates_count: templates.length,
          },
        },
        roles,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return authorizationResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json(
        { success: false, error: 'Request origin is not allowed.' },
        { status: 403 }
      );
    }

    const { supabase } = await requireRoles(['admin', 'super_admin']);

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
        { success: false, error: 'Invalid request payload.' },
        { status: 400 }
      );
    }

    const input = body as Record<string, unknown>;
    const action = typeof input.action === 'string' ? input.action : '';

    // -----------------------------------------------------------------
    // 1. Create or Update Promo Code
    // -----------------------------------------------------------------
    if (action === 'save_promo_code') {
      const id =
        typeof input.id === 'string' && UUID_PATTERN.test(input.id) ? input.id : null;
      const code = normalizePromoCodeString(input.code);
      const title = typeof input.title === 'string' ? input.title.trim() : '';
      const discountTypeRaw =
        typeof input.discount_type === 'string' ? input.discount_type.trim() : 'percentage';
      const discountType: PromoDiscountType = ALLOWED_DISCOUNT_TYPES.has(
        discountTypeRaw as PromoDiscountType
      )
        ? (discountTypeRaw as PromoDiscountType)
        : 'percentage';

      const discountValue = Number(input.discount_value);
      const currencyRaw =
        typeof input.currency === 'string' ? input.currency.trim().toUpperCase() : 'USD';
      const currency: PromoCurrency =
        discountType === 'percentage'
          ? 'ALL'
          : ALLOWED_CURRENCIES.has(currencyRaw as PromoCurrency) && currencyRaw !== 'ALL'
            ? (currencyRaw as PromoCurrency)
            : 'USD';

      const minBookingAmount = Math.max(0, Number(input.min_booking_amount) || 0);
      const serviceRaw =
        typeof input.applicable_service === 'string'
          ? input.applicable_service.trim()
          : 'all';
      const applicableService: ApplicableServiceType = ALLOWED_SERVICES.has(
        serviceRaw as ApplicableServiceType
      )
        ? (serviceRaw as ApplicableServiceType)
        : 'all';

      const maxUsesRaw = input.max_uses;
      const maxUses =
        maxUsesRaw === null || maxUsesRaw === undefined || String(maxUsesRaw).trim() === ''
          ? null
          : Number(maxUsesRaw);

      const validUntilRaw =
        typeof input.valid_until === 'string' && input.valid_until.trim()
          ? input.valid_until.trim()
          : null;
      const isActive = input.is_active !== undefined ? Boolean(input.is_active) : true;

      if (code.length < 2 || code.length > 40 || !/^[A-Z0-9_-]+$/.test(code)) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Promo code must be 2–40 characters using uppercase letters, numbers, hyphens, or underscores.',
          },
          { status: 400 }
        );
      }
      if (title.length < 2 || title.length > 200) {
        return NextResponse.json(
          {
            success: false,
            error: 'Promo code title must be between 2 and 200 characters.',
          },
          { status: 400 }
        );
      }
      if (
        !Number.isFinite(discountValue) ||
        discountValue <= 0 ||
        (discountType === 'percentage' && discountValue > 100)
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              discountType === 'percentage'
                ? 'Percentage discount must be between 1 and 100.'
                : 'Fixed discount amount must be greater than 0.',
          },
          { status: 400 }
        );
      }
      if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses <= 0)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Max uses must be a positive whole number or left blank for unlimited.',
          },
          { status: 400 }
        );
      }

      let validUntilIso: string | null = null;
      if (validUntilRaw) {
        const parsedUntil = new Date(
          validUntilRaw.length === 10 ? `${validUntilRaw}T23:59:59+05:30` : validUntilRaw
        );
        if (Number.isNaN(parsedUntil.getTime())) {
          return NextResponse.json(
            { success: false, error: 'Enter a valid expiry date.' },
            { status: 400 }
          );
        }
        validUntilIso = parsedUntil.toISOString();
      }

      const payload = {
        code,
        title,
        discount_type: discountType,
        discount_value: discountValue,
        currency,
        min_booking_amount: minBookingAmount,
        applicable_service: applicableService,
        max_uses: maxUses,
        valid_until: validUntilIso,
        is_active: isActive,
      };

      if (id) {
        const { data, error } = await supabase
          .from('promo_codes')
          .update(payload)
          .eq('id', id)
          .select('*')
          .single();

        if (error) {
          const isDuplicate = error.code === '23505';
          return NextResponse.json(
            {
              success: false,
              error: isDuplicate
                ? `A promo code with code "${code}" already exists.`
                : 'Promo code could not be updated.',
            },
            { status: isDuplicate ? 409 : 400 }
          );
        }
        return NextResponse.json({
          success: true,
          data,
          message: `Promo code ${code} updated.`,
        });
      } else {
        const { data, error } = await supabase
          .from('promo_codes')
          .insert(payload)
          .select('*')
          .single();

        if (error) {
          const isDuplicate = error.code === '23505';
          return NextResponse.json(
            {
              success: false,
              error: isDuplicate
                ? `A promo code with code "${code}" already exists.`
                : 'Promo code could not be created.',
            },
            { status: isDuplicate ? 409 : 400 }
          );
        }
        return NextResponse.json(
          {
            success: true,
            data,
            message: `Promo code ${code} created.`,
          },
          { status: 201 }
        );
      }
    }

    // -----------------------------------------------------------------
    // 2. Toggle Promo Code Active/Paused
    // -----------------------------------------------------------------
    if (action === 'toggle_promo_code') {
      const id = typeof input.id === 'string' ? input.id : '';
      const isActive = Boolean(input.is_active);
      if (!UUID_PATTERN.test(id)) {
        return NextResponse.json(
          { success: false, error: 'Invalid promo code ID.' },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from('promo_codes')
        .update({ is_active: isActive })
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        return NextResponse.json(
          { success: false, error: 'Could not update promo code status.' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        data,
        message: `Promo code ${data.code} is now ${isActive ? 'Active' : 'Paused'}.`,
      });
    }

    // -----------------------------------------------------------------
    // 3. Delete Promo Code
    // -----------------------------------------------------------------
    if (action === 'delete_promo_code') {
      const id = typeof input.id === 'string' ? input.id : '';
      if (!UUID_PATTERN.test(id)) {
        return NextResponse.json(
          { success: false, error: 'Invalid promo code ID.' },
          { status: 400 }
        );
      }

      const { error } = await supabase.from('promo_codes').delete().eq('id', id);
      if (error) {
        return NextResponse.json(
          { success: false, error: 'Could not delete promo code.' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Promo code deleted.',
      });
    }

    // -----------------------------------------------------------------
    // 4. Save / Publish Website Special Offer Banner
    // -----------------------------------------------------------------
    if (action === 'save_banner') {
      const id =
        typeof input.id === 'string' && UUID_PATTERN.test(input.id) ? input.id : null;
      const badgeText =
        typeof input.badge_text === 'string' ? input.badge_text.trim().slice(0, 80) : null;
      const headline = typeof input.headline === 'string' ? input.headline.trim() : '';
      const ctaLabel =
        typeof input.cta_label === 'string' ? input.cta_label.trim().slice(0, 80) : null;
      const ctaLink =
        typeof input.cta_link === 'string' ? input.cta_link.trim().slice(0, 300) : null;
      const promoCodeRaw =
        typeof input.promo_code === 'string' ? normalizePromoCodeString(input.promo_code) : '';
      const promoCode = promoCodeRaw || null;
      const themeRaw =
        typeof input.theme_variant === 'string' ? input.theme_variant.trim() : 'emerald';
      const themeVariant: BannerThemeVariant = ALLOWED_THEMES.has(
        themeRaw as BannerThemeVariant
      )
        ? (themeRaw as BannerThemeVariant)
        : 'emerald';
      const isActive = Boolean(input.is_active);

      if (headline.length < 2 || headline.length > 400) {
        return NextResponse.json(
          {
            success: false,
            error: 'Banner headline must be between 2 and 400 characters.',
          },
          { status: 400 }
        );
      }

      if (isActive) {
        // Deactivate any other active banners first so only one banner is live
        const deactivateQuery = supabase
          .from('marketing_banners')
          .update({ is_active: false })
          .eq('is_active', true);
        if (id) {
          await deactivateQuery.neq('id', id);
        } else {
          await deactivateQuery;
        }
      }

      const payload = {
        badge_text: badgeText || null,
        headline,
        cta_label: ctaLabel || null,
        cta_link: ctaLink || null,
        promo_code: promoCode,
        theme_variant: themeVariant,
        is_active: isActive,
      };

      if (id) {
        const { data, error } = await supabase
          .from('marketing_banners')
          .update(payload)
          .eq('id', id)
          .select('*')
          .single();

        if (error) {
          return NextResponse.json(
            { success: false, error: 'Website offer banner could not be updated.' },
            { status: 400 }
          );
        }
        return NextResponse.json({
          success: true,
          data,
          message: isActive
            ? 'Special Offer Banner saved and published live on the website!'
            : 'Special Offer Banner saved (currently hidden from public website).',
        });
      } else {
        const { data, error } = await supabase
          .from('marketing_banners')
          .insert(payload)
          .select('*')
          .single();

        if (error) {
          return NextResponse.json(
            { success: false, error: 'Website offer banner could not be saved.' },
            { status: 400 }
          );
        }
        return NextResponse.json(
          {
            success: true,
            data,
            message: isActive
              ? 'Special Offer Banner created and published live on the website!'
              : 'Special Offer Banner saved as draft.',
          },
          { status: 201 }
        );
      }
    }

    // -----------------------------------------------------------------
    // 5. Save WhatsApp Campaign / Review Request Template
    // -----------------------------------------------------------------
    if (action === 'save_template') {
      const id =
        typeof input.id === 'string' && UUID_PATTERN.test(input.id) ? input.id : null;
      const title = typeof input.title === 'string' ? input.title.trim() : '';
      const categoryRaw =
        typeof input.category === 'string' ? input.category.trim() : 'seasonal_offer';
      const category: MarketingTemplateCategory = ALLOWED_TEMPLATE_CATEGORIES.has(
        categoryRaw as MarketingTemplateCategory
      )
        ? (categoryRaw as MarketingTemplateCategory)
        : 'seasonal_offer';
      const messageBody =
        typeof input.message_body === 'string' ? input.message_body.trim() : '';

      if (title.length < 2 || title.length > 200) {
        return NextResponse.json(
          {
            success: false,
            error: 'Template title must be between 2 and 200 characters.',
          },
          { status: 400 }
        );
      }
      if (messageBody.length < 5 || messageBody.length > 3000) {
        return NextResponse.json(
          {
            success: false,
            error: 'Template message body must be between 5 and 3,000 characters.',
          },
          { status: 400 }
        );
      }

      const payload = {
        title,
        category,
        message_body: messageBody,
      };

      if (id) {
        const { data, error } = await supabase
          .from('marketing_templates')
          .update(payload)
          .eq('id', id)
          .select('*')
          .single();

        if (error) {
          return NextResponse.json(
            { success: false, error: 'WhatsApp template could not be updated.' },
            { status: 400 }
          );
        }
        return NextResponse.json({
          success: true,
          data,
          message: `Template "${title}" updated.`,
        });
      } else {
        const { data, error } = await supabase
          .from('marketing_templates')
          .insert(payload)
          .select('*')
          .single();

        if (error) {
          return NextResponse.json(
            { success: false, error: 'WhatsApp template could not be created.' },
            { status: 400 }
          );
        }
        return NextResponse.json(
          {
            success: true,
            data,
            message: `Template "${title}" created.`,
          },
          { status: 201 }
        );
      }
    }

    // -----------------------------------------------------------------
    // 6. Delete WhatsApp Template
    // -----------------------------------------------------------------
    if (action === 'delete_template') {
      const id = typeof input.id === 'string' ? input.id : '';
      if (!UUID_PATTERN.test(id)) {
        return NextResponse.json(
          { success: false, error: 'Invalid template ID.' },
          { status: 400 }
        );
      }

      const { error } = await supabase.from('marketing_templates').delete().eq('id', id);
      if (error) {
        return NextResponse.json(
          { success: false, error: 'Could not delete template.' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'WhatsApp template deleted.',
      });
    }

    return NextResponse.json(
      { success: false, error: 'Unsupported marketing action.' },
      { status: 400 }
    );
  } catch (error) {
    return authorizationResponse(error);
  }
}
