import { Pool } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var __sabhaAuthPool: Pool | undefined;
}

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured.');
  }

  return databaseUrl;
}

export function getAuthPool() {
  if (!global.__sabhaAuthPool) {
    global.__sabhaAuthPool = new Pool({
      connectionString: getDatabaseUrl(),
      max: 10,
      ssl: { rejectUnauthorized: false },
    });
  }

  return global.__sabhaAuthPool;
}
