import { NextResponse } from 'next/server';
import { authorizationResponse, isSameOriginRequest, requireRoles } from '@/lib/server/authorization';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET() {
  try {
    const { supabase } = await requireRoles(['admin', 'super_admin']);
    const { data, error } = await supabase.rpc('list_fleet_resources');
    if (error) {
      console.error('Fleet data could not be loaded.', error.code);
      return NextResponse.json({ success: false, error: 'Fleet data is temporarily unavailable.' }, { status: 503 });
    }
    return NextResponse.json({ success: true, data: data ?? { categories: [], vehicles: [] } }, {
      headers: { 'Cache-Control': 'no-store' },
    });
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
      return NextResponse.json({ success: false, error: 'Fleet details are invalid.' }, { status: 400 });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: 'Fleet details are invalid.' }, { status: 400 });
    }
    const input = body as Record<string, unknown>;

    if (input.action === 'save_category') {
      const id = input.category_id === null ? null : typeof input.category_id === 'string' ? input.category_id : '';
      const code = typeof input.code === 'string' ? input.code.trim() : '';
      const displayName = typeof input.display_name === 'string' ? input.display_name.trim() : '';
      const maxPassengers = Number(input.max_passengers);
      const maxLuggage = Number(input.max_luggage);
      if ((id !== null && (typeof id !== 'string' || !UUID_PATTERN.test(id))) ||
          !/^[a-z][a-z0-9_]{1,39}$/.test(code) || displayName.length < 2 ||
          !Number.isInteger(maxPassengers) || !Number.isInteger(maxLuggage) ||
          typeof input.is_active !== 'boolean') {
        return NextResponse.json({ success: false, error: 'Vehicle category details are invalid.' }, { status: 400 });
      }
      const { data, error } = await supabase.rpc('save_vehicle_category', {
        p_category_id: id,
        p_code: code,
        p_display_name: displayName,
        p_max_passengers: maxPassengers,
        p_max_luggage: maxLuggage,
        p_is_active: input.is_active,
      });
      if (error) {
        console.error('Vehicle category update failed.', error.code);
        return NextResponse.json({ success: false, error: 'The vehicle category could not be saved.' }, { status: 409 });
      }
      return NextResponse.json({ success: true, data: { category_id: data } });
    }

    if (input.action === 'save_vehicle') {
      const id = input.vehicle_id === null ? null : typeof input.vehicle_id === 'string' ? input.vehicle_id : '';
      const categoryId = typeof input.category_id === 'string' ? input.category_id : '';
      const displayName = typeof input.display_name === 'string' ? input.display_name.trim() : '';
      const registrationNumber = typeof input.registration_number === 'string'
        ? input.registration_number.trim().slice(0, 40)
        : '';
      const status = input.operational_status;
      if ((id !== null && (typeof id !== 'string' || !UUID_PATTERN.test(id))) ||
          !UUID_PATTERN.test(categoryId) || displayName.length < 2 ||
          !['active', 'inactive', 'maintenance'].includes(String(status))) {
        return NextResponse.json({ success: false, error: 'Vehicle details are invalid.' }, { status: 400 });
      }
      const { data, error } = await supabase.rpc('save_vehicle', {
        p_vehicle_id: id,
        p_category_id: categoryId,
        p_display_name: displayName,
        p_registration_number: registrationNumber || null,
        p_operational_status: status,
      });
      if (error) {
        console.error('Vehicle update failed.', error.code);
        return NextResponse.json({ success: false, error: 'The vehicle could not be saved.' }, { status: 409 });
      }
      return NextResponse.json({ success: true, data: { vehicle_id: data } });
    }

    return NextResponse.json({ success: false, error: 'Unsupported fleet operation.' }, { status: 400 });
  } catch (error) {
    return authorizationResponse(error);
  }
}
