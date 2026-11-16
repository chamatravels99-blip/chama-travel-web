import { NextResponse } from 'next/server';
import { authorizationResponse, isSameOriginRequest, requireRoles } from '@/lib/server/authorization';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function GET() {
  try {
    const { supabase } = await requireRoles(['admin', 'super_admin']);
    const { data, error } = await supabase
      .from('tour_packages')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Tour packages could not be loaded.', error.code);
      return NextResponse.json(
        { success: false, error: 'Tour packages could not be loaded.' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { success: true, data: data ?? [] },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return authorizationResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ success: false, error: 'Request origin is not allowed.' }, { status: 403 });
    }
    const { supabase } = await requireRoles(['admin', 'super_admin']);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Tour package payload is invalid.' }, { status: 400 });
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: 'Tour package payload is invalid.' }, { status: 400 });
    }

    const input = body as Record<string, unknown>;
    const action = typeof input.action === 'string' ? input.action : 'save';

    if (action === 'toggle_featured') {
      const id = typeof input.id === 'string' ? input.id.trim() : '';
      const isFeaturedHome = Boolean(input.is_featured_home);
      if (!UUID_PATTERN.test(id)) {
        return NextResponse.json({ success: false, error: 'Invalid tour package ID.' }, { status: 400 });
      }
      const { data, error } = await supabase
        .from('tour_packages')
        .update({ is_featured_home: isFeaturedHome })
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        console.error('Tour package featured toggle failed.', error.code);
        return NextResponse.json(
          { success: false, error: error.message || 'Could not update Home Featured status.' },
          { status: 409 }
        );
      }

      return NextResponse.json({
        success: true,
        data,
        message: isFeaturedHome
          ? 'Added to Home Page featured tour packages.'
          : 'Removed from Home Page featured tour packages.',
      });
    }

    if (action === 'toggle_active') {
      const id = typeof input.id === 'string' ? input.id.trim() : '';
      const isActive = Boolean(input.is_active);
      if (!UUID_PATTERN.test(id)) {
        return NextResponse.json({ success: false, error: 'Invalid tour package ID.' }, { status: 400 });
      }
      const { data, error } = await supabase
        .from('tour_packages')
        .update({ is_active: isActive })
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        console.error('Tour package active toggle failed.', error.code);
        return NextResponse.json(
          { success: false, error: error.message || 'Could not update visibility status.' },
          { status: 409 }
        );
      }

      return NextResponse.json({
        success: true,
        data,
        message: isActive
          ? 'Tour package published and visible on website.'
          : 'Tour package hidden from public website.',
      });
    }

    // Full save (create or update)
    const id =
      input.id === null || input.id === undefined || input.id === ''
        ? null
        : typeof input.id === 'string'
          ? input.id.trim()
          : '';
    const title = typeof input.title === 'string' ? input.title.trim() : '';
    const rawSlug = typeof input.slug === 'string' && input.slug.trim() ? input.slug.trim() : title;
    const slug = toSlug(rawSlug);
    const category = typeof input.category === 'string' ? input.category.trim() : '';
    const duration = typeof input.duration === 'string' ? input.duration.trim() : '';
    const daysCount = Number.isFinite(Number(input.days_count))
      ? Math.max(1, Math.trunc(Number(input.days_count)))
      : 1;

    const priceUsd =
      input.price_usd === null || input.price_usd === undefined || input.price_usd === ''
        ? null
        : Number.isFinite(Number(input.price_usd)) && Number(input.price_usd) >= 0
          ? Number(input.price_usd)
          : null;

    const priceLkr =
      input.price_lkr === null || input.price_lkr === undefined || input.price_lkr === ''
        ? null
        : Number.isFinite(Number(input.price_lkr)) && Number(input.price_lkr) >= 0
          ? Number(input.price_lkr)
          : null;

    const priceNote = typeof input.price_note === 'string' ? input.price_note.trim() : '';
    const tagline = typeof input.tagline === 'string' ? input.tagline.trim() : '';
    const description = typeof input.description === 'string' ? input.description.trim() : '';
    const imageUrl = typeof input.image_url === 'string' ? input.image_url.trim() : '';
    const isFeaturedHome = Boolean(input.is_featured_home);
    const isActive = input.is_active === undefined ? true : Boolean(input.is_active);
    const displayOrder = Number.isFinite(Number(input.display_order))
      ? Math.max(0, Math.trunc(Number(input.display_order)))
      : 0;

    const parseStringArray = (raw: unknown): string[] =>
      Array.isArray(raw)
        ? raw
            .map((item) => (typeof item === 'string' ? item.trim() : ''))
            .filter((item) => item.length > 0)
        : [];

    const destinationsCovered = parseStringArray(input.destinations_covered);
    const highlights = parseStringArray(input.highlights);
    const included = parseStringArray(input.included);

    const itinerary = Array.isArray(input.itinerary)
      ? input.itinerary
          .map((item, idx) => {
            if (!item || typeof item !== 'object') return null;
            const d = item as Record<string, unknown>;
            const dayNum = Number.isFinite(Number(d.day)) ? Math.max(1, Math.trunc(Number(d.day))) : idx + 1;
            const dayTitle = typeof d.title === 'string' ? d.title.trim() : '';
            const dayDesc = typeof d.description === 'string' ? d.description.trim() : '';
            const dayRoute = typeof d.route === 'string' ? d.route.trim() : '';
            const overnightLocation =
              typeof d.overnightLocation === 'string' ? d.overnightLocation.trim() : '';
            const travelTime = typeof d.travelTime === 'string' ? d.travelTime.trim() : '';
            const activities = parseStringArray(d.activities);
            if (!dayTitle && !dayDesc) return null;
            return {
              day: dayNum,
              title: dayTitle || `Day ${dayNum}`,
              route: dayRoute || undefined,
              description: dayDesc,
              activities: activities.length > 0 ? activities : undefined,
              overnightLocation: overnightLocation || undefined,
              travelTime: travelTime || undefined,
            };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null)
      : [];

    if (
      (id !== null && !UUID_PATTERN.test(id)) ||
      title.length < 2 ||
      title.length > 200 ||
      !SLUG_PATTERN.test(slug) ||
      duration.length < 1 ||
      imageUrl.length < 2
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Please provide a valid package title, URL slug, duration, and cover image.',
        },
        { status: 400 }
      );
    }

    const record = {
      title,
      slug,
      category: category || null,
      duration,
      days_count: daysCount,
      price_usd: priceUsd,
      price_lkr: priceLkr,
      price_note: priceNote || null,
      tagline: tagline || null,
      description: description || null,
      image_url: imageUrl,
      destinations_covered: destinationsCovered,
      highlights,
      included,
      itinerary,
      is_featured_home: isFeaturedHome,
      is_active: isActive,
      display_order: displayOrder,
    };

    if (id) {
      const { data, error } = await supabase
        .from('tour_packages')
        .update(record)
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        console.error('Tour package update failed.', error.code);
        return NextResponse.json(
          {
            success: false,
            error:
              error.code === '23505'
                ? 'A tour package with this slug already exists.'
                : error.message || 'Tour package could not be updated.',
          },
          { status: 409 }
        );
      }

      return NextResponse.json({
        success: true,
        data,
        message: `"${title}" updated successfully.`,
      });
    } else {
      const { data, error } = await supabase
        .from('tour_packages')
        .insert(record)
        .select('*')
        .single();

      if (error) {
        console.error('Tour package creation failed.', error.code);
        return NextResponse.json(
          {
            success: false,
            error:
              error.code === '23505'
                ? 'A tour package with this slug already exists.'
                : error.message || 'Tour package could not be created.',
          },
          { status: 409 }
        );
      }

      return NextResponse.json({
        success: true,
        data,
        message: `"${title}" added to tour packages.`,
      });
    }
  } catch (error) {
    return authorizationResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ success: false, error: 'Request origin is not allowed.' }, { status: 403 });
    }
    const { supabase } = await requireRoles(['admin', 'super_admin']);

    const { searchParams } = new URL(request.url);
    const id = (searchParams.get('id') ?? '').trim();

    if (!UUID_PATTERN.test(id)) {
      return NextResponse.json({ success: false, error: 'Invalid tour package ID.' }, { status: 400 });
    }

    const { error } = await supabase.from('tour_packages').delete().eq('id', id);
    if (error) {
      console.error('Tour package delete failed.', error.code);
      return NextResponse.json(
        { success: false, error: error.message || 'Tour package could not be deleted.' },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Tour package deleted.',
    });
  } catch (error) {
    return authorizationResponse(error);
  }
}
