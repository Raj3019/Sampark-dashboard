import { timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';

export type AgentAuthorization =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string };

function secretsMatch(received: string, expected: string): boolean {
  const receivedBuffer = Buffer.from(received, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

export function authorizeAgentRequest(request: NextRequest): AgentAuthorization {
  const expected = process.env.AGENT_API_SECRET?.trim();
  if (!expected) {
    return {
      ok: false,
      status: 503,
      error: 'Agent API is not configured',
    };
  }

  const authorization = request.headers.get('authorization') ?? '';
  const prefix = 'Bearer ';
  const received = authorization.startsWith(prefix)
    ? authorization.slice(prefix.length).trim()
    : '';

  if (!received || !secretsMatch(received, expected)) {
    return {
      ok: false,
      status: 401,
      error: 'Unauthorized',
    };
  }

  return { ok: true };
}
