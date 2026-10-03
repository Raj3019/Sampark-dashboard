import { NextRequest, NextResponse } from 'next/server';
import { requireStaffApiSession, isValidIsoDate, mapSessionRow, SESSION_SELECT_SQL, type DbSessionRow } from '../../_shared';
import { getAuthPool } from '@/lib/auth/db';

export const runtime = 'nodejs';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// PATCH /api/attendance/sessions/[id] — update vakta/topic/session date
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = await requireStaffApiSession();
  if (response) return response;

  const { id } = await params;

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'Invalid session id' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const pool = getAuthPool();

  try {
    const existingResult = await pool.query<DbSessionRow>(
      `${SESSION_SELECT_SQL} WHERE s."id" = $1 GROUP BY s."id" LIMIT 1`,
      [id]
    );
    const existing = existingResult.rows[0];
    if (!existing) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const sets: string[] = [];
    const values: unknown[] = [];
    const push = (column: string, value: unknown) => {
      values.push(value);
      sets.push(`"${column}" = $${values.length}`);
    };

    if ('sessionDate' in body) {
      if (body.sessionDate !== null && typeof body.sessionDate !== 'string') {
        return NextResponse.json({ error: 'Invalid session date' }, { status: 400 });
      }
      const date = typeof body.sessionDate === 'string' && body.sessionDate.trim() ? body.sessionDate.trim() : null;
      if (date) {
        if (!isValidIsoDate(date)) {
          return NextResponse.json({ error: 'Invalid session date' }, { status: 400 });
        }
        if (date !== existing.session_date) {
          const duplicate = await pool.query(
            `SELECT 1 FROM "sabha_session" WHERE "sabha_type" = $1 AND "session_date" = $2 AND "id" <> $3 LIMIT 1`,
            [existing.sabha_type, date, id]
          );
          if (duplicate.rowCount && duplicate.rowCount > 0) {
            return NextResponse.json(
              { error: 'A session already exists for this sabha on that date' },
              { status: 409 }
            );
          }
        }
        push('session_date', date);
      }
    }

    if ('vakta' in body) {
      if (body.vakta !== null && typeof body.vakta !== 'string') {
        return NextResponse.json({ error: 'Invalid vakta' }, { status: 400 });
      }
      push('vakta', typeof body.vakta === 'string' && body.vakta.trim() ? body.vakta.trim() : null);
    }

    if ('topic' in body) {
      if (body.topic !== null && typeof body.topic !== 'string') {
        return NextResponse.json({ error: 'Invalid topic' }, { status: 400 });
      }
      push('topic', typeof body.topic === 'string' && body.topic.trim() ? body.topic.trim() : null);
    }

    if (values.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(id);
    const updated = await pool.query<{ id: string }>(
      `UPDATE "sabha_session" SET ${sets.join(', ')}, "updated_at" = NOW() WHERE "id" = $${values.length} RETURNING "id"`,
      values
    );

    if (!updated.rows[0]) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const result = await pool.query<DbSessionRow>(
      `${SESSION_SELECT_SQL} WHERE s."id" = $1 GROUP BY s."id" LIMIT 1`,
      [updated.rows[0].id]
    );

    if (!result.rows[0]) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, session: mapSessionRow(result.rows[0]) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update session' },
      { status: 502 }
    );
  }
}
