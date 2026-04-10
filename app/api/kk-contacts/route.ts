import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/session';
import { getAuthPool } from '@/lib/auth/db';

type KkContactRow = {
  assignedKK: string | null;
  username: string | null;
};

export async function GET() {
  const { response } = await requireApiSession();
  if (response) return response;

  const pool = getAuthPool();
  const result = await pool.query<KkContactRow>(
    `SELECT "assignedKK", "username"
     FROM "user"
     WHERE "role" = 'kk'
       AND COALESCE(TRIM("assignedKK"), '') <> ''`
  );

  const contacts = result.rows.reduce<Record<string, string>>((acc, row) => {
    const kkName = row.assignedKK?.trim();
    const username = row.username?.trim();

    if (!kkName || !username || acc[kkName]) return acc;
    acc[kkName] = username;
    return acc;
  }, {});

  return NextResponse.json({ contacts });
}
