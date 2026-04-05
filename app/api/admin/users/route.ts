import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/auth/session';
import { getAuthPool } from '@/lib/auth/db';
import { auth } from '@/lib/auth';

export const runtime = 'nodejs';

type UserRow = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  role: string;
  assignedKK: string | null;
  createdAt: string;
};

// GET /api/admin/users — list all users
export async function GET() {
  const { response } = await requireAdminApiSession();
  if (response) return response;

  const pool = getAuthPool();
  const result = await pool.query<UserRow>(
    `SELECT "id", "name", "email", "username", "role", "assignedKK", "createdAt"
     FROM "user"
     ORDER BY "createdAt" DESC`
  );

  return NextResponse.json(result.rows);
}

// POST /api/admin/users — create a new user without switching the admin's session
export async function POST(request: NextRequest) {
  const { response } = await requireAdminApiSession();
  if (response) return response;

  // Capture the admin's current session token BEFORE anything else
  const adminSessionToken =
    request.cookies.get('better-auth.session_token')?.value ??
    request.cookies.get('__Secure-better-auth.session_token')?.value;
  const secureCookie = !!request.cookies.get('__Secure-better-auth.session_token')?.value;

  const body = await request.json() as {
    name: string;
    email: string;
    username: string;
    password: string;
    role: 'admin' | 'leader' | 'kk';
    assignedKK?: string;
  };

  const { name, email, username, password, role } = body;
  const assignedKK = role === 'kk' ? body.assignedKK?.trim() : null;

  if (!name || !email || !username || !password || !role) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
  }

  if (!['admin', 'leader', 'kk'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  if (role === 'kk' && !assignedKK) {
    return NextResponse.json({ error: 'Assigned KK is required for KK users' }, { status: 400 });
  }

  // signUpEmail creates the user + a session. The nextCookies() plugin will try to
  // set the new user's session cookie on this response. We fix that below.
  const signUpResult = await auth.api.signUpEmail({
    body: { name, email, password, username, displayUsername: username },
  });

  if (!signUpResult?.user) {
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }

  const pool = getAuthPool();

  // Delete all sessions created for the new user — admin should not be logged in as them
  await pool.query(`DELETE FROM "session" WHERE "userId" = $1`, [signUpResult.user.id]);

  // Set the correct role (signUpEmail uses defaultRole 'kk')
  await pool.query(`UPDATE "user" SET "role" = $1 WHERE "id" = $2`, [role, signUpResult.user.id]);
  await pool.query(
    `UPDATE "user" SET "assignedKK" = $1 WHERE "id" = $2`,
    [assignedKK, signUpResult.user.id]
  );

  // Build the response and restore the admin's original session cookie,
  // overwriting whatever nextCookies() may have set for the new user
  const res = NextResponse.json({ success: true, userId: signUpResult.user.id }, { status: 201 });

  if (adminSessionToken) {
    const cookieName = secureCookie
      ? '__Secure-better-auth.session_token'
      : 'better-auth.session_token';

    res.cookies.set(cookieName, adminSessionToken, {
      httpOnly: true,
      secure: secureCookie,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
  }

  return res;
}
