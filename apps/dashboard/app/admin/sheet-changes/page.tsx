import { requireAdminSession } from '@/lib/auth/session';
import SheetChangesClient from './SheetChangesClient';

export default async function SheetChangesPage() {
  await requireAdminSession();
  return <SheetChangesClient />;
}
