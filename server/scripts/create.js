/**
 * CREATE: creates the empty PostgreSQL database named in DATABASE_URL (TEST_DATABASE_URL when
 * NODE_ENV=test), if it does not exist yet. Run it with `npm run db:create`, then `npm run db:migrate`.
 * The URL comes from the environment or from server/.env (see src/config.js).
 *
 * It connects to the maintenance database "postgres" of the same server, because the database to
 * create cannot be reached before it exists. This is why it uses the driver directly and not db.js.
 * The user of the URL needs the CREATEDB privilege.
 */
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { config } from '../src/config.js';

// { name: the database of the URL, adminUrl: the same URL pointing to the "postgres" database }
export function splitDatabaseUrl(url) {
  const target = new URL(url);
  const name = decodeURIComponent(target.pathname.slice(1));
  if (name === '') throw new Error('The database URL must end with the name of the database.');

  const admin = new URL(url);
  admin.pathname = '/postgres';
  return { name, adminUrl: admin.toString() };
}

const quoteIdentifier = (name) => `"${name.replaceAll('"', '""')}"`;

// Resolves to true when the database was created, false when it already existed.
export async function createDatabase(url) {
  const { name, adminUrl } = splitDatabaseUrl(url);
  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();
  try {
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (existing.rowCount > 0) return false;
    await client.query(`CREATE DATABASE ${quoteIdentifier(name)}`);
    return true;
  } finally {
    await client.end();
  }
}

// Only when started as a script (npm run db:create), not when imported by the tests.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    if (!config.databaseUrl) throw new Error(`${config.databaseUrlVariable} must be set.`);
    const created = await createDatabase(config.databaseUrl);
    const { name } = splitDatabaseUrl(config.databaseUrl);
    console.log(created ? `Database "${name}" created.` : `Database "${name}" already exists.`);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
