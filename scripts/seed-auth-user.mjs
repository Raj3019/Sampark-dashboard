import { betterAuth } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { username } from 'better-auth/plugins';
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

  if (!value) {
    throw new Error(`${name} is required.`);
  }

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
  database: {
    db,
    type: 'postgres',
  },
  secret: requireEnv('BETTER_AUTH_SECRET'),
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  basePath: '/api/auth',
  emailAndPassword: {
    enabled: true,
  },
  rateLimit: {
    enabled: false,
  },
  plugins: [username()],
});

async function resetSeedUser() {
  await pool.query(
    `
      DELETE FROM "session"
      WHERE "userId" IN (
        SELECT "id" FROM "user" WHERE "email" = $1 OR "username" = $2
      )
    `,
    [seedUser.email, seedUser.username]
  );

  await pool.query(
    `
      DELETE FROM "account"
      WHERE "userId" IN (
        SELECT "id" FROM "user" WHERE "email" = $1 OR "username" = $2
      )
    `,
    [seedUser.email, seedUser.username]
  );

  await pool.query(
    `
      DELETE FROM "user"
      WHERE "email" = $1 OR "username" = $2
    `,
    [seedUser.email, seedUser.username]
  );
}

try {
  const { runMigrations } = await getMigrations(auth.options);
  await runMigrations();
  await resetSeedUser();

  await auth.api.signUpEmail({
    body: seedUser,
  });

  console.log(`Seeded auth user: ${seedUser.username} (${seedUser.email})`);
} finally {
  await db.destroy();
}
