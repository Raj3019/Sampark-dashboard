import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/session';
import { getAuthPool } from '@/lib/auth/db';

type KkContactRow = {
  assigned_kk: string | null;
  phone: string | null;
};

export async function GET() {
  const { response } = await requireApiSession();
  if (response) return response;

  const pool = getAuthPool();
  const result = await pool.query<KkContactRow>(
    `SELECT a."assigned_kk", a."phone"
     FROM "user_kk_assignment" a
     WHERE a."assigned_kk" IS NOT NULL
       AND COALESCE(TRIM(a."assigned_kk"), '') <> ''
       AND COALESCE(TRIM(a."phone"), '') <> ''`
  );

  const contacts = result.rows.reduce<Record<string, string>>((acc, row) => {
    const kkName = row.assigned_kk?.trim();
    const phone = row.phone?.trim();

    if (!kkName || !phone || acc[kkName]) return acc;
    acc[kkName] = phone;
    return acc;
  }, {});

  return NextResponse.json({ contacts });
}
