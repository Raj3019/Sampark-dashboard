import { NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/auth/session';
import { getSabhaData } from '@/lib/server/sabhaDataService';

export const runtime = 'nodejs';

// GET /api/admin/kk-names — list distinct follow-up KK names from current sheet data
export async function GET() {
  const { response } = await requireAdminApiSession();
  if (response) return response;

  const { data } = await getSabhaData();
  const kkNames = Array.from(
    new Set(
      data.yuvaks
        .map((y) => y.followUpKK?.trim())
        .filter((name): name is string => Boolean(name && name.length > 0))
    )
  ).sort((a, b) => a.localeCompare(b));

  return NextResponse.json({ kkNames });
}
