import { redirect } from 'next/navigation';
import { getRoleHomePath, getServerSession } from '@/lib/auth/session';

export default async function PostLoginPage() {
  const session = await getServerSession();

  if (!session) {
    redirect('/login');
  }

  const role = (session.user as { role?: string }).role;
  redirect(getRoleHomePath(role));
}
