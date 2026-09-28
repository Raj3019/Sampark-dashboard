import { NextRequest, NextResponse } from 'next/server';
import { getAuthPool } from '@/lib/auth/db';
import { getUserAccessContext, requireApiSession } from '@/lib/auth/session';

export const runtime = 'nodejs';

type ReminderAction = 'acknowledge' | 'takeover' | 'resolve' | 'escalate';

function normalizeKkName(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

function canManageReminder(role: string, action: ReminderAction) {
  if (role === 'admin') return true;
  if (role === 'leader') return action !== 'acknowledge';
  return action === 'acknowledge' || action === 'escalate';
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, response } = await requireApiSession();
    if (response) return response;

    const access = await getUserAccessContext(session.user.id);
    if (!access) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({} as { action?: ReminderAction; reminderKey?: string }));
    const action = body.action;
    const reminderKey = body.reminderKey?.trim() || null;

    if (!action || !['acknowledge', 'takeover', 'resolve', 'escalate'].includes(action)) {
      return NextResponse.json({ error: 'Invalid reminder action' }, { status: 400 });
    }

    if (!canManageReminder(access.role, action)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const pool = getAuthPool();
    const current = await pool.query<{
      id: string;
      reminderKey: string;
      yuvakName: string;
      followUpKK: string;
      sabhaType: string;
      riskLevel: string;
      missedSabhaCount: number;
      missedSabhaDates: string[];
      status: string;
      requiresLeaderReview: boolean;
      escalatedByUserId: string | null;
      escalatedByName: string | null;
      escalatedAt: string | null;
            takenOverByUserId: string | null;
            takenOverByName: string | null;
            takenOverAt: string | null;
      createdAt: string;
      updatedAt: string;
    }>(
      `SELECT "id", "reminderKey", "yuvakName", "followUpKK", "sabhaType", "riskLevel",
              "missedSabhaCount", "missedSabhaDates", "status", "requiresLeaderReview",
              "escalatedByUserId", "escalatedByName", "escalatedAt",
              "takenOverByUserId", "takenOverByName", "takenOverAt",
              "createdAt", "updatedAt"
       FROM "reminder_item"
       WHERE "id" = $1
          OR ($2::text IS NOT NULL AND "reminderKey" = $2)
       LIMIT 1`,
      [id, reminderKey]
    );

    const reminder = current.rows[0];
    if (!reminder) {
      return NextResponse.json({ error: 'Reminder not found' }, { status: 404 });
    }

    const targetId = reminder.id;

    if (access.role === 'kk' && normalizeKkName(reminder.followUpKK) !== normalizeKkName(access.assignedKK)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const nextStatus = action === 'acknowledge'
      ? 'acknowledged'
      : action === 'resolve'
        ? 'resolved'
        : 'escalated';

    const escalatedUserId = action === 'escalate' ? access.userId : reminder.escalatedByUserId;
    const escalatedName = action === 'escalate' ? access.name : reminder.escalatedByName;
    const escalatedAt = action === 'escalate' ? new Date().toISOString() : reminder.escalatedAt;
    const takeoverUserId = action === 'takeover' ? access.userId : reminder.takenOverByUserId;
    const takeoverName = action === 'takeover' ? access.name : reminder.takenOverByName;
    const takeoverAt = action === 'takeover' ? new Date().toISOString() : reminder.takenOverAt;

    const updated = await pool.query(
      `UPDATE "reminder_item"
       SET "status" = $1,
           "escalatedByUserId" = $2,
           "escalatedByName" = $3,
           "escalatedAt" = $4,
           "takenOverByUserId" = $5,
           "takenOverByName" = $6,
           "takenOverAt" = $7,
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = $8
       RETURNING "id", "reminderKey", "yuvakName", "followUpKK", "sabhaType", "riskLevel",
                 "missedSabhaCount", "missedSabhaDates", "status", "requiresLeaderReview",
                 "escalatedByUserId", "escalatedByName", "escalatedAt",
                 "takenOverByUserId", "takenOverByName", "takenOverAt",
                 "createdAt", "updatedAt"`,
      [nextStatus, escalatedUserId, escalatedName, escalatedAt, takeoverUserId, takeoverName, takeoverAt, targetId]
    );

    if (updated.rowCount === 0 || !updated.rows[0]) {
      return NextResponse.json({ error: 'Failed to persist reminder update' }, { status: 500 });
    }

    return NextResponse.json({ reminder: updated.rows[0] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to update reminder: ${message}` }, { status: 500 });
  }
}