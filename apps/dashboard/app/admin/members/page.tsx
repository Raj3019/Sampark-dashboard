import { requireAdminSession } from '@/lib/auth/session';
import MembersClient from './MembersClient';

export default async function MembersPage() {
  await requireAdminSession();
  return <MembersClient />;
}
