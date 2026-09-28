import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { ParsedSheetData, ReminderItem, ReminderSummary, Yuvak } from './types';
import { getPastDates } from './analytics';
import { UserAccessContext } from './auth/session';

function normalizeKkName(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

function createReminderKey(yuvak: Yuvak) {
  return [yuvak.sabhaType, yuvak.followUpKK, yuvak.name]
    .map((part) => part.trim().toLowerCase())
    .join('::');
}

function dedupeReminderItems(items: ReminderItem[]) {
  const uniqueItems = new Map<string, ReminderItem>();

  for (const item of items) {
    if (!uniqueItems.has(item.reminderKey)) {
      uniqueItems.set(item.reminderKey, item);
    }
  }

  return Array.from(uniqueItems.values());
}

function determineReminderRisk(sortedDates: string[], yuvak: Yuvak) {
  const last2 = sortedDates.slice(-2);
  const last4 = sortedDates.slice(-4);

  const missedLast4 = last4.length === 4 && last4.every((date) => !yuvak.dateAttendance[date]);
  if (missedLast4) {
    return {
      riskLevel: 'high' as const,
      missedSabhaCount: 4,
      missedSabhaDates: last4,
    };
  }

  const missedLast2 = last2.length === 2 && last2.every((date) => !yuvak.dateAttendance[date]);
  if (missedLast2) {
    return {
      riskLevel: 'moderate' as const,
      missedSabhaCount: 2,
      missedSabhaDates: last2,
    };
  }

  return null;
}

export function buildReminderItems(data: ParsedSheetData): ReminderItem[] {
  const sortedDates = getPastDates(data.dates);
  const now = new Date().toISOString();

  const generatedItems = data.yuvaks.flatMap((yuvak) => {
    const reminderRisk = determineReminderRisk(sortedDates, yuvak);
    if (!reminderRisk) return [];

    const followUpKK = yuvak.followUpKK.trim();

    return [{
      id: randomUUID(),
      reminderKey: createReminderKey(yuvak),
      yuvakName: yuvak.name.trim(),
      phoneNumber: yuvak.phoneNumber.trim(),
      followUpKK: followUpKK || 'Unassigned',
      sabhaType: yuvak.sabhaType,
      riskLevel: reminderRisk.riskLevel,
      missedSabhaCount: reminderRisk.missedSabhaCount,
      missedSabhaDates: reminderRisk.missedSabhaDates,
      status: 'pending' as const,
      requiresLeaderReview: reminderRisk.riskLevel === 'high' || reminderRisk.riskLevel === 'moderate',
      escalatedByUserId: null,
      escalatedByName: null,
      escalatedAt: null,
      takenOverByUserId: null,
      takenOverByName: null,
      takenOverAt: null,
      createdAt: now,
      updatedAt: now,
    } satisfies ReminderItem];
  });

  return dedupeReminderItems(generatedItems)
    .sort((a, b) => {
      if (a.riskLevel !== b.riskLevel) return a.riskLevel === 'high' ? -1 : 1;
      if (a.missedSabhaCount !== b.missedSabhaCount) return b.missedSabhaCount - a.missedSabhaCount;
      return a.yuvakName.localeCompare(b.yuvakName);
    });
}

export function filterReminderItemsForAccess(items: ReminderItem[], access: UserAccessContext) {
  if (access.role !== 'kk') return items;
  if (!access.assignedKK) return [];

  return items.filter((item) => normalizeKkName(item.followUpKK) === normalizeKkName(access.assignedKK));
}

export function buildReminderSummary(items: ReminderItem[]): ReminderSummary {
  return items.reduce<ReminderSummary>((summary, item) => {
    summary.total += 1;
    summary[item.riskLevel] += 1;
    summary[item.status] += 1;
    return summary;
  }, {
    total: 0,
    moderate: 0,
    high: 0,
    pending: 0,
    acknowledged: 0,
    escalated: 0,
    resolved: 0,
  });
}

export async function syncReminderItems(pool: Pool, items: ReminderItem[]) {
  if (items.length === 0) return;

  const columnsPerRow = 19;
  const values: unknown[] = [];

  const tuples = items.map((item, index) => {
    const base = index * columnsPerRow;
    values.push(
      item.id,
      item.reminderKey,
      item.yuvakName,
      item.phoneNumber,
      item.followUpKK,
      item.sabhaType,
      item.riskLevel,
      item.missedSabhaCount,
      item.missedSabhaDates,
      item.status,
      item.requiresLeaderReview,
      item.escalatedByUserId,
      item.escalatedByName,
      item.escalatedAt,
      item.takenOverByUserId,
      item.takenOverByName,
      item.takenOverAt,
      item.createdAt,
      item.updatedAt
    );

    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13}, $${base + 14}, $${base + 15}, $${base + 16}, $${base + 17}, $${base + 18}, $${base + 19})`;
  });

  await pool.query(
    `INSERT INTO "reminder_item" (
       "id",
       "reminderKey",
       "yuvakName",
       "phoneNumber",
       "followUpKK",
       "sabhaType",
       "riskLevel",
       "missedSabhaCount",
       "missedSabhaDates",
       "status",
       "requiresLeaderReview",
      "escalatedByUserId",
      "escalatedByName",
      "escalatedAt",
       "takenOverByUserId",
       "takenOverByName",
       "takenOverAt",
       "createdAt",
       "updatedAt"
     ) VALUES ${tuples.join(', ')}
     ON CONFLICT ("reminderKey") DO UPDATE SET
       "yuvakName" = EXCLUDED."yuvakName",
       "phoneNumber" = EXCLUDED."phoneNumber",
       "followUpKK" = EXCLUDED."followUpKK",
       "sabhaType" = EXCLUDED."sabhaType",
       "riskLevel" = EXCLUDED."riskLevel",
       "missedSabhaCount" = EXCLUDED."missedSabhaCount",
       "missedSabhaDates" = EXCLUDED."missedSabhaDates",
       "status" = "reminder_item"."status",
       "requiresLeaderReview" = EXCLUDED."requiresLeaderReview",
       "updatedAt" = EXCLUDED."updatedAt"`,
    values
  );
}

export async function loadReminderItems(pool: Pool, reminderKeys: string[]) {
  if (reminderKeys.length === 0) return [] as ReminderItem[];

  const result = await pool.query<ReminderItem>(
    `SELECT "id",
            "reminderKey",
            "yuvakName",
            "phoneNumber",
            "followUpKK",
            "sabhaType",
            "riskLevel",
            "missedSabhaCount",
            "missedSabhaDates",
            "status",
            "requiresLeaderReview",
              "escalatedByUserId",
              "escalatedByName",
              "escalatedAt",
                 "takenOverByUserId",
                 "takenOverByName",
                 "takenOverAt",
            "createdAt",
            "updatedAt"
     FROM "reminder_item"
     WHERE "reminderKey" = ANY($1::text[])
     ORDER BY CASE WHEN "riskLevel" = 'high' THEN 0 ELSE 1 END,
              "missedSabhaCount" DESC,
              "yuvakName" ASC`,
    [reminderKeys]
  );

  return result.rows;
}
