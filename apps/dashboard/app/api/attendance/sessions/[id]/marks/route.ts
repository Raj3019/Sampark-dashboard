import { NextRequest, NextResponse } from 'next/server';
import { requireStaffApiSession } from '../../../_shared';
import { getAuthPool } from '@/lib/auth/db';

export const runtime = 'nodejs';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const READ_ONLY_BODY = JSON.stringify({ error: 'Attendance is read-only; marks come from the Sampark sync' });

function readOnlyResponse() {
  return new NextResponse(READ_ONLY_BODY, {
    status: 405,
    headers: { 'content-type': 'application/json', 'allow': 'GET' },
  });
}

type MarkRow = {
  memberId: string;
  fullName: string;
  area: string | null;
  std: string | null;
  present: boolean;
  visited?: { sabhaType: string; sessionDate: string } | null;
  transferredOut?: boolean;
};

type DbMarkRow = {
  member_id: string;
  full_name: string;
  area: string | null;
  std: string | null;
  present: boolean;
  actual_sabha_type: string | null;
  actual_session_date: string | null;
  transferred_out: boolean;
  has_row: boolean;
};

async function loadSession(pool: ReturnType<typeof getAuthPool>, id: string) {
  const result = await pool.query<{ id: string; sabha_type: string; session_date: string; vakta: string | null; topic: string | null }>(
    `SELECT "id", "sabha_type", to_char("session_date", 'YYYY-MM-DD') AS "session_date", "vakta", "topic"
     FROM "sabha_session" WHERE "id" = $1 LIMIT 1`,
    [id]
  );
  return result.rows[0] ?? null;
}

// GET /api/attendance/sessions/[id]/marks — roster for the marking view
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = await requireStaffApiSession();
  if (response) return response;

  const { id } = await params;

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'Invalid session id' }, { status: 400 });
  }

  const pool = getAuthPool();

  try {
    const session = await loadSession(pool, id);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const result = await pool.query<DbMarkRow>(
      `SELECT m."id" AS "member_id", m."full_name", m."area", m."std",
              COALESCE(ar."present", false) AS "present",
              ar."actual_sabha_type",
              to_char(ar."actual_session_date", 'YYYY-MM-DD') AS "actual_session_date",
              m."transferred_out",
              (ar."id" IS NOT NULL) AS "has_row"
       FROM "member" m
       LEFT JOIN "attendance_record" ar ON ar."member_id" = m."id" AND ar."session_id" = $1
       WHERE m."sabha_type" = $2 AND (m."attending" = true OR ar."id" IS NOT NULL)
       ORDER BY m."full_name" ASC`,
      [id, session.sabha_type]
    );

    const marks: MarkRow[] = result.rows.map((row) => ({
      memberId: row.member_id,
      fullName: row.full_name,
      area: row.area,
      std: row.std,
      present: row.present,
      transferredOut: row.transferred_out ?? false,
      visited:
        row.present && row.actual_sabha_type && row.actual_session_date
          ? { sabhaType: row.actual_sabha_type, sessionDate: row.actual_session_date }
          : null,
    }));

    return NextResponse.json(marks);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load marks' },
      { status: 502 }
    );
  }
}

// PUT/POST disabled — attendance is one-way; marks come only from the Sampark sync
export async function PUT() {
  return readOnlyResponse();
}

export async function POST() {
  return readOnlyResponse();
}
