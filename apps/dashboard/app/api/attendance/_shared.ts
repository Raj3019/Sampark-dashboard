import { NextResponse } from 'next/server';
import { normalizeRole, requireApiSession, type NeonAuthSession } from '@/lib/auth/session';
import { SabhaType } from '@/lib/types';

export type SessionRow = {
  id: string;
  sabhaType: SabhaType;
  sessionDate: string;
  vakta: string | null;
  topic: string | null;
  presentCount: number;
  totalCount: number;
};

export type DbSessionRow = {
  id: string;
  sabha_type: string;
  session_date: string;
  vakta: string | null;
  topic: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  present_count: number;
  total_count: number;
};

export function mapSessionRow(row: DbSessionRow): SessionRow {
  return {
    id: row.id,
    sabhaType: row.sabha_type,
    sessionDate: row.session_date,
    vakta: row.vakta,
    topic: row.topic,
    presentCount: Number(row.present_count ?? 0),
    totalCount: Number(row.total_count ?? 0),
  };
}

export const SESSION_SELECT_SQL = `
  SELECT s."id", s."sabha_type", to_char(s."session_date", 'YYYY-MM-DD') AS "session_date",
         s."vakta", s."topic", s."created_by", s."created_at", s."updated_at",
         COUNT(ar."id") FILTER (WHERE ar."present" = true)::int AS "present_count",
         COUNT(ar."id")::int AS "total_count"
  FROM "sabha_session" s
  LEFT JOIN "attendance_record" ar ON ar."session_id" = s."id"
`;

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function requireStaffApiSession(): Promise<{
  session: NeonAuthSession | null;
  response: NextResponse | null;
}> {
  const { session, response } = await requireApiSession();
  if (response) return { session: null, response };

  if (normalizeRole(session.user.role) === 'kk') {
    return {
      session: null,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { session, response: null };
}
