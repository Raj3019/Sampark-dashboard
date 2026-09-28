import { NextRequest, NextResponse } from 'next/server';
import { authorizeAgentRequest } from '@/lib/agentAuth';
import { getAgentJobResult } from '@/lib/agentJobResult';

export const dynamic = 'force-dynamic';

function json(body: object, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const authorization = authorizeAgentRequest(request);
  if (!authorization.ok) {
    return json({ error: authorization.error }, authorization.status);
  }

  const result = getAgentJobResult(params.jobId);
  if (!result) {
    return json({ error: 'Job not found' }, 404);
  }

  return json(result, 200);
}
