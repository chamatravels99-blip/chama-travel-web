import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { requiredRolesForPath } from '@/utils/supabase/route-roles';

/**
 * Refreshes auth session cookies on each request and enforces
 * server-side authentication & role-based authorization for protected routes.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const pathname = request.nextUrl.pathname;
  const requiredRoles = requiredRolesForPath(pathname);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    if (requiredRoles) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('error', 'unauthorized');
      return NextResponse.redirect(url);
    }
    return response;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
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

  let user = null;
  try {
    const authResult = await supabase.auth.getUser();
    user = authResult.data?.user ?? null;
  } catch (authError) {
    console.error('Session refresh failed in proxy middleware.', authError);
    user = null;
  }

  if (requiredRoles) {
    response.headers.set('Cache-Control', 'private, no-store');

    const redirectWithSessionCookies = (url: URL) => {
      const redirectResponse = NextResponse.redirect(url);
      response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
      redirectResponse.headers.set('Cache-Control', 'private, no-store');
      return redirectResponse;
    };

    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirectTo', `${pathname}${request.nextUrl.search}`);
      return redirectWithSessionCookies(url);
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
      return redirectWithSessionCookies(url);
    }
  }

  return response;
}
