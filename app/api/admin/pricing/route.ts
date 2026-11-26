import { NextResponse } from 'next/server';
import { authorizationResponse, isSameOriginRequest, requireRoles } from '@/lib/server/authorization';
import { createServiceClient } from '@/lib/server/service-client';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SERVICE_TYPES = new Set(['airport_transfer', 'day_trip', 'round_tour', 'vehicle_hire', 'custom']);
const ALLOWED_UNITS = new Set(['booking', 'leg', 'passenger', 'day', 'km']);

function optionalUuid(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  return typeof value === 'string' && UUID_PATTERN.test(value) ? value : undefined;
}

export async function GET() {
  try {
    const { supabase, roles } = await requireRoles(['admin', 'super_admin']);
    const { data, error } = await supabase.rpc('list_pricing_configuration');
    if (error) {
      console.error('Pricing configuration could not be loaded.', error.code);
      return NextResponse.json({ success: false, error: 'Pricing is temporarily unavailable.' }, { status: 503 });
    }
    return NextResponse.json(
      {
        success: true,
        data: data ?? [],
        roles,
        can_manage: roles.includes('super_admin'),
      },
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

    // Read-only Quote Preview Calculator: allowed for both admin & super_admin
    if (input.action === 'preview_quote') {
      const { supabase } = await requireRoles(['admin', 'super_admin']);
      const serviceType = typeof input.service_type === 'string' ? input.service_type : '';
      const categoryId = optionalUuid(input.category_id);
      const currency = typeof input.currency === 'string' ? input.currency.toUpperCase() : 'LKR';
      const days = Number(input.days ?? 1);
      const passengers = Number(input.passengers ?? 1);
      const legs = Number(input.legs ?? 1);
      const km = Number(input.km ?? 0);

      if (
        !SERVICE_TYPES.has(serviceType) ||
        categoryId === undefined ||
        !['LKR', 'USD'].includes(currency) ||
        !Number.isFinite(days) || days < 1 || days > 365 ||
        !Number.isInteger(passengers) || passengers < 1 || passengers > 50 ||
        !Number.isInteger(legs) || legs < 1 || legs > 20 ||
        !Number.isFinite(km) || km < 0 || km > 50000
      ) {
        return NextResponse.json({ success: false, error: 'Quote preview inputs are invalid.' }, { status: 400 });
      }

      const { data, error } = await supabase.rpc('calculate_booking_quote_preview', {
        p_service_type: serviceType,
        p_category_id: categoryId,
        p_currency: currency,
        p_days: days,
        p_passengers: passengers,
        p_legs: legs,
        p_km: km,
      });

      if (error) {
        console.error('Quote preview calculation failed.', error.code, error.message);
        return NextResponse.json(
          { success: false, error: 'Could not calculate quote preview right now.' },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { success: true, data },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // All pricing mutations are strictly Super Admin only
    const { supabase } = await requireRoles(['super_admin']);

    if (input.action === 'save_package') {
      const packageId = optionalUuid(input.package_id);
      const code = typeof input.code === 'string' ? input.code.trim() : '';
      const name = typeof input.name === 'string' ? input.name.trim() : '';
      const serviceType = typeof input.service_type === 'string' ? input.service_type : '';
      const currency = typeof input.currency === 'string' ? input.currency.toUpperCase() : '';
      if (
        packageId === undefined ||
        !/^[A-Za-z0-9_-]{2,60}$/.test(code) ||
        name.length < 2 ||
        name.length > 120 ||
        !SERVICE_TYPES.has(serviceType) ||
        !['LKR', 'USD'].includes(currency) ||
        typeof input.is_active !== 'boolean'
      ) {
        return NextResponse.json({ success: false, error: 'Pricing package details are invalid.' }, { status: 400 });
      }
      const { data, error } = await supabase.rpc('save_pricing_package', {
        p_package_id: packageId,
        p_code: code,
        p_name: name,
        p_service_type: serviceType,
        p_currency: currency,
        p_is_active: input.is_active,
        p_valid_from: typeof input.valid_from === 'string' && input.valid_from ? input.valid_from : null,
        p_valid_until: typeof input.valid_until === 'string' && input.valid_until ? input.valid_until : null,
      });
      if (error) {
        console.error('Pricing package update failed.', error.code, error.message);
        return NextResponse.json(
          {
            success: false,
            error: error.code === '23505'
              ? 'A pricing package with that code already exists.'
              : error.message || 'The pricing package could not be saved.',
          },
          { status: 409 }
        );
      }
      return NextResponse.json({ success: true, data: { package_id: data } });
    }

    if (input.action === 'save_rule') {
      const ruleId = optionalUuid(input.rule_id);
      const packageId = optionalUuid(input.package_id);
      const categoryId = optionalUuid(input.category_id);
      const ruleType = typeof input.rule_type === 'string' ? input.rule_type.trim() : '';
      const unit = typeof input.unit === 'string' ? input.unit : '';
      const amountText = typeof input.amount === 'string' ? input.amount.trim() : String(input.amount ?? '');
      const minText =
        input.min_quantity === null || input.min_quantity === undefined || input.min_quantity === ''
          ? null
          : String(input.min_quantity).trim();
      const maxText =
        input.max_quantity === null || input.max_quantity === undefined || input.max_quantity === ''
          ? null
          : String(input.max_quantity).trim();
      const amount = Number(amountText);
      const minQuantity = minText === null ? null : Number(minText);
      const maxQuantity = maxText === null ? null : Number(maxText);

      if (
        ruleId === undefined ||
        !packageId ||
        packageId === undefined ||
        categoryId === undefined ||
        ruleType.length < 2 ||
        ruleType.length > 80 ||
        !ALLOWED_UNITS.has(unit) ||
        !/^\d{1,10}(?:\.\d{1,2})?$/.test(amountText) ||
        !Number.isFinite(amount) ||
        amount < 0 ||
        (minText !== null && (!/^\d{1,8}(?:\.\d{1,2})?$/.test(minText) || !Number.isFinite(minQuantity))) ||
        (maxText !== null && (!/^\d{1,8}(?:\.\d{1,2})?$/.test(maxText) || !Number.isFinite(maxQuantity))) ||
        (minQuantity !== null && maxQuantity !== null && maxQuantity < minQuantity) ||
        typeof input.is_active !== 'boolean'
      ) {
        return NextResponse.json(
          { success: false, error: 'Pricing rule details are invalid. Check amount, unit, and quantity bounds.' },
          { status: 400 }
        );
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
        console.error('Pricing rule update failed.', error.code, error.message);
        return NextResponse.json(
          { success: false, error: error.message || 'The pricing rule could not be saved.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ success: true, data: { rule_id: data } });
    }

    if (input.action === 'delete_rule') {
      const ruleId = optionalUuid(input.rule_id);
      if (!ruleId) {
        return NextResponse.json({ success: false, error: 'Pricing rule ID is invalid.' }, { status: 400 });
      }
      const rpcRes = await supabase.rpc('delete_pricing_rule', { p_rule_id: ruleId });
      if (rpcRes.error) {
        const service = createServiceClient();
        if (!service) {
          console.error('Pricing rule deletion failed.', rpcRes.error.code);
          return NextResponse.json({ success: false, error: 'Pricing rule could not be deleted.' }, { status: 409 });
        }
        const { error: delErr } = await service.from('pricing_rules').delete().eq('id', ruleId);
        if (delErr) {
          console.error('Pricing rule service deletion failed.', delErr.code);
          return NextResponse.json({ success: false, error: 'Pricing rule could not be deleted.' }, { status: 409 });
        }
      }
      return NextResponse.json({ success: true, message: 'Pricing rule deleted.' });
    }

    if (input.action === 'delete_package') {
      const packageId = optionalUuid(input.package_id);
      if (!packageId) {
        return NextResponse.json({ success: false, error: 'Pricing package ID is invalid.' }, { status: 400 });
      }
      const rpcRes = await supabase.rpc('delete_pricing_package', { p_package_id: packageId });
      if (rpcRes.error) {
        const service = createServiceClient();
        if (!service) {
          console.error('Pricing package deletion failed.', rpcRes.error.code);
          return NextResponse.json(
            { success: false, error: rpcRes.error.message || 'Pricing package could not be deleted.' },
            { status: 409 }
          );
        }
        const { count } = await service
          .from('pricing_rules')
          .select('id', { count: 'exact', head: true })
          .eq('package_id', packageId);
        if ((count ?? 0) > 0) {
          return NextResponse.json(
            { success: false, error: 'Remove all pricing rules inside this package before deleting it.' },
            { status: 409 }
          );
        }
        const { error: delErr } = await service.from('pricing_packages').delete().eq('id', packageId);
        if (delErr) {
          console.error('Pricing package service deletion failed.', delErr.code);
          return NextResponse.json({ success: false, error: 'Pricing package could not be deleted.' }, { status: 409 });
        }
      }
      return NextResponse.json({ success: true, message: 'Pricing package deleted.' });
    }

    return NextResponse.json({ success: false, error: 'Unsupported pricing operation.' }, { status: 400 });
  } catch (error) {
    return authorizationResponse(error);
  }
}
