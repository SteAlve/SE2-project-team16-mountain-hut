import { afterAll, describe, expect, it } from 'vitest';
import { all, close, get, inTransaction, run } from '../../src/dao/db.js';

afterAll(async () => {
  await close();
});

describe('database helpers', () => {
  it('returns a single row, all rows and mutation results', async () => {
    await expect(get('SELECT 1 AS value')).resolves.toEqual({ value: 1 });
    await expect(get('SELECT 1 AS value WHERE FALSE')).resolves.toBeNull();
    await expect(all('SELECT value FROM generate_series(1, 2) AS series(value)')).resolves.toEqual([
      { value: 1 },
      { value: 2 },
    ]);

    await inTransaction(async () => {
      await run('CREATE TEMP TABLE db_helper_test (value INTEGER) ON COMMIT DROP');
      const result = await run(
        'INSERT INTO db_helper_test (value) VALUES ($1) RETURNING value',
        [42],
      );
      expect(result).toEqual({ rows: [{ value: 42 }], rowCount: 1 });
    });
  });

  it('uses the same connection for queries in a transaction and rolls back on failure', async () => {
    const failure = new Error('rollback test');

    await expect(inTransaction(async () => {
      const before = await get('SELECT pg_backend_pid() AS pid');
      const after = await get('SELECT pg_backend_pid() AS pid');
      expect(after.pid).toBe(before.pid);
      await run('SELECT 1');
      throw failure;
    })).rejects.toBe(failure);

    await expect(get('SELECT 1 AS value')).resolves.toEqual({ value: 1 });
  });

  it('supports nested transactions with savepoints', async () => {
    await expect(inTransaction(async () => {
      await inTransaction(async () => {
        await run('SELECT 1');
      });
      return 'committed';
    })).resolves.toBe('committed');
  });
});
