import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  type MarketingBannerRecord,
  normalizePromoCodeString,
  type PromoCodeRecord,
  validatePromoCodeRecord,
} from '@/lib/marketing';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('marketing_banners')
      .select(
        'id, badge_text, headline, cta_label, cta_link, promo_code, theme_variant, is_active, created_at, updated_at'
      )
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Public marketing banner could not be loaded.', error.code);
      return NextResponse.json(
        { success: false, data: { banner: null } },
        { status: 200, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const activeBanner = (data?.[0] as MarketingBannerRecord | undefined) ?? null;

    return NextResponse.json(
      {
        success: true,
        data: {
          banner: activeBanner,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Public marketing route failed.', error);
    return NextResponse.json(
      { success: false, data: { banner: null } },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, valid: false, error: 'Enter a valid promo code.' },
        { status: 400 }
      );
    }

    const input =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};

    const action = typeof input.action === 'string' ? input.action : 'validate_code';
    if (action !== 'validate_code') {
      return NextResponse.json(
        { success: false, valid: false, error: 'Unsupported action.' },
        { status: 400 }
      );
    }

    const code = normalizePromoCodeString(input.code);
    if (!code || code.length < 2) {
      return NextResponse.json(
        {
          success: false,
          valid: false,
          error: 'Please enter a valid promo code.',
        },
        { status: 400 }
      );
    }

    const serviceType =
      typeof input.service_type === 'string' ? input.service_type.trim() : null;
    const bookingAmount =
      input.booking_amount !== undefined && input.booking_amount !== null
        ? Number(input.booking_amount)
        : null;
    const currency =
      typeof input.currency === 'string' ? input.currency.trim().toUpperCase() : null;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('promo_codes')
      .select(
        'id, code, title, discount_type, discount_value, currency, min_booking_amount, applicable_service, max_uses, used_count, valid_from, valid_until, is_active, created_at, updated_at'
      )
      .eq('code', code)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('Promo code lookup failed.', error.code);
      return NextResponse.json(
        {
          success: false,
          valid: false,
          error: 'Promo code verification is temporarily unavailable.',
        },
        { status: 503 }
      );
    }

    const validation = validatePromoCodeRecord(
      (data as PromoCodeRecord | null) ?? null,
      {
        serviceType,
        bookingAmount,
        currency,
      }
    );

    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          valid: false,
          error: validation.error || 'This promo code is invalid or expired.',
        },
        { status: 200, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return NextResponse.json(
      {
        success: true,
        valid: true,
        data: validation,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Promo code validation failed.', error);
    return NextResponse.json(
      {
        success: false,
        valid: false,
        error: 'Promo code could not be verified.',
      },
      { status: 500 }
    );
  }
}
