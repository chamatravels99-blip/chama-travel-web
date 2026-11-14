import { NextResponse } from 'next/server';
import { authorizationResponse, isSameOriginRequest, requireRoles } from '@/lib/server/authorization';

const PHONE_PATTERN = /^\+?[0-9\s()-]{7,30}$/;

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ success: false, error: 'Request origin is not allowed.' }, { status: 403 });
    }
    const { supabase } = await requireRoles(['admin', 'super_admin']);
    const contentLength = Number(request.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > 8192) {
      return NextResponse.json({ success: false, error: 'Request is too large.' }, { status: 413 });
    }

    let value: unknown;
    try {
      value = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Enter valid driver details.' }, { status: 400 });
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return NextResponse.json({ success: false, error: 'Enter valid driver details.' }, { status: 400 });
    }
    const body = value as Record<string, unknown>;
    const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const licenseNumber = typeof body.license_number === 'string' ? body.license_number.trim().slice(0, 80) : '';
    const driverNotes = typeof body.driver_notes === 'string' ? body.driver_notes.trim().slice(0, 500) : '';

    if (fullName.length < 2 || fullName.length > 120 || !PHONE_PATTERN.test(phone)) {
      return NextResponse.json(
        { success: false, error: 'Provide a valid driver name and phone/WhatsApp number.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc('save_driver', {
      p_driver_id: null,
      p_full_name: fullName,
      p_phone: phone,
      p_license_number: licenseNumber || null,
      p_driver_notes: driverNotes || null,
      p_account_status: 'active',
      p_default_vehicle_id: null,
      p_new_vehicle_category_id: null,
      p_new_vehicle_name: null,
      p_new_vehicle_registration: null,
    });

    if (error) {
      console.error('Driver record creation failed.', error.code);
      return NextResponse.json(
        { success: false, error: 'The driver record could not be created.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data,
        message: 'Driver record created. Drivers do not need an account password.',
      },
      { status: 201 }
    );
  } catch (error) {
    return authorizationResponse(error);
  }
}
