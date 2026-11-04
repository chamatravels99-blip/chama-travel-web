import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Refreshes auth session cookies on each request and enforces
 * server-side authentication & role-based authorization for protected routes.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const requiredRoles =
    pathname === '/admin' || pathname.startsWith('/admin/')
      ? ['admin', 'super_admin', 'operator']
      : pathname === '/driver' || pathname.startsWith('/driver/')
        ? ['driver', 'admin', 'super_admin']
        : pathname === '/customer' || pathname.startsWith('/customer/')
          ? ['customer']
          : null;

  if (requiredRoles) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(url);
    }

    const { data: roles, error: roleError } = await supabase.rpc('get_my_roles');
    const hasRequiredRole =
      !roleError &&
      Array.isArray(roles) &&
      roles.some((role) => typeof role === 'string' && requiredRoles.includes(role));
    if (!hasRequiredRole) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('error', 'unauthorized');
      return NextResponse.redirect(url);
    }
  }

  return response;
}
