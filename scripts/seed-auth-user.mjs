import { betterAuth } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { admin, username } from 'better-auth/plugins';
import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';

const { Pool } = pg;

const seedUser = {
  name: 'Raj',
  username: 'admin',
  displayUsername: 'admin',
  email: 'admin@raj.com',
  password: 'Admin@123',
};

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

const pool = new Pool({
  connectionString: requireEnv('DATABASE_URL'),
  ssl: { rejectUnauthorized: false },
});

const db = new Kysely({
  dialect: new PostgresDialect({ pool }),
});

const auth = betterAuth({
  database: { db, type: 'postgres' },
  secret: requireEnv('BETTER_AUTH_SECRET'),
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  basePath: '/api/auth',
  emailAndPassword: { enabled: true },
  rateLimit: { enabled: false },
  plugins: [
    username(),
    admin({ defaultRole: 'kk', adminRoles: ['admin'] }),
  ],
});

async function resetSeedUser() {
  await pool.query(
    `DELETE FROM "session" WHERE "userId" IN (SELECT "id" FROM "user" WHERE "email" = $1 OR "username" = $2)`,
    [seedUser.email, seedUser.username]
  );
  await pool.query(
    `DELETE FROM "account" WHERE "userId" IN (SELECT "id" FROM "user" WHERE "email" = $1 OR "username" = $2)`,
    [seedUser.email, seedUser.username]
  );
  await pool.query(
    `DELETE FROM "user" WHERE "email" = $1 OR "username" = $2`,
    [seedUser.email, seedUser.username]
  );
}

try {
  const { runMigrations } = await getMigrations(auth.options);
  await runMigrations();
  await resetSeedUser();

  const result = await auth.api.signUpEmail({ body: seedUser });

  if (result?.user?.id) {
    // Ensure the seeded user has admin role
    await pool.query(`UPDATE "user" SET "role" = 'admin' WHERE "id" = $1`, [result.user.id]);
    console.log(`Seeded admin user: ${seedUser.username} (${seedUser.email})`);
  }
} finally {
  await db.destroy();
}
