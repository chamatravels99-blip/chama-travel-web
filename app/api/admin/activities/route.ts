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

function parsePrice(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export async function GET() {
  try {
    const { supabase } = await requireRoles(['admin', 'super_admin']);
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Activities could not be loaded.', error.code);
      return NextResponse.json({ success: false, error: 'Activities could not be loaded.' }, { status: 503 });
    }

    return NextResponse.json({ success: true, data: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
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
      return NextResponse.json({ success: false, error: 'Activity payload is invalid.' }, { status: 400 });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: 'Activity payload is invalid.' }, { status: 400 });
    }

    const input = body as Record<string, unknown>;
    const action = typeof input.action === 'string' ? input.action : 'save';

    if (action === 'toggle_featured' || action === 'toggle_active') {
      const id = typeof input.id === 'string' ? input.id.trim() : '';
      if (!UUID_PATTERN.test(id)) {
        return NextResponse.json({ success: false, error: 'Invalid activity ID.' }, { status: 400 });
      }
      const patch =
        action === 'toggle_featured'
          ? { is_featured_home: Boolean(input.is_featured_home) }
          : { is_active: Boolean(input.is_active) };
      const { data, error } = await supabase.from('activities').update(patch).eq('id', id).select('*').single();
      if (error) {
        console.error('Activity toggle failed.', error.code);
        return NextResponse.json({ success: false, error: 'Could not update activity status.' }, { status: 409 });
      }
      const message =
        action === 'toggle_featured'
          ? patch.is_featured_home
            ? 'Activity added to the Home Page "Things to Do" carousel.'
            : 'Activity removed from the Home Page carousel.'
          : patch.is_active
            ? 'Activity published on the public website.'
            : 'Activity hidden from the public website.';
      return NextResponse.json({ success: true, data, message });
    }

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
    const location = typeof input.location === 'string' ? input.location.trim() : '';
    const duration = typeof input.duration === 'string' ? input.duration.trim() : '';
    const description = typeof input.description === 'string' ? input.description.trim() : '';
    const imageUrl = typeof input.image_url === 'string' ? input.image_url.trim() : '';
    const imageAlt = typeof input.image_alt === 'string' ? input.image_alt.trim() : '';
    const displayOrder = Number.isFinite(Number(input.display_order))
      ? Math.max(0, Math.trunc(Number(input.display_order)))
      : 0;
    const highlights = Array.isArray(input.highlights)
      ? input.highlights
          .map((item) => (typeof item === 'string' ? item.trim() : ''))
          .filter((item) => item.length > 0)
          .slice(0, 20)
      : [];

    if (
      (id !== null && !UUID_PATTERN.test(id)) ||
      title.length < 2 ||
      title.length > 200 ||
      !SLUG_PATTERN.test(slug) ||
      category.length < 1 ||
      category.length > 80 ||
      description.length < 1 ||
      imageUrl.length < 2
    ) {
      return NextResponse.json(
        { success: false, error: 'Please provide a valid title, category, description, and cover image.' },
        { status: 400 }
      );
    }

    const record = {
      title,
      slug,
      category,
      location: location || null,
      duration: duration || null,
      price_usd: parsePrice(input.price_usd),
      price_lkr: parsePrice(input.price_lkr),
      description,
      image_url: imageUrl,
      image_alt: imageAlt || title,
      highlights,
      is_featured_home: input.is_featured_home === undefined ? true : Boolean(input.is_featured_home),
      is_active: input.is_active === undefined ? true : Boolean(input.is_active),
      display_order: displayOrder,
    };

    const query = id
      ? supabase.from('activities').update(record).eq('id', id).select('*').single()
      : supabase.from('activities').insert(record).select('*').single();
    const { data, error } = await query;

    if (error) {
      console.error('Activity save failed.', error.code);
      return NextResponse.json(
        {
          success: false,
          error: error.code === '23505' ? 'An activity with this slug already exists.' : 'Activity could not be saved.',
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      message: id ? `"${title}" updated successfully.` : `"${title}" added to activities.`,
    });
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
    const id = (new URL(request.url).searchParams.get('id') ?? '').trim();
    if (!UUID_PATTERN.test(id)) {
      return NextResponse.json({ success: false, error: 'Invalid activity ID.' }, { status: 400 });
    }
    const { error } = await supabase.from('activities').delete().eq('id', id);
    if (error) {
      console.error('Activity delete failed.', error.code);
      return NextResponse.json({ success: false, error: 'Activity could not be deleted.' }, { status: 409 });
    }
    return NextResponse.json({ success: true, message: 'Activity deleted.' });
  } catch (error) {
    return authorizationResponse(error);
  }
}
