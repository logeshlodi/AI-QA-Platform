import { NextResponse, type NextRequest } from 'next/server';
import { openSession, SESSION_COOKIE } from '@/lib/session';

/**
 * First line of defence: no valid session, no page; the person is sent to sign in and brought back.
 * Pages check again themselves (requireViewer), including the role, so a matcher change cannot open one.
 */
export async function proxy(request: NextRequest) {
  if (await openSession(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  const login = new URL('/auth/login', request.url);
  login.searchParams.set('returnTo', request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  // Pages only. The JSON API answers 401 itself (a redirect to a sign-in page means nothing to fetch),
  // and sign-in, sign-out, the signed-out page, static files and the health check are public.
  matcher: ['/((?!api/|auth/|signed-out|no-access|healthz|_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
