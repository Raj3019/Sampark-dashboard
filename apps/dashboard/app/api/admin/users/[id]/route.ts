import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/server';
import { getServerSession, requireAdminApiSession } from '@/lib/auth/session';
import { getAuthPool } from '@/lib/auth/db';

export const runtime = 'nodejs';

// PATCH /api/admin/users/[id] — update role (Neon Auth) + KK assignment (app DB)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, response } = await requireAdminApiSession();
  if (response) return response;

  const { id } = await params;
  const body = await request.json() as { role: string; assignedKK?: string; phone?: string };
  const { role } = body;
  const assignedKK = role === 'kk' ? body.assignedKK?.trim() : null;
  const phone = body.phone?.trim() ?? null;

  if (!['admin', 'leader', 'kk'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  if (role === 'kk' && !assignedKK) {
    return NextResponse.json({ error: 'Assigned KK is required for KK users' }, { status: 400 });
  }

  if (session.user.id === id && role !== 'admin') {
    return NextResponse.json(
      { error: 'You cannot change your own admin role from this page' },
      { status: 400 }
    );
  }

  const setRoleResult = await auth.admin.setRole({
    body: { userId: id, role },
  });

  if (setRoleResult.error) {
    return NextResponse.json(
      { error: setRoleResult.error.message ?? 'Failed to update role' },
      { status: 502 }
    );
  }

  const result = await getAuthPool().query(
    `INSERT INTO "user_kk_assignment" ("id", "assigned_kk", "phone", "updated_at")
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT ("id") DO UPDATE SET "assigned_kk" = EXCLUDED."assigned_kk", "phone" = EXCLUDED."phone", "updated_at" = NOW()
     RETURNING "id"`,
    [id, assignedKK, phone]
  );

  if (result.rowCount === 0 && setRoleResult.error) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/admin/users/[id] — remove user via Neon Auth Admin API
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = await requireAdminApiSession();
  if (response) return response;

  const { id } = await params;

  // Prevent admin from deleting themselves
  const currentSession = await getServerSession();
  if (currentSession?.user.id === id) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
  }

  const removeResult = await auth.admin.removeUser({
    body: { userId: id },
  });

  if (removeResult.error) {
    return NextResponse.json(
      { error: removeResult.error.message ?? 'Failed to delete user' },
      { status: 502 }
    );
  }

  // Clean up app-side rows (no FK into neon_auth is possible)
  await getAuthPool().query(`DELETE FROM "user_kk_assignment" WHERE "id" = $1`, [id]);

  return NextResponse.json({ success: true });
}
