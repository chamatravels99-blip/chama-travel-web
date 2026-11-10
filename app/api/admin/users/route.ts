import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import {
  authorizationResponse,
  isSameOriginRequest,
  requireRoles,
  type AppRole,
} from '@/lib/server/authorization';

const USER_ROLES = new Set<AppRole>(['super_admin', 'admin', 'operator', 'driver', 'customer']);
const MUTABLE_ROLES = new Set<AppRole>(['admin', 'operator', 'driver', 'customer']);
const ACCOUNT_STATUSES = new Set(['active', 'inactive']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9\s()-]{7,30}$/;
const PAGE_SIZE = 50;

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return null;
  }
  return createAdminClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function readJson(request: Request) {
  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > 8192) {
    return { error: 'Request is too large.', status: 413 as const };
  }
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return { error: 'Enter valid user details.', status: 400 as const };
    }
    return { body: body as Record<string, unknown> };
  } catch {
    return { error: 'Enter valid user details.', status: 400 as const };
  }
}

export async function GET(request: Request) {
  try {
    const { user, roles } = await requireRoles(['admin', 'super_admin']);
    const url = new URL(request.url);
    const search = (url.searchParams.get('search') ?? '').trim();
    const roleInput = url.searchParams.get('role');
    const statusInput = url.searchParams.get('status');
    const pageInput = url.searchParams.get('page') ?? '1';
    const page = Number(pageInput);

    if (search.length > 100 ||
        (roleInput !== null && !USER_ROLES.has(roleInput as AppRole)) ||
        (statusInput !== null && !ACCOUNT_STATUSES.has(statusInput)) ||
        !/^\d+$/.test(pageInput) || !Number.isSafeInteger(page) || page < 1 || page > 100000) {
      return NextResponse.json({ success: false, error: 'User filters are invalid.' }, { status: 400 });
    }

    const adminClient = serviceClient();
    if (!adminClient) {
      console.error('User management is unavailable because server credentials are not configured.');
      return NextResponse.json({ success: false, error: 'User management is not configured.' }, { status: 503 });
    }

    const { data, error } = await adminClient.rpc('admin_list_users', {
      p_actor_user_id: user.id,
      p_search: search || null,
      p_role_code: roleInput,
      p_account_status: statusInput,
      p_limit: PAGE_SIZE,
      p_offset: (page - 1) * PAGE_SIZE,
    });
    if (error) {
      console.error('Admin user directory could not be loaded.', error.code);
      return NextResponse.json({ success: false, error: 'User data is temporarily unavailable.' }, { status: 503 });
    }

    const rows = Array.isArray(data) ? data : [];
    return NextResponse.json({
      success: true,
      data: rows.map((row) => ({
        id: row.user_id,
        email: row.email,
        full_name: row.full_name,
        phone: row.phone,
        account_status: row.account_status,
        created_at: row.created_at,
        roles: row.roles,
      })),
      total_count: typeof rows[0]?.total_count === 'number' ? rows[0].total_count : 0,
      page,
      page_size: PAGE_SIZE,
      actor_roles: roles,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return authorizationResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ success: false, error: 'Request origin is not allowed.' }, { status: 403 });
    }
    const { user } = await requireRoles(['super_admin']);
    const parsed = await readJson(request);
    if ('error' in parsed) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: parsed.status });
    }
    const body = parsed.body;
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const role = typeof body.role === 'string' ? body.role : '';

    if (!EMAIL_PATTERN.test(email) || email.length > 254 ||
        fullName.length < 2 || fullName.length > 120 ||
        (phone && !PHONE_PATTERN.test(phone)) ||
        password.length < 12 || password.length > 128 ||
        !['admin', 'operator'].includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Provide a valid email, name, optional phone, 12–128 character password, and Admin or Operator role.' },
        { status: 400 }
      );
    }

    const adminClient = serviceClient();
    if (!adminClient) {
      console.error('Staff provisioning is unavailable because server credentials are not configured.');
      return NextResponse.json({ success: false, error: 'Staff provisioning is not configured.' }, { status: 503 });
    }

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, phone: phone || null },
      app_metadata: {
        chama_staff_role: role,
        chama_staff_actor: user.id,
      },
    });
    if (createError || !created.user) {
      console.error('Staff Auth account creation failed.', createError?.code);
      const duplicate = createError?.code === 'user_already_exists' || createError?.code === 'email_exists';
      const status = duplicate
        ? 409
        : createError && typeof createError.status === 'number' && createError.status < 500
          ? 400
          : 503;
      return NextResponse.json(
        {
          success: false,
          error: duplicate
            ? 'The email already belongs to an account. Search for it and use role management instead.'
            : 'The account could not be provisioned. If the problem persists, contact support.',
        },
        { status }
      );
    }

    return NextResponse.json({ success: true, message: `${role === 'admin' ? 'Admin' : 'Operator'} account created.` }, { status: 201 });
  } catch (error) {
    return authorizationResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ success: false, error: 'Request origin is not allowed.' }, { status: 403 });
    }
    const { user, roles } = await requireRoles(['admin', 'super_admin']);
    const parsed = await readJson(request);
    if ('error' in parsed) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: parsed.status });
    }
    const body = parsed.body;
    const userId = typeof body.user_id === 'string' ? body.user_id : '';
    const action = typeof body.action === 'string' ? body.action : '';
    if (!UUID_PATTERN.test(userId)) {
      return NextResponse.json({ success: false, error: 'Target user is invalid.' }, { status: 400 });
    }

    const adminClient = serviceClient();
    if (!adminClient) {
      console.error('User management is unavailable because server credentials are not configured.');
      return NextResponse.json({ success: false, error: 'User management is not configured.' }, { status: 503 });
    }

    let error;
    if (action === 'change_role') {
      const role = typeof body.role === 'string' ? body.role : '';
      if (!MUTABLE_ROLES.has(role as AppRole)) {
        return NextResponse.json({ success: false, error: 'The requested role cannot be assigned.' }, { status: 400 });
      }
      if (role === 'admin' || role === 'operator') {
        if (!roles.includes('super_admin')) {
          return NextResponse.json({ success: false, error: 'Only a Super Admin can manage privileged staff roles.' }, { status: 403 });
        }
      }
      ({ error } = await adminClient.rpc('admin_change_user_role', {
        p_user_id: userId,
        p_role_code: role,
        p_actor_user_id: user.id,
      }));
    } else if (action === 'set_status') {
      const accountStatus = typeof body.account_status === 'string' ? body.account_status : '';
      if (!ACCOUNT_STATUSES.has(accountStatus)) {
        return NextResponse.json({ success: false, error: 'Account status is invalid.' }, { status: 400 });
      }
      ({ error } = await adminClient.rpc('admin_set_user_status', {
        p_user_id: userId,
        p_account_status: accountStatus,
        p_actor_user_id: user.id,
      }));
    } else {
      return NextResponse.json({ success: false, error: 'Unsupported user operation.' }, { status: 400 });
    }

    if (error) {
      console.error('Admin user update failed.', error.code);
      return NextResponse.json(
        { success: false, error: 'The user could not be updated. Check role permissions and account status.' },
        { status: error.code === 'P0001' ? 403 : 409 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return authorizationResponse(error);
  }
}
