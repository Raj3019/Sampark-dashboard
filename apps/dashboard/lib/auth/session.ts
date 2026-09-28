import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/server';
import { getAuthPool } from '@/lib/auth/db';

export type AppRole = 'admin' | 'leader' | 'kk';

export type NeonAuthUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
} & Record<string, unknown>;

export type NeonAuthSession = {
  session: Record<string, unknown> | null;
  user: NeonAuthUser | null;
};

export type UserAccessContext = {
  userId: string;
  role: AppRole;
  assignedKK: string | null;
  name: string;
};

export function getRoleHomePath(role: string | undefined) {
  if (role === 'kk') return '/kk-home';
  if (role === 'leader') return '/sabha/kishor';
  return '/';
}

export function normalizeRole(role: string | null | undefined): AppRole {
  return role === 'admin' || role === 'leader' ? role : 'kk';
}

export async function getServerSession(): Promise<{
  session: Record<string, unknown>;
  user: NeonAuthUser;
} | null> {
  const { data } = await auth.getSession();

  if (!data?.session || !data?.user) {
    return null;
  }

  return data as { session: Record<string, unknown>; user: NeonAuthUser };
}

export async function requireServerSession() {
  const session = await getServerSession();

  if (!session) {
    redirect('/login');
  }

  return session;
}

export async function requireAdminSession() {
  const session = await getServerSession();

  if (!session) {
    redirect('/login');
  }

  if (session.user.role !== 'admin') {
    redirect('/');
  }

  return session;
}

export async function requireApiSession() {
  const session = await getServerSession();

  if (!session) {
    return {
      session: null,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { session, response: null };
}

export async function requireAdminApiSession() {
  const session = await getServerSession();

  if (!session) {
    return {
      session: null,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  if (session.user.role !== 'admin') {
    return {
      session: null,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { session, response: null };
}

export async function getUserAccessContext(userId: string): Promise<UserAccessContext | null> {
  const pool = getAuthPool();
  const result = await pool.query<{
    id: string;
    role: string;
    assignedKK: string | null;
    name: string;
  }>(
    `SELECT u."id", u."role", a."assigned_kk" AS "assignedKK", u."name"
     FROM neon_auth."user" u
     LEFT JOIN "user_kk_assignment" a ON a."id" = u."id"
     WHERE u."id" = $1
     LIMIT 1`,
    [userId]
  );

  const user = result.rows[0];
  if (!user) return null;

  return {
    userId: user.id,
    role: normalizeRole(user.role),
    assignedKK: user.assignedKK?.trim() ? user.assignedKK.trim() : null,
    name: user.name,
  };
}
