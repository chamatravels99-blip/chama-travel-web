import { NextResponse } from 'next/server';
import { authorizationResponse, requireRoles } from '@/lib/server/authorization';

const NO_STORE = { 'Cache-Control': 'no-store' };
const PAGE_SIZE = 50;

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status, headers: NO_STORE });
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const search = (searchParams.get('search') ?? '').trim();
  const type = searchParams.get('type') ?? '';
  const offsetText = searchParams.get('offset') ?? '0';
  const offset = Number(offsetText);
  if (search.length > 100 || !['', 'invoice', 'receipt'].includes(type) ||
      !/^\d{1,5}$/.test(offsetText) || !Number.isSafeInteger(offset) || offset > 10000) {
    return fail('Billing document filters are invalid.', 400);
  }

  try {
    const { supabase } = await requireRoles(['admin', 'super_admin']);
    const { data, error } = await supabase.rpc('admin_list_billing_documents', {
      p_search: search || null,
      p_document_type: type || null,
      p_limit: PAGE_SIZE + 1,
      p_offset: offset,
    });
    if (error || !Array.isArray(data)) {
      if (error) console.error('Billing document history failed.', error.code);
      return fail('Billing document history could not be loaded.', 503);
    }

    return NextResponse.json({
      success: true,
      data: data.slice(0, PAGE_SIZE),
      has_more: data.length > PAGE_SIZE,
    }, { headers: NO_STORE });
  } catch (error) {
    return authorizationResponse(error);
  }
}
