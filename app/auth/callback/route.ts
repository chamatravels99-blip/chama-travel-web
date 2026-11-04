import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const requestedNext = request.nextUrl.searchParams.get('next') ?? '/customer/dashboard';
  const parsedNext = new URL(requestedNext, request.url);
  const nextPath = requestedNext.startsWith('/') &&
      !requestedNext.startsWith('//') &&
      !requestedNext.includes('\\') &&
      parsedNext.origin === request.nextUrl.origin
    ? `${parsedNext.pathname}${parsedNext.search}${parsedNext.hash}`
    : '/customer/dashboard';
  if (!code) {
    return NextResponse.redirect(new URL('/login?error=confirmation', request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error('Auth callback exchange failed.', error.code);
    return NextResponse.redirect(new URL('/login?error=confirmation', request.url));
  }
  return NextResponse.redirect(new URL(nextPath, request.url));
}
