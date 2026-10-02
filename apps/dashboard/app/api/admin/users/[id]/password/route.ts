import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth/server';
import { getServerSession, requireAdminApiSession } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = await requireAdminApiSession();
  if (response) return response;

  const currentSession = await getServerSession();
  const { id } = await params;
  const body = await request.json() as { newPassword?: string };
  const newPassword = body.newPassword?.trim() ?? '';

  if (!newPassword) {
    return NextResponse.json({ error: 'New password is required' }, { status: 400 });
  }

  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  if (newPassword.length > 128) {
    return NextResponse.json({ error: 'Password must be at most 128 characters' }, { status: 400 });
  }

  const setPasswordResult = await getAuth().admin.setUserPassword({
    userId: id,
    newPassword,
  });

  if (setPasswordResult.error) {
    return NextResponse.json(
      { error: setPasswordResult.error.message ?? 'Failed to update password' },
      { status: 502 }
    );
  }

  if (currentSession?.user.id === id) {
    return NextResponse.json({
      success: true,
      message: 'Password updated. Please sign in again with the new password.',
      requiresReauth: true,
    });
  }

  return NextResponse.json({
    success: true,
    message: 'Password updated successfully',
    requiresReauth: false,
  });
}
