import { NextResponse } from 'next/server';
import { getAuthPool } from '@/lib/auth/db';
import { getUserAccessContext, requireApiSession } from '@/lib/auth/session';
import { buildReminderItems, buildReminderSummary, filterReminderItemsForAccess, loadReminderItems, syncReminderItems } from '@/lib/reminders';
import { getSabhaData } from '@/lib/sabhaWorkbookService';

export const runtime = 'nodejs';

function hasUsablePhoneNumber(value: string | null | undefined) {
  const normalized = (value ?? '').trim();
  if (!normalized) return false;
  if (normalized.toLowerCase().includes('nan') || normalized.toLowerCase().includes('undefined')) {
    return false;
  }

  return /\d{7,}/.test(normalized.replace(/[^\d]/g, ''));
}

export async function GET() {
  try {
    const { session, response } = await requireApiSession();
    if (response) return response;

    const access = await getUserAccessContext(session.user.id);
    if (!access) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data } = await getSabhaData();
    const generatedItems = filterReminderItemsForAccess(buildReminderItems(data), access);

    const pool = getAuthPool();
    try {
      await syncReminderItems(pool, generatedItems);
      const reminderItems = await loadReminderItems(pool, generatedItems.map((item) => item.reminderKey));
      const generatedByKey = new Map(generatedItems.map((item) => [item.reminderKey, item]));
      const hydratedReminderItems = reminderItems.map((item) => {
        const generated = generatedByKey.get(item.reminderKey);
        if (!generated) return item;

        return {
          ...item,
          phoneNumber: hasUsablePhoneNumber(item.phoneNumber) ? item.phoneNumber : generated.phoneNumber,
        };
      });

      return NextResponse.json({
        reminders: hydratedReminderItems,
        summary: buildReminderSummary(hydratedReminderItems),
        scope: {
          role: access.role,
          assignedKK: access.assignedKK,
        },
      }, {
        headers: {
          'Cache-Control': 'private, no-store',
        },
      });
    } catch (error) {
      console.error('Failed to sync reminder items, returning generated reminders instead.', error);
      return NextResponse.json({
        reminders: generatedItems,
        summary: buildReminderSummary(generatedItems),
        scope: {
          role: access.role,
          assignedKK: access.assignedKK,
        },
      }, {
        headers: {
          'Cache-Control': 'private, no-store',
        },
      });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to fetch reminders: ${message}` }, { status: 500 });
  }
}
