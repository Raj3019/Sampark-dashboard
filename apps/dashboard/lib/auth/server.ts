import { createNeonAuth, type NeonAuth } from '@neondatabase/auth/next/server';

// Created lazily — createNeonAuth throws at module load if the cookie secret
// is missing, which would fail `next build` (page data collection) on hosts
// without build-time secrets. First call is at request time instead.
let cached: NeonAuth | null = null;

export function getAuth(): NeonAuth {
  if (!cached) {
    cached = createNeonAuth({
      baseUrl: process.env.NEON_AUTH_BASE_URL ?? '',
      cookies: {
        secret: process.env.NEON_AUTH_COOKIE_SECRET ?? '',
      },
    });
  }
  return cached;
}
