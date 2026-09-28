import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/auth/session';
import { getAuthPool } from '@/lib/auth/db';

export const runtime = 'nodejs';

type ChangeRow = {
  id: string;
  sabhaType: string;
  changeType: string;
  description: string;
  detectedAt: string;
};

export async function GET(request: NextRequest) {
  const { response } = await requireAdminApiSession();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '200', 10), 500);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);

  const pool = getAuthPool();
  const result = await pool.query<ChangeRow>(
    `SELECT "id", "sabhaType", "changeType", "description", "detectedAt"
     FROM "sheet_change_log"
     ORDER BY "detectedAt" DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  const countRes = await pool.query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM "sheet_change_log"`
  );

  return NextResponse.json({
    changes: result.rows,
    total: parseInt(countRes.rows[0].total, 10),
  });
}
