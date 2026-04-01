import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/session';
import { getSabhaData } from '@/lib/server/sabhaDataService';

export async function GET() {
  const { response } = await requireApiSession();

  if (response) {
    return response;
  }

  try {
    const { data, cache } = await getSabhaData();

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        'X-Cache': cache,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to fetch sheet data: ${message}` }, { status: 500 });
  }
}
