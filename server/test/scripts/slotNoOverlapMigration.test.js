// The migration 004_slot_no_overlap.sql on a database from before it. Each test runs it in a
// transaction that is rolled back, so the rule stays as the other tests expect it.
import { readFile } from 'node:fs/promises';
import { afterAll, describe, expect, it } from 'vitest';
import { close, inTransaction, run } from '../../src/dao/db.js';

const migration = await readFile(new URL('../../migrations/004_slot_no_overlap.sql', import.meta.url), 'utf8');
const DAY = '2091-03-14';

class RolledBack extends Error {}

// Runs the migration on the slots given, as on a database where they could overlap.
const migrateWith = (slots) => inTransaction(async () => {
  await run('ALTER TABLE slot DROP CONSTRAINT slot_no_overlap');
  for (const [startsAt, endsAt] of slots) {
    await run('INSERT INTO slot (service_date, starts_at, ends_at) VALUES ($1, $2, $3)', [DAY, startsAt, endsAt]);
  }
  await run(migration);
  throw new RolledBack();
});

afterAll(close);

describe('migration 004_slot_no_overlap', () => {
  it('stops and names the slots that overlap', async () => {
    await expect(migrateWith([['12:00', '13:00'], ['12:30', '13:30'], ['13:30', '14:30']]))
      .rejects.toThrow(/Some slots of the same day overlap.*2091-03-14: slot \d+ \(12:00-13:00\) and slot \d+ \(12:30-13:30\)$/);
  });

  it('adds the rule when no slots overlap, one after the other included', async () => {
    await expect(migrateWith([['12:00', '13:00'], ['13:00', '14:00']])).rejects.toBeInstanceOf(RolledBack);
  });
});
