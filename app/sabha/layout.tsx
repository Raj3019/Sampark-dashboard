import { redirect } from 'next/navigation';
import { requireServerSession } from '@/lib/auth/session';

export default async function SabhaLayout({ children }: { children: React.ReactNode }) {
  const session = await requireServerSession();
  const role = (session.user as { role?: string }).role;

  if (role === 'kk') {
    redirect('/kk-home');
  }

  return <>{children}</>;
}
