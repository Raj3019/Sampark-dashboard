import { NextResponse } from 'next/server';
import { getUserAccessContext, requireApiSession } from '@/lib/auth/session';
import { buildPeopleSearchResults, getPeopleUsers } from '@/lib/peopleSearch';
import { getSabhaData } from '@/lib/sabhaWorkbookService';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const { session, response } = await requireApiSession();
    if (response) return response;

    const access = await getUserAccessContext(session.user.id);
    if (!access) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const query = url.searchParams.get('q') ?? '';

    if (query.trim().length < 2) {
      return NextResponse.json({ results: [] });
    }

    const [{ data }, users] = await Promise.all([getSabhaData(), getPeopleUsers()]);
    const results = buildPeopleSearchResults(data, users, access, query);

    return NextResponse.json(
      { results },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `People search failed: ${message}` }, { status: 500 });
  }
}
