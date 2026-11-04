import { createClient } from '@/utils/supabase/server';

export type AppRole = 'super_admin' | 'admin' | 'operator' | 'driver' | 'customer';
const APP_ROLES = new Set<AppRole>(['super_admin', 'admin', 'operator', 'driver', 'customer']);

export class AuthorizationError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

export async function getAuthenticatedContext() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new AuthorizationError('Sign in to continue.', 401);
  }

  const { data: roles, error: roleError } = await supabase.rpc('get_my_roles');
  if (roleError) {
    console.error('Unable to resolve the authenticated account role.', roleError.code);
    throw new AuthorizationError('Account access could not be verified.', 503);
  }

  const parsedRoles = Array.isArray(roles)
    ? roles.filter((role): role is AppRole => typeof role === 'string' && APP_ROLES.has(role as AppRole))
    : [];
  return {
    supabase,
    user,
    roles: parsedRoles,
  };
}

export async function requireRoles(allowedRoles: AppRole[]) {
  const context = await getAuthenticatedContext();
  if (!context.roles.some((role) => allowedRoles.includes(role))) {
    throw new AuthorizationError('You do not have permission to perform this action.', 403);
  }
  return context;
}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get('origin');
  return Boolean(origin) && origin === new URL(request.url).origin;
}

export function authorizationResponse(error: unknown) {
  if (error instanceof AuthorizationError) {
    return Response.json({ success: false, error: error.message }, { status: error.status });
  }
  console.error('Protected request failed.');
  return Response.json(
    { success: false, error: 'The request could not be completed.' },
    { status: 500 }
  );
}
