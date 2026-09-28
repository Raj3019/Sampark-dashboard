import { NextResponse } from 'next/server';
import { getSabhaData } from '@/lib/server/attendanceDataService';
import { getUserAccessContext, requireApiSession } from '@/lib/auth/session';

export const maxDuration = 30;

function sameKkName(left: string | null | undefined, right: string | null | undefined) {
  return (left ?? '').trim().toLowerCase() === (right ?? '').trim().toLowerCase();
}

export async function GET(request: Request) {
  try {
    const { session, response } = await requireApiSession();
    if (response) return response;

    const access = await getUserAccessContext(session.user.id);
    if (!access) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, cache } = await getSabhaData();
    const requestUrl = new URL(request.url);
    const scope = requestUrl.searchParams.get('scope');
    const allowFullForKk = scope === 'full';

    const scopedData = access.role === 'kk'
      ? (allowFullForKk
          ? data
          : {
              ...data,
              yuvaks: access.assignedKK
                ? data.yuvaks.filter((y) => sameKkName(y.followUpKK, access.assignedKK))
                : [],
            })
      : data;

    return NextResponse.json(scopedData, {
      headers: {
        'Cache-Control': 'private, no-store',
        'X-Cache': cache,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to load sabha data: ${message}` }, { status: 500 });
  }
}
