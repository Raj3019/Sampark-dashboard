import { requireAdminSession } from '@/lib/auth/session';
import AlertsClient from './AlertsClient';

export default async function AlertsPage() {
  await requireAdminSession();
  return <AlertsClient />;
}
