import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { close, get, run } from '../../src/dao/db.js';
import * as users from '../../src/dao/users.js';
import * as sessions from '../../src/dao/sessions.js';

const data = {
  firstName: 'Dao', lastName: 'Test', email: 'dao.test@example.com',
  phone: null, role: 'HIKER', passwordHash: 'scrypt$x$y',
};

beforeEach(async () => {
  await run("DELETE FROM app_user WHERE email LIKE '%@example.com'");
});
afterAll(async () => {
  await run("DELETE FROM app_user WHERE email LIKE '%@example.com'");
  await close();
});

describe('users dao', () => {
  it('inserts, returns public columns only, and finds by email with the hash', async () => {
    const created = await users.insert(data);
    expect(created).toMatchObject({ firstName: 'Dao', email: data.email, role: 'HIKER', phone: null });
    expect(created).not.toHaveProperty('passwordHash');

    expect(await users.findByEmail(data.email)).toMatchObject({ id: created.id, passwordHash: 'scrypt$x$y' });
    expect(await users.findByEmail('nobody@example.com')).toBeNull();
  });

  it('returns null on a duplicate email', async () => {
    await users.insert(data);
    expect(await users.insert(data)).toBeNull();
  });

  it('rejects an unknown role and a non-lowercase email at database level', async () => {
    await expect(users.insert({ ...data, role: 'ADMIN' })).rejects.toThrow();
    await expect(users.insert({ ...data, email: 'Upper@example.com' })).rejects.toThrow();
  });
});

describe('sessions dao', () => {
  it('inserts, finds with the user, removes, and cascades on user delete', async () => {
    const user = await users.insert(data);
    const expiresAt = new Date(Date.now() + 60_000);
    await sessions.insert({ tokenHash: 'h1', userId: user.id, expiresAt });

    const found = await sessions.findByTokenHash('h1');
    expect(found).toMatchObject({ id: user.id, email: data.email, role: 'HIKER' });
    expect(found.expiresAt.getTime()).toBe(expiresAt.getTime());
    expect(found).not.toHaveProperty('passwordHash');

    await sessions.remove('h1');
    expect(await sessions.findByTokenHash('h1')).toBeNull();

    await sessions.insert({ tokenHash: 'h2', userId: user.id, expiresAt });
    await run('DELETE FROM app_user WHERE id = $1', [user.id]);
    expect(await get('SELECT 1 FROM session WHERE token_hash = $1', ['h2'])).toBeNull();
  });

  it('removeExpired deletes only the expired sessions', async () => {
    const user = await users.insert(data);
    const now = new Date();
    await sessions.insert({ tokenHash: 'old', userId: user.id, expiresAt: new Date(now.getTime() - 1000) });
    await sessions.insert({ tokenHash: 'live', userId: user.id, expiresAt: new Date(now.getTime() + 60_000) });

    await sessions.removeExpired(now);

    expect(await sessions.findByTokenHash('old')).toBeNull();
    expect(await sessions.findByTokenHash('live')).not.toBeNull();
  });
});
