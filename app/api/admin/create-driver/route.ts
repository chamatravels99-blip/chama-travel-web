import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { authorizationResponse, isSameOriginRequest, requireRoles } from '@/lib/server/authorization';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9\s()-]{7,30}$/;

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ success: false, error: 'Request origin is not allowed.' }, { status: 403 });
    }
    const { user } = await requireRoles(['admin', 'super_admin']);
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
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';

    if (!EMAIL_PATTERN.test(email) || fullName.length < 2 || fullName.length > 120 ||
        (phone && !PHONE_PATTERN.test(phone))) {
      return NextResponse.json(
        { success: false, error: 'Provide a valid email, name, and optional phone.' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Driver record provisioning is unavailable because server credentials are not configured.');
      return NextResponse.json({ success: false, error: 'Driver record provisioning is not configured.' }, { status: 503 });
    }

    const adminClient = createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: `${crypto.randomUUID()}${crypto.randomUUID()}`,
      email_confirm: true,
      user_metadata: { full_name: fullName, phone: phone || null },
    });
    if (createError || !created.user) {
      console.error('Driver record identity creation failed.', createError?.code);
      return NextResponse.json(
        { success: false, error: 'The driver record could not be created. Check that the email is not already registered.' },
        { status: 400 }
      );
    }

    const { error: roleError } = await adminClient.rpc('admin_assign_driver_role', {
      p_user_id: created.user.id,
      p_actor_user_id: user.id,
    });
    if (roleError) {
      console.error('Driver record provisioning failed.', roleError.code);
      const { error: deactivateError } = await adminClient.rpc('admin_deactivate_profile', {
        p_user_id: created.user.id,
        p_actor_user_id: user.id,
      });
      if (deactivateError) {
        await adminClient.auth.admin.updateUserById(created.user.id, { ban_duration: '876000h' });
        console.error('Incomplete driver record could not be deactivated.', deactivateError.code);
      }
      return NextResponse.json(
        { success: false, error: 'The record was created but could not be provisioned. It has been disabled; contact support before retrying.' },
        { status: 503 }
      );
    }

    return NextResponse.json({ success: true, message: 'Driver record created. Drivers do not need an account password.' }, { status: 201 });
  } catch (error) {
    return authorizationResponse(error);
  }
}
