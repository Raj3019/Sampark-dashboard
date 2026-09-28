import { NextRequest, NextResponse } from 'next/server';
import { requireStaffApiSession, isValidIsoDate, mapSessionRow, SESSION_SELECT_SQL, type DbSessionRow } from '../_shared';
import { getAuthPool } from '@/lib/auth/db';
import { SABHA_TYPES } from '@/lib/sabha';
import { SabhaType } from '@/lib/types';

export const runtime = 'nodejs';

// GET /api/attendance/sessions?sabha=<type> — recent sessions with present/total counts
export async function GET(request: NextRequest) {
  const { response } = await requireStaffApiSession();
  if (response) return response;

  const sabha = request.nextUrl.searchParams.get('sabha')?.trim() ?? '';

  if (sabha && !SABHA_TYPES.includes(sabha as SabhaType)) {
    return NextResponse.json({ error: 'Invalid sabha type' }, { status: 400 });
  }

  try {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (sabha) {
      values.push(sabha);
      conditions.push(`s."sabha_type" = $${values.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await getAuthPool().query<DbSessionRow>(
      `${SESSION_SELECT_SQL} ${whereClause}
       GROUP BY s."id"
       ORDER BY s."session_date" DESC
       LIMIT 50`,
      values
    );

    return NextResponse.json(result.rows.map(mapSessionRow));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load sessions' },
      { status: 502 }
    );
  }
}

// POST /api/attendance/sessions — create a session (idempotent per sabha + date)
export async function POST(request: NextRequest) {
  const { session, response } = await requireStaffApiSession();
  if (response) return response;
  if (!session || !session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const sabhaType = typeof body.sabhaType === 'string' ? body.sabhaType.trim() : '';
  const sessionDate = typeof body.sessionDate === 'string' ? body.sessionDate.trim() : '';
  const vakta = typeof body.vakta === 'string' && body.vakta.trim() ? body.vakta.trim() : null;
  const topic = typeof body.topic === 'string' && body.topic.trim() ? body.topic.trim() : null;

  if (!sabhaType || !SABHA_TYPES.includes(sabhaType as SabhaType)) {
    return NextResponse.json({ error: 'Invalid sabha type' }, { status: 400 });
  }

  if (!sessionDate || !isValidIsoDate(sessionDate)) {
    return NextResponse.json({ error: 'Invalid session date' }, { status: 400 });
  }

  const pool = getAuthPool();

  try {
    const existing = await pool.query<DbSessionRow>(
      `${SESSION_SELECT_SQL} WHERE s."sabha_type" = $1 AND s."session_date" = $2 GROUP BY s."id" LIMIT 1`,
      [sabhaType, sessionDate]
    );

    if (existing.rows[0]) {
      return NextResponse.json({ success: true, existing: true, session: mapSessionRow(existing.rows[0]) });
    }

    const createdBy = session.user.name?.trim() || session.user.email?.trim() || 'Unknown';
    const result = await pool.query<DbSessionRow>(
      `WITH new_session AS (
         INSERT INTO "sabha_session" ("sabha_type", "session_date", "vakta", "topic", "created_by")
         VALUES ($1, $2, $3, $4, $5)
         RETURNING "id"
       )
       ${SESSION_SELECT_SQL}
       WHERE s."id" = (SELECT "id" FROM new_session)
       GROUP BY s."id"
       LIMIT 1`,
      [sabhaType, sessionDate, vakta, topic, createdBy]
    );

    return NextResponse.json(
      { success: true, existing: false, session: mapSessionRow(result.rows[0]) },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create session' },
      { status: 502 }
    );
  }
}
