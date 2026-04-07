import { requireAdminSession } from '@/lib/auth/session';
import UsersClient from './UsersClient';

export default async function UsersPage() {
  const session = await requireAdminSession();
  return <UsersClient currentUserId={session.user.id} />;
}
