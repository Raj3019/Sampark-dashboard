import { redirect } from 'next/navigation';
import { requireServerSession } from '@/lib/auth/session';
import KkHomeClient from './KkHomeClient';

export default async function KkHomePage() {
  const session = await requireServerSession();
  const role = (session.user as { role?: string }).role;

  if (role !== 'kk') {
    redirect('/');
  }

  return <KkHomeClient />;
}
