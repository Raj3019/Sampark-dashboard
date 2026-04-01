import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { username } from 'better-auth/plugins';
import { getAuthDb } from '@/lib/auth/db';

const baseURL = process.env.BETTER_AUTH_URL || 'http://localhost:3000';

export const auth = betterAuth({
  database: {
    db: getAuthDb(),
    type: 'postgres',
  },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL,
  basePath: '/api/auth',
  trustedOrigins: [baseURL],
  emailAndPassword: {
    enabled: true,
  },
  rateLimit: {
    enabled: false,
  },
  plugins: [
    nextCookies(),
    username(),
  ],
});
