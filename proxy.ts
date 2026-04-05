import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE_NAMES = [
  'better-auth.session_token',
  '__Secure-better-auth.session_token',
];

function hasSessionCookie(request: NextRequest) {
  return SESSION_COOKIE_NAMES.some((cookieName) => request.cookies.has(cookieName));
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = hasSessionCookie(request);
  const isAuthApiRoute = pathname.startsWith('/api/auth');
  const isProtectedApiRoute = pathname.startsWith('/api/') && !isAuthApiRoute;
  const isLoginPage = pathname === '/login';

  if (isAuthApiRoute || isLoginPage) {
    return NextResponse.next();
  }

  if (isProtectedApiRoute && !hasSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasSession) {
    const loginUrl = new URL('/login', request.url);
    const nextPath = `${pathname}${search}`;

    if (nextPath !== '/login') {
      loginUrl.searchParams.set('next', nextPath);
    }

    return NextResponse.redirect(loginUrl);
  }

  if (pathname === '/') {
    return NextResponse.redirect(new URL('/sabha/kishor', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
