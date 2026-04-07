import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
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

  const authContext = await auth.$context;
  const minPasswordLength = authContext.password.config.minPasswordLength;
  const maxPasswordLength = authContext.password.config.maxPasswordLength;

  if (newPassword.length < minPasswordLength) {
    return NextResponse.json(
      { error: `Password must be at least ${minPasswordLength} characters` },
      { status: 400 }
    );
  }

  if (newPassword.length > maxPasswordLength) {
    return NextResponse.json(
      { error: `Password must be at most ${maxPasswordLength} characters` },
      { status: 400 }
    );
  }

  const userWithAccounts = await authContext.adapter.findOne<{
    id: string;
    account?: Array<{ providerId: string }>;
  }>({
    model: 'user',
    where: [{ field: 'id', value: id }],
    join: { account: true },
  });

  if (!userWithAccounts) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const hashedPassword = await authContext.password.hash(newPassword);
  const hasCredentialAccount = (userWithAccounts.account ?? []).some(
    (account) => account.providerId === 'credential'
  );

  if (hasCredentialAccount) {
    await authContext.internalAdapter.updatePassword(id, hashedPassword);
  } else {
    await authContext.internalAdapter.createAccount({
      userId: id,
      providerId: 'credential',
      accountId: id,
      password: hashedPassword,
    });
  }

  await authContext.internalAdapter.deleteSessions(id);

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
