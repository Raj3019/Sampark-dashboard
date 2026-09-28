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
} from '../_shared';

export const runtime = 'nodejs';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// PATCH /api/admin/members/[id] — update any editable field
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = await requireAdminApiSession();
  if (response) return response;

  const { id } = await params;

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'Invalid member id' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const pool = getAuthPool();

  try {
    const existing = await fetchMemberById(pool, id);
    if (!existing) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const sets: string[] = [];
    const values: unknown[] = [];
    const push = (column: string, value: unknown) => {
      values.push(value);
      sets.push(`"${column}" = $${values.length}`);
    };

    let newFullName = existing.fullName;
    let newSabhaType = existing.sabhaType;

    if ('fullName' in body) {
      if (typeof body.fullName !== 'string' || !body.fullName.trim()) {
        return NextResponse.json({ error: 'Full name is required' }, { status: 400 });
      }
      newFullName = body.fullName.trim();
      push('full_name', newFullName);
    }

    if ('sabhaType' in body) {
      if (typeof body.sabhaType !== 'string' || !SABHA_TYPES.includes(body.sabhaType.trim() as SabhaType)) {
        return NextResponse.json({ error: 'Invalid sabha type' }, { status: 400 });
      }
      newSabhaType = body.sabhaType.trim();
      push('sabha_type', newSabhaType);
    }

    if ('phoneNumber' in body) {
      if (body.phoneNumber !== null && typeof body.phoneNumber !== 'string') {
        return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
      }
      push('phone_number', typeof body.phoneNumber === 'string' && body.phoneNumber.trim() ? body.phoneNumber.trim() : null);
    }

    if ('area' in body) {
      if (body.area !== null && typeof body.area !== 'string') {
        return NextResponse.json({ error: 'Invalid area' }, { status: 400 });
      }
      push('area', typeof body.area === 'string' && body.area.trim() ? body.area.trim() : null);
    }

    if ('std' in body) {
      if (body.std !== null && typeof body.std !== 'string') {
        return NextResponse.json({ error: 'Invalid std' }, { status: 400 });
      }
      push('std', typeof body.std === 'string' && body.std.trim() ? body.std.trim() : null);
    }

    if ('dateOfBirth' in body) {
      if (body.dateOfBirth !== null && typeof body.dateOfBirth !== 'string') {
        return NextResponse.json({ error: 'Invalid date of birth' }, { status: 400 });
      }
      const dob = typeof body.dateOfBirth === 'string' && body.dateOfBirth.trim() ? body.dateOfBirth.trim() : null;
      if (dob && !isValidIsoDate(dob)) {
        return NextResponse.json({ error: 'Invalid date of birth' }, { status: 400 });
      }
      push('date_of_birth', dob);
    }

    if ('notes' in body) {
      if (body.notes !== null && typeof body.notes !== 'string') {
        return NextResponse.json({ error: 'Invalid notes' }, { status: 400 });
      }
      push('notes', typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null);
    }

    if ('attending' in body) {
      if (typeof body.attending !== 'boolean') {
        return NextResponse.json({ error: 'Invalid attending value' }, { status: 400 });
      }
      push('attending', body.attending);
    }

    if ('superActive' in body) {
      if (typeof body.superActive !== 'boolean') {
        return NextResponse.json({ error: 'Invalid superActive value' }, { status: 400 });
      }
      push('super_active', body.superActive);
    }

    if ('isKk' in body) {
      if (typeof body.isKk !== 'boolean') {
        return NextResponse.json({ error: 'Invalid isKk value' }, { status: 400 });
      }
      push('is_kk', body.isKk);
    }

    if ('followUpMemberId' in body) {
      if (body.followUpMemberId !== null && typeof body.followUpMemberId !== 'string') {
        return NextResponse.json({ error: 'Invalid follow-up member id' }, { status: 400 });
      }
      const followUpId = typeof body.followUpMemberId === 'string' && body.followUpMemberId.trim() ? body.followUpMemberId.trim() : null;

      if (followUpId) {
        if (!UUID_REGEX.test(followUpId)) {
          return NextResponse.json({ error: 'Invalid follow-up member id' }, { status: 400 });
        }
        if (followUpId === id) {
          return NextResponse.json({ error: 'A member cannot follow up after themselves' }, { status: 400 });
        }
        const target = await pool.query<{ follow_up_member_id: string | null }>(
          `SELECT "follow_up_member_id" FROM "member" WHERE "id" = $1 LIMIT 1`,
          [followUpId]
        );
        if (target.rowCount === 0) {
          return NextResponse.json({ error: 'Follow-up KK member not found' }, { status: 400 });
        }
        if (target.rows[0].follow_up_member_id === id) {
          return NextResponse.json(
            { error: 'Circular follow-up: that member already follows up after this one' },
            { status: 400 }
          );
        }
      }

      push('follow_up_member_id', followUpId);
    }

    if (values.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    if (newFullName !== existing.fullName || newSabhaType !== existing.sabhaType) {
      const duplicate = await pool.query(
        `SELECT 1 FROM "member" WHERE "sabha_type" = $1 AND lower(trim("full_name")) = lower(trim($2)) AND "id" <> $3 LIMIT 1`,
        [newSabhaType, newFullName, id]
      );
      if (duplicate.rowCount && duplicate.rowCount > 0) {
        return NextResponse.json(
          { error: 'A member with this name already exists in that sabha' },
          { status: 409 }
        );
      }
    }

    values.push(id);
    const result = await pool.query<DbMemberRow>(
      `${MEMBER_SELECT_SQL} WHERE m."id" = (
         UPDATE "member" SET ${sets.join(', ')}, "updated_at" = NOW() WHERE "id" = $${values.length} RETURNING "id"
       ) LIMIT 1`,
      values
    );

    if (!result.rows[0]) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, member: mapMemberRow(result.rows[0]) });
  } catch (error) {
    if (isUniquenessViolation(error)) {
      return NextResponse.json(
        { error: 'A member with this name already exists in that sabha' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update member' },
      { status: 502 }
    );
  }
}

// DELETE /api/admin/members/[id] — remove member (attendance rows cascade)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = await requireAdminApiSession();
  if (response) return response;

  const { id } = await params;

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'Invalid member id' }, { status: 400 });
  }

  const pool = getAuthPool();

  try {
    await pool.query(`UPDATE "member" SET "follow_up_member_id" = NULL WHERE "follow_up_member_id" = $1`, [id]);
    const result = await pool.query(`DELETE FROM "member" WHERE "id" = $1 RETURNING "id"`, [id]);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete member' },
      { status: 502 }
    );
  }
}
