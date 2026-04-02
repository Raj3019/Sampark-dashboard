import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/auth/session';
import { getAuthPool } from '@/lib/auth/db';

export const runtime = 'nodejs';

type ActivityRow = {
  id: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  userRole: string | null;
  action: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

export async function GET(request: NextRequest) {
  const { response } = await requireAdminApiSession();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 500);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);

  const pool = getAuthPool();
  const result = await pool.query<ActivityRow>(
    `SELECT "id", "userId", "userName", "userEmail", "userRole",
            "action", "ipAddress", "userAgent", "createdAt"
     FROM "activity_log"
     ORDER BY "createdAt" DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  const countRes = await pool.query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM "activity_log"`
  );

  return NextResponse.json({
    logs: result.rows,
    total: parseInt(countRes.rows[0].total, 10),
  });
}
