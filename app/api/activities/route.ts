import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const featuredOnly = searchParams.get('featured') === 'true';

    const supabase = await createClient();
    let query = supabase
      .from('activities')
      .select(
        'id, title, slug, category, location, duration, price_usd, price_lkr, description, image_url, image_alt, highlights, is_featured_home, is_active, display_order'
      )
      .eq('is_active', true);

    if (featuredOnly) {
      query = query.eq('is_featured_home', true);
    }

    const { data, error } = await query
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Public activities could not be loaded.', error.code);
      return NextResponse.json(
        { success: false, error: 'Activities are temporarily unavailable.' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return NextResponse.json(
      { success: true, data: data ?? [] },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Public activities route failed.', error);
    return NextResponse.json(
      { success: false, error: 'Activities are temporarily unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
