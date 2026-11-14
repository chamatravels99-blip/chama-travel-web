import { NextResponse } from 'next/server';
import { authorizationResponse, isSameOriginRequest, requireRoles } from '@/lib/server/authorization';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PHONE_PATTERN = /^\+?[0-9\s()-]{7,30}$/;

export async function GET() {
  try {
    const { supabase } = await requireRoles(['admin', 'super_admin']);
    const { data, error } = await supabase.rpc('list_fleet_resources');
    if (error) {
      console.error('Fleet data could not be loaded.', error.code);
      return NextResponse.json({ success: false, error: 'Fleet data is temporarily unavailable.' }, { status: 503 });
    }
    return NextResponse.json(
      { success: true, data: data ?? { categories: [], vehicles: [], drivers: [] } },
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
      return NextResponse.json({ success: false, error: 'Fleet details are invalid.' }, { status: 400 });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: 'Fleet details are invalid.' }, { status: 400 });
    }
    const input = body as Record<string, unknown>;

    if (input.action === 'save_driver') {
      const driverId = input.driver_id === null || input.driver_id === undefined || input.driver_id === ''
        ? null
        : typeof input.driver_id === 'string'
          ? input.driver_id.trim()
          : '';
      const fullName = typeof input.full_name === 'string' ? input.full_name.trim() : '';
      const phone = typeof input.phone === 'string' ? input.phone.trim() : '';
      const licenseNumber = typeof input.license_number === 'string' ? input.license_number.trim().slice(0, 80) : '';
      const driverNotes = typeof input.driver_notes === 'string' ? input.driver_notes.trim().slice(0, 500) : '';
      const accountStatus = typeof input.account_status === 'string' && input.account_status.trim()
        ? input.account_status.trim()
        : 'active';
      const defaultVehicleId = input.default_vehicle_id === null || input.default_vehicle_id === undefined || input.default_vehicle_id === ''
        ? null
        : typeof input.default_vehicle_id === 'string'
          ? input.default_vehicle_id.trim()
          : '';
      const newVehicleCategoryId = input.new_vehicle_category_id === null || input.new_vehicle_category_id === undefined || input.new_vehicle_category_id === ''
        ? null
        : typeof input.new_vehicle_category_id === 'string'
          ? input.new_vehicle_category_id.trim()
          : '';
      const newVehicleName = typeof input.new_vehicle_name === 'string' ? input.new_vehicle_name.trim().slice(0, 120) : '';
      const newVehicleRegistration = typeof input.new_vehicle_registration === 'string'
        ? input.new_vehicle_registration.trim().slice(0, 40)
        : '';

      if ((driverId !== null && !UUID_PATTERN.test(driverId)) ||
          fullName.length < 2 || fullName.length > 120 ||
          !PHONE_PATTERN.test(phone) ||
          !['active', 'inactive'].includes(accountStatus) ||
          (defaultVehicleId !== null && !UUID_PATTERN.test(defaultVehicleId)) ||
          (newVehicleCategoryId !== null && !UUID_PATTERN.test(newVehicleCategoryId)) ||
          (newVehicleName.length > 0 && (newVehicleName.length < 2 || newVehicleCategoryId === null))) {
        return NextResponse.json(
          { success: false, error: 'Enter a valid driver name, phone/WhatsApp number, and vehicle selection.' },
          { status: 400 }
        );
      }

      const { data, error } = await supabase.rpc('save_driver', {
        p_driver_id: driverId,
        p_full_name: fullName,
        p_phone: phone,
        p_license_number: licenseNumber || null,
        p_driver_notes: driverNotes || null,
        p_account_status: accountStatus,
        p_default_vehicle_id: defaultVehicleId,
        p_new_vehicle_category_id: newVehicleName ? newVehicleCategoryId : null,
        p_new_vehicle_name: newVehicleName || null,
        p_new_vehicle_registration: newVehicleName ? (newVehicleRegistration || null) : null,
      });

      if (error) {
        console.error('Driver save failed.', error.code);
        return NextResponse.json(
          { success: false, error: error.message || 'The driver record could not be saved.' },
          { status: 409 }
        );
      }

      return NextResponse.json({
        success: true,
        data,
        message: driverId ? 'Driver record updated.' : 'New driver added to fleet.',
      });
    }

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
