import { requireAdminSession } from '@/lib/auth/session';
import LogsClient from './LogsClient';

export default async function LogsPage() {
  await requireAdminSession();
  return <LogsClient />;
}
