import { afterAll, describe, expect, it } from 'vitest';
import { all, close, run } from '../src/dao/db.js';
import { DEMO_STAFF, seedStaff } from '../scripts/seed.js';

afterAll(close);

describe('seedStaff', () => {
  it('is idempotent and creates the demo staff', async () => {
    await run('DELETE FROM app_user WHERE email = ANY($1)', [DEMO_STAFF.map((s) => s.email)]);
    await seedStaff();
    await seedStaff();
    const rows = await all('SELECT email, role FROM app_user WHERE email = ANY($1)', [DEMO_STAFF.map((s) => s.email)]);
    expect(rows).toHaveLength(DEMO_STAFF.length);
    expect(rows.some((r) => r.role === 'WARDEN')).toBe(true);
  });
});
