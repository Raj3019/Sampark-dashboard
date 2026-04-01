import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { betterAuth } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { username } from 'better-auth/plugins';
import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';

const { Pool } = pg;

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

const outputPath = resolve('supabase', 'migrations', '20260401_better_auth.sql');
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

try {
  const { compileMigrations } = await getMigrations(auth.options);
  const sql = await compileMigrations();

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, sql, 'utf8');

  console.log(`Auth SQL written to ${outputPath}`);
} finally {
  await db.destroy();
}
