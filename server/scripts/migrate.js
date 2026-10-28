/**
 * MIGRATE: applies the SQL files of server/migrations, in name order, each in its own transaction.
 * A file already applied (recorded in schema_migration) is skipped, so it is safe to run it again.
 * Run it with `npm run db:migrate`, before the first start and after pulling a new migration.
 * Tests call applyMigrations() from test/globalSetup.js.
 */
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { all, close, inTransaction, run } from '../src/dao/db.js';

const migrationsDir = new URL('../migrations/', import.meta.url);

export async function applyMigrations() {
  await run(`CREATE TABLE IF NOT EXISTS schema_migration (
    name       TEXT        PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);

  const applied = new Set((await all('SELECT name FROM schema_migration')).map((row) => row.name));
  const files = (await readdir(migrationsDir)).filter((name) => name.endsWith('.sql')).sort();
  const done = [];

  for (const name of files) {
    if (applied.has(name)) continue;
    const sql = await readFile(new URL(name, migrationsDir), 'utf8');
    await inTransaction(async () => {
      await run(sql);
      await run('INSERT INTO schema_migration (name) VALUES ($1)', [name]);
    });
    done.push(name);
  }

  return done;
}

// Only when started as a script (npm run db:migrate), not when imported by the tests.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const done = await applyMigrations();
    console.log(done.length > 0 ? `Applied: ${done.join(', ')}` : 'Database already up to date.');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await close();
  }
}
