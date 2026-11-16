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
      .from('destinations')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Destinations could not be loaded.', error.code);
      return NextResponse.json(
        { success: false, error: 'Destinations could not be loaded.' },
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
      return NextResponse.json({ success: false, error: 'Destination payload is invalid.' }, { status: 400 });
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: 'Destination payload is invalid.' }, { status: 400 });
    }

    const input = body as Record<string, unknown>;
    const action = typeof input.action === 'string' ? input.action : 'save';

    if (action === 'toggle_featured') {
      const id = typeof input.id === 'string' ? input.id.trim() : '';
      const isFeaturedHome = Boolean(input.is_featured_home);
      if (!UUID_PATTERN.test(id)) {
        return NextResponse.json({ success: false, error: 'Invalid destination ID.' }, { status: 400 });
      }
      const { data, error } = await supabase
        .from('destinations')
        .update({ is_featured_home: isFeaturedHome })
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        console.error('Destination featured toggle failed.', error.code);
        return NextResponse.json(
          { success: false, error: error.message || 'Could not update Home Featured status.' },
          { status: 409 }
        );
      }

      return NextResponse.json({
        success: true,
        data,
        message: isFeaturedHome ? 'Added to Home Page featured destinations.' : 'Removed from Home Page featured destinations.',
      });
    }

    if (action === 'toggle_active') {
      const id = typeof input.id === 'string' ? input.id.trim() : '';
      const isActive = Boolean(input.is_active);
      if (!UUID_PATTERN.test(id)) {
        return NextResponse.json({ success: false, error: 'Invalid destination ID.' }, { status: 400 });
      }
      const { data, error } = await supabase
        .from('destinations')
        .update({ is_active: isActive })
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        console.error('Destination active toggle failed.', error.code);
        return NextResponse.json(
          { success: false, error: error.message || 'Could not update visibility status.' },
          { status: 409 }
        );
      }

      return NextResponse.json({
        success: true,
        data,
        message: isActive ? 'Destination published and visible on website.' : 'Destination hidden from public website.',
      });
    }

    // Full save (create or update)
    const id =
      input.id === null || input.id === undefined || input.id === ''
        ? null
        : typeof input.id === 'string'
          ? input.id.trim()
          : '';
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    const rawSlug = typeof input.slug === 'string' && input.slug.trim() ? input.slug.trim() : name;
    const slug = toSlug(rawSlug);
    const region = typeof input.region === 'string' ? input.region.trim() : '';
    const tagline = typeof input.tagline === 'string' ? input.tagline.trim() : '';
    const description = typeof input.description === 'string' ? input.description.trim() : '';
    const imageUrl = typeof input.image_url === 'string' ? input.image_url.trim() : '';
    const bestTime = typeof input.best_time === 'string' ? input.best_time.trim() : '';
    const travelDuration = typeof input.travel_duration === 'string' ? input.travel_duration.trim() : '';
    const isFeaturedHome = Boolean(input.is_featured_home);
    const isActive = input.is_active === undefined ? true : Boolean(input.is_active);
    const displayOrder = Number.isFinite(Number(input.display_order))
      ? Math.max(0, Math.trunc(Number(input.display_order)))
      : 0;

    const highlights = Array.isArray(input.highlights)
      ? input.highlights
          .map((item) => (typeof item === 'string' ? item.trim() : ''))
          .filter((item) => item.length > 0)
      : [];

    if (
      (id !== null && !UUID_PATTERN.test(id)) ||
      name.length < 2 ||
      name.length > 160 ||
      !SLUG_PATTERN.test(slug) ||
      imageUrl.length < 2
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Please provide a valid destination name, URL slug, and image.',
        },
        { status: 400 }
      );
    }

    const record = {
      name,
      slug,
      region: region || null,
      tagline: tagline || null,
      description: description || null,
      image_url: imageUrl,
      highlights,
      best_time: bestTime || null,
      travel_duration: travelDuration || null,
      is_featured_home: isFeaturedHome,
      is_active: isActive,
      display_order: displayOrder,
    };

    if (id) {
      const { data, error } = await supabase
        .from('destinations')
        .update(record)
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        console.error('Destination update failed.', error.code);
        return NextResponse.json(
          {
            success: false,
            error:
              error.code === '23505'
                ? 'A destination with this slug already exists.'
                : error.message || 'Destination could not be updated.',
          },
          { status: 409 }
        );
      }

      return NextResponse.json({
        success: true,
        data,
        message: `"${name}" updated successfully.`,
      });
    } else {
      const { data, error } = await supabase
        .from('destinations')
        .insert(record)
        .select('*')
        .single();

      if (error) {
        console.error('Destination creation failed.', error.code);
        return NextResponse.json(
          {
            success: false,
            error:
              error.code === '23505'
                ? 'A destination with this slug already exists.'
                : error.message || 'Destination could not be created.',
          },
          { status: 409 }
        );
      }

      return NextResponse.json({
        success: true,
        data,
        message: `"${name}" added to destinations.`,
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
      return NextResponse.json({ success: false, error: 'Invalid destination ID.' }, { status: 400 });
    }

    const { error } = await supabase.from('destinations').delete().eq('id', id);
    if (error) {
      console.error('Destination delete failed.', error.code);
      return NextResponse.json(
        { success: false, error: error.message || 'Destination could not be deleted.' },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Destination deleted.',
    });
  } catch (error) {
    return authorizationResponse(error);
  }
}
