import { NextResponse } from 'next/server';
import { authorizationResponse, isSameOriginRequest, requireRoles } from '@/lib/server/authorization';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LAYOUTS = new Set(['standard', 'wide', 'featured']);
const MAX_BULK = 50;

type PhotoRecord = {
  title: string | null;
  alt_text: string;
  category: string;
  image_url: string;
  layout_size: string;
  is_featured_home: boolean;
  is_active: boolean;
  display_order: number;
};

function parsePhoto(input: Record<string, unknown>): PhotoRecord | null {
  const title = typeof input.title === 'string' ? input.title.trim().slice(0, 200) : '';
  const altText = typeof input.alt_text === 'string' ? input.alt_text.trim() : '';
  const category = typeof input.category === 'string' && input.category.trim() ? input.category.trim() : 'Journeys';
  const imageUrl = typeof input.image_url === 'string' ? input.image_url.trim() : '';
  const layout = typeof input.layout_size === 'string' && LAYOUTS.has(input.layout_size) ? input.layout_size : 'standard';
  const displayOrder = Number.isFinite(Number(input.display_order))
    ? Math.max(0, Math.trunc(Number(input.display_order)))
    : 0;

  if (altText.length < 2 || altText.length > 300 || imageUrl.length < 2 || category.length > 80) {
    return null;
  }

  return {
    title: title || null,
    alt_text: altText,
    category,
    image_url: imageUrl,
    layout_size: layout,
    is_featured_home: input.is_featured_home === undefined ? true : Boolean(input.is_featured_home),
    is_active: input.is_active === undefined ? true : Boolean(input.is_active),
    display_order: displayOrder,
  };
}

export async function GET() {
  try {
    const { supabase } = await requireRoles(['admin', 'super_admin']);
    const { data, error } = await supabase
      .from('gallery_photos')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Gallery photos could not be loaded.', error.code);
      return NextResponse.json({ success: false, error: 'Gallery photos could not be loaded.' }, { status: 503 });
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
      return NextResponse.json({ success: false, error: 'Photo payload is invalid.' }, { status: 400 });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: 'Photo payload is invalid.' }, { status: 400 });
    }

    const input = body as Record<string, unknown>;
    const action = typeof input.action === 'string' ? input.action : 'save';

    if (action === 'toggle_featured' || action === 'toggle_active') {
      const id = typeof input.id === 'string' ? input.id.trim() : '';
      if (!UUID_PATTERN.test(id)) {
        return NextResponse.json({ success: false, error: 'Invalid photo ID.' }, { status: 400 });
      }
      const patch =
        action === 'toggle_featured'
          ? { is_featured_home: Boolean(input.is_featured_home) }
          : { is_active: Boolean(input.is_active) };
      const { data, error } = await supabase.from('gallery_photos').update(patch).eq('id', id).select('*').single();
      if (error) {
        console.error('Gallery photo toggle failed.', error.code);
        return NextResponse.json({ success: false, error: 'Could not update photo status.' }, { status: 409 });
      }
      const message =
        action === 'toggle_featured'
          ? patch.is_featured_home
            ? 'Photo added to the Home Page gallery.'
            : 'Photo removed from the Home Page gallery.'
          : patch.is_active
            ? 'Photo published on the public website.'
            : 'Photo hidden from the public website.';
      return NextResponse.json({ success: true, data, message });
    }

    if (action === 'bulk_create') {
      const rawPhotos = Array.isArray(input.photos) ? input.photos : [];
      if (rawPhotos.length === 0 || rawPhotos.length > MAX_BULK) {
        return NextResponse.json(
          { success: false, error: `Provide between 1 and ${MAX_BULK} photos.` },
          { status: 400 }
        );
      }
      const records: PhotoRecord[] = [];
      for (const raw of rawPhotos) {
        if (!raw || typeof raw !== 'object') {
          return NextResponse.json({ success: false, error: 'Photo payload is invalid.' }, { status: 400 });
        }
        const record = parsePhoto(raw as Record<string, unknown>);
        if (!record) {
          return NextResponse.json(
            { success: false, error: 'Every photo needs an image and descriptive alt text.' },
            { status: 400 }
          );
        }
        records.push(record);
      }
      const { data, error } = await supabase.from('gallery_photos').insert(records).select('*');
      if (error) {
        console.error('Gallery bulk create failed.', error.code);
        return NextResponse.json({ success: false, error: 'Photos could not be added.' }, { status: 409 });
      }
      return NextResponse.json({
        success: true,
        data,
        message: `${records.length} photo${records.length === 1 ? '' : 's'} added to the gallery.`,
      });
    }

    // Single save (create or update)
    const id =
      input.id === null || input.id === undefined || input.id === ''
        ? null
        : typeof input.id === 'string'
          ? input.id.trim()
          : '';
    if (id !== null && !UUID_PATTERN.test(id)) {
      return NextResponse.json({ success: false, error: 'Invalid photo ID.' }, { status: 400 });
    }
    const record = parsePhoto(input);
    if (!record) {
      return NextResponse.json(
        { success: false, error: 'Please provide an image and descriptive alt text (2–300 characters).' },
        { status: 400 }
      );
    }

    const query = id
      ? supabase.from('gallery_photos').update(record).eq('id', id).select('*').single()
      : supabase.from('gallery_photos').insert(record).select('*').single();
    const { data, error } = await query;
    if (error) {
      console.error('Gallery photo save failed.', error.code);
      return NextResponse.json({ success: false, error: 'Photo could not be saved.' }, { status: 409 });
    }
    return NextResponse.json({
      success: true,
      data,
      message: id ? 'Photo updated successfully.' : 'Photo added to the gallery.',
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
      return NextResponse.json({ success: false, error: 'Invalid photo ID.' }, { status: 400 });
    }
    const { error } = await supabase.from('gallery_photos').delete().eq('id', id);
    if (error) {
      console.error('Gallery photo delete failed.', error.code);
      return NextResponse.json({ success: false, error: 'Photo could not be deleted.' }, { status: 409 });
    }
    return NextResponse.json({ success: true, message: 'Photo deleted.' });
  } catch (error) {
    return authorizationResponse(error);
  }
}
