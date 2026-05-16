import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { admin, username } from 'better-auth/plugins';
import { getAuthDb, getAuthPool } from '@/lib/auth/db';
import { AUTH_SESSION_MAX_AGE_SECONDS, AUTH_SESSION_UPDATE_AGE_SECONDS } from '@/lib/auth/session-policy';

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
  session: {
    expiresIn: AUTH_SESSION_MAX_AGE_SECONDS,
    updateAge: AUTH_SESSION_UPDATE_AGE_SECONDS,
    disableSessionRefresh: true,
  },
  rateLimit: {
    enabled: false,
  },
  plugins: [
    nextCookies(),
    username(),
    admin({
      defaultRole: 'kk',
      adminRoles: ['admin'],
    }),
  ],
  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          try {
            const pool = getAuthPool();
            const userRes = await pool.query<{ name: string; email: string; role: string }>(
              `SELECT "name", "email", "role" FROM "user" WHERE "id" = $1`,
              [session.userId]
            );
            const user = userRes.rows[0];
            if (!user) return;

            await pool.query(
              `INSERT INTO "activity_log"
                 ("id", "userId", "userName", "userEmail", "userRole", "action", "ipAddress", "userAgent", "createdAt")
               VALUES ($1, $2, $3, $4, $5, 'login', $6, $7, NOW())`,
              [
                crypto.randomUUID(),
                session.userId,
                user.name,
                user.email,
                user.role,
                session.ipAddress ?? null,
                session.userAgent ?? null,
              ]
            );
          } catch (err) {
            console.error('Failed to write activity log:', err);
          }
        },
      },
    },
  },
});
