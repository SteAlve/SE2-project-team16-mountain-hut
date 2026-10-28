import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { close, get, inTransaction, run } from '../src/dao/db.js';

const migrationsDirectory = fileURLToPath(new URL('../migrations/', import.meta.url));

const applyMigrations = async () => {
  const migrationFiles = (await readdir(migrationsDirectory))
    .filter((file) => /^\d+_[a-z0-9_-]+\.sql$/i.test(file))
    .sort();

  if (migrationFiles.length === 0) {
    throw new Error('No database migrations were found.');
  }

  await run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  for (const name of migrationFiles) {
    const sql = await readFile(join(migrationsDirectory, name), 'utf8');
    let applied = false;

    await inTransaction(async () => {
      const existing = await get(
        'SELECT name FROM schema_migrations WHERE name = $1',
        [name],
      );

      if (existing) {
        return;
      }

      await run(sql);
      await run('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
      applied = true;
    });

    console.log(`${applied ? 'Applied' : 'Already applied'} migration ${name}.`);
  }
};

try {
  await applyMigrations();
} catch (error) {
  console.error('Database migration failed:', error);
  process.exitCode = 1;
} finally {
  await close();
}
