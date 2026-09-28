import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/auth/session';
import { getAuthPool } from '@/lib/auth/db';
import { SABHA_TYPES } from '@/lib/sabha';
import { SabhaType } from '@/lib/types';
import {
  fetchMemberById,
  isValidIsoDate,
  isUniquenessViolation,
  mapMemberRow,
  MEMBER_SELECT_SQL,
  type DbMemberRow,
} from './_shared';

export const runtime = 'nodejs';

// GET /api/admin/members — list members with follow-up KK name and attendance count
export async function GET(request: NextRequest) {
  const { response } = await requireAdminApiSession();
  if (response) return response;

  const sabha = request.nextUrl.searchParams.get('sabha')?.trim() ?? '';
  const search = request.nextUrl.searchParams.get('search')?.trim() ?? '';

  if (sabha && !SABHA_TYPES.includes(sabha as SabhaType)) {
    return NextResponse.json({ error: 'Invalid sabha type' }, { status: 400 });
  }

  try {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (sabha) {
      values.push(sabha);
      conditions.push(`m."sabha_type" = $${values.length}`);
    }

    if (search) {
      values.push(`%${search}%`);
      const idx = values.length;
      conditions.push(
        `(m."full_name" ILIKE $${idx} OR COALESCE(m."phone_number", '') ILIKE $${idx} OR COALESCE(m."area", '') ILIKE $${idx} OR COALESCE(m."notes", '') ILIKE $${idx})`
      );
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await getAuthPool().query<DbMemberRow>(
      `${MEMBER_SELECT_SQL} ${whereClause} ORDER BY m."sabha_type" ASC, m."full_name" ASC`,
      values
    );

    return NextResponse.json(result.rows.map(mapMemberRow));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load members' },
      { status: 502 }
    );
  }
}

// POST /api/admin/members — create a member
export async function POST(request: NextRequest) {
  const { response } = await requireAdminApiSession();
  if (response) return response;

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
  const sabhaType = typeof body.sabhaType === 'string' ? body.sabhaType.trim() : '';
  const phoneNumber = typeof body.phoneNumber === 'string' && body.phoneNumber.trim() ? body.phoneNumber.trim() : null;
  const area = typeof body.area === 'string' && body.area.trim() ? body.area.trim() : null;
  const std = typeof body.std === 'string' && body.std.trim() ? body.std.trim() : null;
  const dateOfBirth = typeof body.dateOfBirth === 'string' && body.dateOfBirth.trim() ? body.dateOfBirth.trim() : null;
  const followUpMemberId = typeof body.followUpMemberId === 'string' && body.followUpMemberId.trim() ? body.followUpMemberId.trim() : null;
  const notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null;
  const isKk = body.isKk === true;
  const attending = body.attending === undefined ? true : body.attending === true;
  const superActive = body.superActive === true;

  if (!fullName) {
    return NextResponse.json({ error: 'Full name is required' }, { status: 400 });
  }

  if (!sabhaType || !SABHA_TYPES.includes(sabhaType as SabhaType)) {
    return NextResponse.json({ error: 'Invalid sabha type' }, { status: 400 });
  }

  if (dateOfBirth && !isValidIsoDate(dateOfBirth)) {
    return NextResponse.json({ error: 'Invalid date of birth' }, { status: 400 });
  }

  const pool = getAuthPool();

  try {
    if (followUpMemberId) {
      const exists = await pool.query(`SELECT 1 FROM "member" WHERE "id" = $1 LIMIT 1`, [followUpMemberId]);
      if (exists.rowCount === 0) {
        return NextResponse.json({ error: 'Follow-up KK member not found' }, { status: 400 });
      }
    }

    const result = await pool.query<DbMemberRow>(
      `WITH new_member AS (
         INSERT INTO "member" ("full_name", "phone_number", "date_of_birth", "area", "std", "sabha_type", "follow_up_member_id", "is_kk", "attending", "super_active", "notes")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING "id"
       )
       ${MEMBER_SELECT_SQL}
       WHERE m."id" = (SELECT "id" FROM new_member)
       LIMIT 1`,
      [fullName, phoneNumber, dateOfBirth, area, std, sabhaType, followUpMemberId, isKk, attending, superActive, notes]
    );

    return NextResponse.json({ success: true, member: mapMemberRow(result.rows[0]) }, { status: 201 });
  } catch (error) {
    if (isUniquenessViolation(error)) {
      return NextResponse.json(
        { error: 'A member with this name already exists in that sabha' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create member' },
      { status: 502 }
    );
  }
}
