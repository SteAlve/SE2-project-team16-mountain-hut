import { applyMigrations } from '../scripts/migrate.js';
import { config } from '../src/config.js';
import { close } from '../src/dao/db.js';

export default async function setup() {
  if (!config.databaseUrl) return;
  await applyMigrations();
  await close();
}
