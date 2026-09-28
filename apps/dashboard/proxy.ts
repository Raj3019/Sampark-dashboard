import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { NEON_AUTH_SESSION_COOKIE_NAME } from '@neondatabase/auth/server';
import { auth } from '@/lib/auth/server';

function hasSessionCookie(request: NextRequest) {
  return request.cookies.has(NEON_AUTH_SESSION_COOKIE_NAME);
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isAuthApiRoute = pathname.startsWith('/api/auth');
  const isProtectedApiRoute = pathname.startsWith('/api/') && !isAuthApiRoute;
  const isLoginPage = pathname === '/login';

  if (isProtectedApiRoute) {
    if (!hasSessionCookie(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (isAuthApiRoute) {
    return NextResponse.next();
  }

  if (isLoginPage) {
    return NextResponse.next();
  }

  return auth.middleware({ loginUrl: '/login' })(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
