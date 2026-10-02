import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/auth/session';
import { getAuthPool } from '@/lib/auth/db';

export const runtime = 'nodejs';

type DbAlertRow = {
  id: string;
  source: string;
  kind: string;
  sabha_type: string;
  sampark_sabha: string | null;
  member_name: string | null;
  ref_date: string | null;
  message: string;
  detail: Record<string, unknown> | null;
  created_at: Date;
};

const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function mapAlertRow(row: DbAlertRow) {
  return {
    id: row.id,
    source: row.source,
    kind: row.kind,
    sabha_type: row.sabha_type,
    sampark_sabha: row.sampark_sabha,
    member_name: row.member_name,
    refDate: row.ref_date,
    message: row.message,
    detail: row.detail ?? null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

// GET /api/admin/alerts - open (undismissed) sync alerts, newest first
export async function GET() {
  const { response } = await requireAdminApiSession();
  if (response) return response;

  try {
    const result = await getAuthPool().query<DbAlertRow>(
      `SELECT "id", "source", "kind", "sabha_type", "sampark_sabha", "member_name",
              "ref_date"::text AS "ref_date", "message", "detail", "created_at"
       FROM "sync_alert"
       WHERE "dismissed" = false
       ORDER BY "created_at" DESC
       LIMIT 500`
    );
    return NextResponse.json(result.rows.map(mapAlertRow));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load alerts' },
      { status: 502 }
    );
  }
}

// DELETE /api/admin/alerts - mark alerts dismissed (manual resolution only)
export async function DELETE(request: NextRequest) {
  const { session, response } = await requireAdminApiSession();
  if (response || !session) return response;

  let body: { ids?: unknown };
  try {
    body = await request.json() as { ids?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const ids = Array.isArray(body.ids)
    ? Array.from(
        new Set(
          body.ids.filter(
            (id): id is string => typeof id === 'string' && UUID_PATTERN.test(id)
          )
        )
      )
    : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: 'Provide a non-empty ids array of alert ids' }, { status: 400 });
  }

  try {
    const result = await getAuthPool().query(
      `UPDATE "sync_alert"
       SET "dismissed" = true,
           "dismissed_at" = NOW(),
           "dismissed_by_user_id" = $2,
           "updated_at" = NOW()
       WHERE "id" = ANY($1::uuid[]) AND "dismissed" = false`,
      [ids, session.user.id]
    );
    return NextResponse.json({ success: true, dismissed: result.rowCount ?? 0 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to dismiss alerts' },
      { status: 502 }
    );
  }
}
