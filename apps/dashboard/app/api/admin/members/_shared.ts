import { getAuthPool } from '@/lib/auth/db';
import { SabhaType } from '@/lib/types';

export type MemberRow = {
  id: string;
  fullName: string;
  phoneNumber: string | null;
  dateOfBirth: string | null;
  area: string | null;
  std: string | null;
  sabhaType: SabhaType;
  followUpMemberId: string | null;
  followUpKk: string | null;
  isKk: boolean;
  attending: boolean;
  superActive: boolean;
  notes: string | null;
  attendanceCount: number;
  transferredOut: boolean;
  transferredOutOn: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DbMemberRow = {
  id: string;
  full_name: string;
  phone_number: string | null;
  date_of_birth: string | null;
  area: string | null;
  std: string | null;
  sabha_type: string;
  follow_up_member_id: string | null;
  follow_up_kk_name: string | null;
  is_kk: boolean;
  attending: boolean;
  super_active: boolean;
  notes: string | null;
  attendance_count: number;
  transferred_out: boolean;
  transferred_out_on: string | null;
  created_at: string;
  updated_at: string;
};

export function mapMemberRow(row: DbMemberRow): MemberRow {
  return {
    id: row.id,
    fullName: row.full_name,
    phoneNumber: row.phone_number,
    dateOfBirth: row.date_of_birth,
    area: row.area,
    std: row.std,
    sabhaType: row.sabha_type,
    followUpMemberId: row.follow_up_member_id,
    followUpKk: row.follow_up_kk_name,
    isKk: row.is_kk,
    attending: row.attending,
    superActive: row.super_active,
    notes: row.notes,
    attendanceCount: Number(row.attendance_count ?? 0),
    transferredOut: row.transferred_out ?? false,
    transferredOutOn: row.transferred_out_on,
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export const MEMBER_SELECT_SQL = `
  SELECT m."id", m."full_name", m."phone_number", to_char(m."date_of_birth", 'YYYY-MM-DD') AS "date_of_birth",
         m."area", m."std", m."sabha_type", m."follow_up_member_id", fu."full_name" AS "follow_up_kk_name",
         m."is_kk", m."attending", m."super_active", m."notes",
         (SELECT COUNT(*) FROM "attendance_record" ar WHERE ar."member_id" = m."id" AND ar."present" = true)::int AS "attendance_count",
         m."transferred_out", to_char(m."transferred_out_on", 'YYYY-MM-DD') AS "transferred_out_on",
         m."created_at", m."updated_at"
  FROM "member" m
  LEFT JOIN "member" fu ON fu."id" = m."follow_up_member_id"
`;

export function isUniquenessViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23505';
}

export async function fetchMemberById(pool: ReturnType<typeof getAuthPool>, id: string): Promise<MemberRow | null> {
  const result = await pool.query<DbMemberRow>(`${MEMBER_SELECT_SQL} WHERE m."id" = $1 LIMIT 1`, [id]);
  const row = result.rows[0];
  return row ? mapMemberRow(row) : null;
}
