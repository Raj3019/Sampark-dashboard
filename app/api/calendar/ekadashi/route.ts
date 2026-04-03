import { NextResponse } from 'next/server';
import { getUpcomingEkadashi } from '@/lib/ekadashi';

export const maxDuration = 60;

export async function GET() {
  try {
    const data = await getUpcomingEkadashi();
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=43200',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch upcoming Ekadashi';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
