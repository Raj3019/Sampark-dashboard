import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiSession, getServerSession } from '@/lib/auth/session';
import { getAuthPool } from '@/lib/auth/db';

export const runtime = 'nodejs';

// PATCH /api/admin/users/[id] — update role
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, response } = await requireAdminApiSession();
  if (response) return response;

  const { id } = await params;
  const body = await request.json() as { role: string; assignedKK?: string };
  const { role } = body;
  const assignedKK = role === 'kk' ? body.assignedKK?.trim() : null;

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

  const pool = getAuthPool();
  const result = await pool.query(
    `UPDATE "user" SET "role" = $1, "assignedKK" = $2 WHERE "id" = $3 RETURNING "id"`,
    [role, assignedKK, id]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/admin/users/[id] — remove user
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

  const pool = getAuthPool();
  // Cascade deletes sessions + accounts
  const result = await pool.query(
    `DELETE FROM "user" WHERE "id" = $1 RETURNING "id"`,
    [id]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
