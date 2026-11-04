import { NextResponse } from 'next/server';
import { authorizationResponse, isSameOriginRequest, requireRoles } from '@/lib/server/authorization';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SERVICE_TYPES = new Set(['airport_transfer', 'day_trip', 'round_tour', 'vehicle_hire', 'custom']);

function optionalUuid(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  return typeof value === 'string' && UUID_PATTERN.test(value) ? value : undefined;
}

export async function GET() {
  try {
    const { supabase } = await requireRoles(['admin', 'super_admin']);
    const { data, error } = await supabase.rpc('list_pricing_configuration');
    if (error) {
      console.error('Pricing configuration could not be loaded.', error.code);
      return NextResponse.json({ success: false, error: 'Pricing is temporarily unavailable.' }, { status: 503 });
    }
    return NextResponse.json({ success: true, data: data ?? [] }, {
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
      return NextResponse.json({ success: false, error: 'Pricing details are invalid.' }, { status: 400 });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: 'Pricing details are invalid.' }, { status: 400 });
    }
    const input = body as Record<string, unknown>;

    if (input.action === 'save_package') {
      const packageId = optionalUuid(input.package_id);
      const code = typeof input.code === 'string' ? input.code.trim() : '';
      const name = typeof input.name === 'string' ? input.name.trim() : '';
      const serviceType = typeof input.service_type === 'string' ? input.service_type : '';
      const currency = input.currency;
      if (packageId === undefined || !/^[A-Za-z0-9_-]{2,60}$/.test(code) ||
          name.length < 2 || !SERVICE_TYPES.has(serviceType) ||
          !['LKR', 'USD'].includes(String(currency)) || typeof input.is_active !== 'boolean') {
        return NextResponse.json({ success: false, error: 'Pricing package details are invalid.' }, { status: 400 });
      }
      const { data, error } = await supabase.rpc('save_pricing_package', {
        p_package_id: packageId,
        p_code: code,
        p_name: name,
        p_service_type: serviceType,
        p_currency: currency,
        p_is_active: input.is_active,
        p_valid_from: typeof input.valid_from === 'string' ? input.valid_from : null,
        p_valid_until: typeof input.valid_until === 'string' ? input.valid_until : null,
      });
      if (error) {
        console.error('Pricing package update failed.', error.code);
        return NextResponse.json({ success: false, error: 'The pricing package could not be saved.' }, { status: 409 });
      }
      return NextResponse.json({ success: true, data: { package_id: data } });
    }

    if (input.action === 'save_rule') {
      const ruleId = optionalUuid(input.rule_id);
      const packageId = optionalUuid(input.package_id);
      const categoryId = optionalUuid(input.category_id);
      const ruleType = typeof input.rule_type === 'string' ? input.rule_type.trim() : '';
      const unit = input.unit;
      const amountText = typeof input.amount === 'string' ? input.amount : String(input.amount ?? '');
      const minText = input.min_quantity === null || input.min_quantity === undefined
        ? null
        : String(input.min_quantity);
      const maxText = input.max_quantity === null || input.max_quantity === undefined
        ? null
        : String(input.max_quantity);
      const amount = Number(amountText);
      const minQuantity = minText === null ? null : Number(minText);
      const maxQuantity = maxText === null ? null : Number(maxText);
      if (ruleId === undefined || !packageId || packageId === undefined || categoryId === undefined ||
          ruleType.length < 2 || !['booking', 'leg', 'passenger', 'day'].includes(String(unit)) ||
          !/^\d{1,10}(?:\.\d{1,2})?$/.test(amountText) ||
          (minText !== null && (!/^\d{1,8}(?:\.\d{1,2})?$/.test(minText) || !Number.isFinite(minQuantity))) ||
          (maxText !== null && (!/^\d{1,8}(?:\.\d{1,2})?$/.test(maxText) || !Number.isFinite(maxQuantity))) ||
          typeof input.is_active !== 'boolean') {
        return NextResponse.json({ success: false, error: 'Pricing rule details are invalid.' }, { status: 400 });
      }
      const { data, error } = await supabase.rpc('save_pricing_rule', {
        p_rule_id: ruleId,
        p_package_id: packageId,
        p_category_id: categoryId,
        p_rule_type: ruleType,
        p_unit: unit,
        p_amount: amount,
        p_min_quantity: minQuantity,
        p_max_quantity: maxQuantity,
        p_is_active: input.is_active,
      });
      if (error) {
        console.error('Pricing rule update failed.', error.code);
        return NextResponse.json({ success: false, error: 'The pricing rule could not be saved.' }, { status: 409 });
      }
      return NextResponse.json({ success: true, data: { rule_id: data } });
    }

    return NextResponse.json({ success: false, error: 'Unsupported pricing operation.' }, { status: 400 });
  } catch (error) {
    return authorizationResponse(error);
  }
}
