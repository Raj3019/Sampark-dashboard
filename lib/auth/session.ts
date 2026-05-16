import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAuthPool } from '@/lib/auth/db';
import { isSessionWithinMaxAge } from '@/lib/auth/session-policy';

export type AppRole = 'admin' | 'leader' | 'kk';

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

export async function getServerSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!isSessionWithinMaxAge(session)) {
    return null;
  }

  return session;
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

  if ((session.user as { role?: string }).role !== 'admin') {
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

  if ((session.user as { role?: string }).role !== 'admin') {
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
    `SELECT "id", "role", "assignedKK", "name" FROM "user" WHERE "id" = $1 LIMIT 1`,
    [userId]
  );

  const user = result.rows[0];
  if (!user) return null;

  const role: AppRole = user.role === 'admin' || user.role === 'leader' || user.role === 'kk'
    ? user.role
    : 'kk';

  return {
    userId: user.id,
    role,
    assignedKK: user.assignedKK?.trim() ? user.assignedKK.trim() : null,
    name: user.name,
  };
}
