import { describe, expect, it } from 'vitest';
import { splitDatabaseUrl } from '../../scripts/create.js';

describe('splitDatabaseUrl', () => {
  it('gives the database name and the URL of the maintenance database', () => {
    const { name, adminUrl } = splitDatabaseUrl('postgresql://user:pw@localhost:5433/mountain_hut?sslmode=disable');
    expect(name).toBe('mountain_hut');
    expect(adminUrl).toBe('postgresql://user:pw@localhost:5433/postgres?sslmode=disable');
  });

  it('refuses a URL without database name', () => {
    expect(() => splitDatabaseUrl('postgresql://localhost:5432')).toThrow();
  });
});
