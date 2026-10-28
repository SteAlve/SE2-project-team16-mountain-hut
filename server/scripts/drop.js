/**
 * DROP: deletes every table (and every other object) of the database in DATABASE_URL, with all
 * its data, and leaves it empty. The database itself stays. Run it with `npm run db:drop`;
 * `npm run db:reset` does db:drop and then db:migrate, to start again from the current migrations.
 * It refuses to run when NODE_ENV is 'production'.
 */
import { fileURLToPath } from 'node:url';
import { config } from '../src/config.js';
import { close, run } from '../src/dao/db.js';

export async function dropEverything() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to delete the database when NODE_ENV is production.');
  }
  // Dropping the schema removes tables, sequences and indexes with it (and the migration record).
  await run('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
}

// Only when started as a script (npm run db:drop), not when imported by the tests.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await dropEverything();
    const name = decodeURIComponent(new URL(config.databaseUrl).pathname.slice(1));
    console.log(`Every table of the database "${name}" was deleted.`);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await close();
  }
}
