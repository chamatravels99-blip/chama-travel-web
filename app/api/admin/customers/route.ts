import { NextResponse } from 'next/server';
import {
  authorizationResponse,
  isSameOriginRequest,
  requireRoles,
} from '@/lib/server/authorization';
import {
  aggregateCustomerCrmData,
  parseCustomerCrmUpsertInput,
  type CustomerCrmSourceData,
} from '@/lib/admin-customers';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET() {
  try {
    const { supabase } = await requireRoles(['admin', 'super_admin']);

    const { data, error } = await supabase.rpc('admin_get_customer_crm_source_data');
    if (error || !data || typeof data !== 'object') {
      console.error('Customer CRM source data RPC failed.', error?.code);
      return NextResponse.json(
        { success: false, error: 'Customer CRM data is temporarily unavailable.' },
        { status: 503 }
      );
    }

    const source = data as CustomerCrmSourceData;
    const overview = aggregateCustomerCrmData({
      crm_profiles: Array.isArray(source.crm_profiles) ? source.crm_profiles : [],
      bookings: Array.isArray(source.bookings) ? source.bookings : [],
      quotes: Array.isArray(source.quotes) ? source.quotes : [],
      payments: Array.isArray(source.payments) ? source.payments : [],
      invoices: Array.isArray(source.invoices) ? source.invoices : [],
    });

    return NextResponse.json(
      {
        success: true,
        data: overview,
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
      return NextResponse.json(
        { success: false, error: 'Request origin is not allowed.' },
        { status: 403 }
      );
    }
    const { supabase } = await requireRoles(['admin', 'super_admin']);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Customer CRM payload is invalid.' },
        { status: 400 }
      );
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json(
        { success: false, error: 'Customer CRM payload is invalid.' },
        { status: 400 }
      );
    }

    const input = body as Record<string, unknown>;
    const parsed = parseCustomerCrmUpsertInput(input);
    if (!parsed.data) {
      return NextResponse.json(
        { success: false, error: parsed.error || 'Customer CRM details are invalid.' },
        { status: 400 }
      );
    }

    const crmProfileId =
      typeof input.crm_profile_id === 'string' && UUID_PATTERN.test(input.crm_profile_id.trim())
        ? input.crm_profile_id.trim()
        : null;

    if (crmProfileId) {
      const { data, error } = await supabase
        .from('customer_crm_profiles')
        .update({
          full_name: parsed.data.full_name,
          email: parsed.data.email,
          phone: parsed.data.phone,
          whatsapp: parsed.data.whatsapp,
          country: parsed.data.country,
          vip_status: parsed.data.vip_status,
          notes: parsed.data.notes,
        })
        .eq('id', crmProfileId)
        .select('*')
        .single();

      if (error) {
        console.error('Customer CRM profile update failed.', error.code);
        return NextResponse.json(
          {
            success: false,
            error: error.message || 'Customer CRM profile could not be updated.',
          },
          { status: 409 }
        );
      }

      return NextResponse.json({
        success: true,
        data,
        message: `CRM profile for "${parsed.data.full_name}" updated.`,
      });
    }

    const { data, error } = await supabase
      .from('customer_crm_profiles')
      .upsert(
        {
          normalized_key: parsed.data.normalized_key,
          full_name: parsed.data.full_name,
          email: parsed.data.email,
          phone: parsed.data.phone,
          whatsapp: parsed.data.whatsapp,
          country: parsed.data.country,
          vip_status: parsed.data.vip_status,
          notes: parsed.data.notes,
        },
        { onConflict: 'normalized_key' }
      )
      .select('*')
      .single();

    if (error) {
      console.error('Customer CRM profile upsert failed.', error.code);
      return NextResponse.json(
        {
          success: false,
          error: error.message || 'Customer CRM profile could not be saved.',
        },
        { status: 409 }
      );
    }

    const isManualCreate = input.action === 'create_customer';
    return NextResponse.json(
      {
        success: true,
        data,
        message: isManualCreate
          ? `"${parsed.data.full_name}" added to Customer CRM.`
          : `CRM profile for "${parsed.data.full_name}" saved.`,
      },
      { status: isManualCreate ? 201 : 200 }
    );
  } catch (error) {
    return authorizationResponse(error);
  }
}
