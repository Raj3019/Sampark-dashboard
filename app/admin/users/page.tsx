import { requireAdminSession } from '@/lib/auth/session';
import UsersClient from './UsersClient';

export default async function UsersPage() {
  await requireAdminSession();
  return <UsersClient />;
}
