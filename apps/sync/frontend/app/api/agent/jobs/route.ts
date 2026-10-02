import { NextRequest, NextResponse } from 'next/server';
import { authorizeAgentRequest } from '@/lib/agentAuth';
import { startJob, type JobType } from '@/lib/jobRunner';

export const dynamic = 'force-dynamic';

function json(body: object, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: NextRequest) {
  const authorization = authorizeAgentRequest(request);
  if (!authorization.ok) {
    return json({ error: authorization.error }, authorization.status);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const jobType =
    typeof body === 'object' && body !== null && 'jobType' in body
      ? (body as { jobType?: unknown }).jobType
      : undefined;

  if (jobType !== 'kishor' && jobType !== 'yuvak' && jobType !== 'report') {
    return json({ error: 'jobType must be kishor, yuvak, or report' }, 400);
  }

  try {
    const validJobType = jobType as JobType;
    const jobId = startJob(validJobType, 'agent');
    return json({
      jobId,
      jobType: validJobType,
      status: 'running',
      statusUrl: `/api/agent/jobs/${jobId}`,
    }, 202);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: message }, 409);
  }
}
