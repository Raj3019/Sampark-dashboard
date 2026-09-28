import { NextResponse } from 'next/server';
import { getUserAccessContext, requireApiSession } from '@/lib/auth/session';
import { buildPersonDetail, getPeopleUsers } from '@/lib/peopleSearch';
import { getSabhaData } from '@/lib/server/attendanceDataService';

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
    const type = url.searchParams.get('type') ?? '';
    const id = url.searchParams.get('id') ?? '';

    if (!type || !id) {
      return NextResponse.json({ error: 'Missing person type or id' }, { status: 400 });
    }

    const [{ data }, users] = await Promise.all([getSabhaData(), getPeopleUsers()]);
    const detail = buildPersonDetail(data, users, access, type, id);

    if (!detail) {
      return NextResponse.json({ error: 'Person not found or not available in your scope' }, { status: 404 });
    }

    return NextResponse.json(
      { detail },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `People details failed: ${message}` }, { status: 500 });
  }
}
