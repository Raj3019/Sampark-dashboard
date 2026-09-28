import { redirect } from 'next/navigation';
import { requireServerSession } from '@/lib/auth/session';
import AttendanceClient from './AttendanceClient';

export default async function AttendancePage() {
  const session = await requireServerSession();
  const role = session.user.role;

  if (role === 'kk') {
    redirect('/kk-home');
  }

  return <AttendanceClient />;
}
