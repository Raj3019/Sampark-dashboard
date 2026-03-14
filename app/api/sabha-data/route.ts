import { NextResponse } from 'next/server';
import { getSabhaData } from '@/lib/server/sabhaDataService';

export async function GET() {
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
