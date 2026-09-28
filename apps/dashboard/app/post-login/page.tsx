import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getRoleHomePath, getServerSession } from '@/lib/auth/session';
import { getAuthPool } from '@/lib/auth/db';

export default async function PostLoginPage() {
  const session = await getServerSession();

  if (!session) {
    redirect('/login');
  }

  try {
    const headerList = await headers();
    const ipAddress = headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
    const userAgent = headerList.get('user-agent') ?? null;

    await getAuthPool().query(
      `INSERT INTO "activity_log"
         ("id", "userId", "userName", "userEmail", "userRole", "action", "ipAddress", "userAgent", "createdAt")
       VALUES ($1, $2, $3, $4, $5, 'login', $6, $7, NOW())`,
      [
        crypto.randomUUID(),
        session.user.id,
        session.user.name ?? null,
        session.user.email ?? null,
        session.user.role ?? null,
        ipAddress,
        userAgent,
      ]
    );
  } catch (err) {
    console.error('Failed to write activity log:', err);
  }

  redirect(getRoleHomePath(session.user.role ?? undefined));
}
