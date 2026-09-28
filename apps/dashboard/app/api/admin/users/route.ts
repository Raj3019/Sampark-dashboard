import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/auth/session';
import { getAuthPool } from '@/lib/auth/db';
import { auth } from '@/lib/auth/server';

export const runtime = 'nodejs';

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  assignedKK: string | null;
  phone: string | null;
  createdAt: string;
};

// GET /api/admin/users — list all users (Neon Auth) + KK assignments (app DB)
export async function GET() {
  const { response } = await requireAdminApiSession();
  if (response) return response;

  const listResult = await auth.admin.listUsers({ query: { limit: 500, sortBy: 'createdAt', sortDirection: 'desc' } });

  if (listResult.error || !listResult.data) {
    return NextResponse.json(
      { error: listResult.error?.message ?? 'Failed to list users' },
      { status: 502 }
    );
  }

  const pool = getAuthPool();
  const assignmentResult = await pool.query<{ id: string; assigned_kk: string | null; phone: string | null }>(
    `SELECT "id", "assigned_kk", "phone" FROM "user_kk_assignment"`
  );
  const assignments = new Map(assignmentResult.rows.map((row) => [row.id, row]));

  const users: UserRow[] = listResult.data.users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role ?? 'user',
    assignedKK: assignments.get(user.id)?.assigned_kk ?? null,
    phone: assignments.get(user.id)?.phone ?? null,
    createdAt: String(user.createdAt ?? ''),
  }));

  return NextResponse.json(users);
}

// POST /api/admin/users — create a Neon Auth user (does not touch the admin's session)
export async function POST(request: NextRequest) {
  const { response } = await requireAdminApiSession();
  if (response) return response;

  const body = await request.json() as {
    name: string;
    email: string;
    password: string;
    role: 'admin' | 'leader' | 'kk';
    assignedKK?: string;
    phone?: string;
  };

  const { name, email, password, role } = body;
  const assignedKK = role === 'kk' ? body.assignedKK?.trim() : null;
  const phone = body.phone?.trim() ?? null;

  if (!name || !email || !password || !role) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
  }

  if (!['admin', 'leader', 'kk'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  if (role === 'kk' && !assignedKK) {
    return NextResponse.json({ error: 'Assigned KK is required for KK users' }, { status: 400 });
  }

  // SDK beta types narrow role to "admin" | "user"; the service accepts our custom roles ('leader','kk') fine
  const createOptions = { name, email, password, role } as unknown as Parameters<typeof auth.admin.createUser>[0];

  const createResult = await auth.admin.createUser(createOptions);

  if (createResult.error || !createResult.data?.user) {
    return NextResponse.json(
      { error: createResult.error?.message ?? 'Failed to create user' },
      { status: 502 }
    );
  }

  const userId = createResult.data.user.id;

  await getAuthPool().query(
    `INSERT INTO "user_kk_assignment" ("id", "assigned_kk", "phone", "updated_at")
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT ("id") DO UPDATE SET "assigned_kk" = EXCLUDED."assigned_kk", "phone" = EXCLUDED."phone", "updated_at" = NOW()`,
    [userId, assignedKK, phone]
  );

  return NextResponse.json({ success: true, userId }, { status: 201 });
}
