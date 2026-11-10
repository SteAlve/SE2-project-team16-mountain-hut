import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { close, get, run } from '../../src/dao/db.js';
import * as passwordResets from '../../src/dao/passwordResets.js';
import * as users from '../../src/dao/users.js';

// Everything this file makes has a last name starting with "Mh7reset": it is removed before and after.
const LAST = 'Mh7reset';

const hiker = (firstName = 'Marco') => users.insert({
  firstName,
  lastName: `${LAST}Bianchi`,
  email: `${firstName}.reset@mh7.test`.toLowerCase(),
  phone: null,
  role: 'HIKER',
  passwordHash: 'scrypt$old$hash',
  mustChangePassword: true,
});

const clean = () => run(`DELETE FROM app_user WHERE last_name LIKE '${LAST}%'`);

const NOW = new Date('2090-01-01T10:00:00Z');
const inAnHour = new Date(NOW.getTime() + 3_600_000);
const pending = (userId) => get('SELECT COUNT(*)::INT AS n FROM password_reset WHERE user_id = $1 AND used_at IS NULL', [userId]);

beforeEach(clean);
afterAll(async () => {
  await clean();
  await close();
});

describe('resetPassword', () => {
  it('uses the link, changes the password and clears the obligation to change it', async () => {
    const user = await hiker();
    await passwordResets.insert({ userId: user.id, tokenHash: 't1', expiresAt: inAnHour });

    const userId = await passwordResets.resetPassword({ tokenHash: 't1', passwordHash: 'scrypt$new$hash', now: NOW });

    expect(userId).toBe(user.id);
    expect(await users.findByEmail(user.email)).toMatchObject({ passwordHash: 'scrypt$new$hash', mustChangePassword: false });
  });

  it('works once: the same link a second time changes nothing', async () => {
    const user = await hiker();
    await passwordResets.insert({ userId: user.id, tokenHash: 't1', expiresAt: inAnHour });
    await passwordResets.resetPassword({ tokenHash: 't1', passwordHash: 'scrypt$first$hash', now: NOW });

    expect(await passwordResets.resetPassword({ tokenHash: 't1', passwordHash: 'scrypt$second$hash', now: NOW })).toBeNull();

    expect(await users.findPasswordHashById(user.id)).toBe('scrypt$first$hash');
  });

  it('answers null for a link that does not exist, and changes nothing', async () => {
    const user = await hiker();

    expect(await passwordResets.resetPassword({ tokenHash: 'nope', passwordHash: 'scrypt$new$hash', now: NOW })).toBeNull();

    expect(await users.findByEmail(user.email)).toMatchObject({ passwordHash: 'scrypt$old$hash', mustChangePassword: true });
  });

  it('answers null for a link that has expired, also at the very moment it expires', async () => {
    const user = await hiker();
    await passwordResets.insert({ userId: user.id, tokenHash: 't1', expiresAt: NOW });

    expect(await passwordResets.resetPassword({ tokenHash: 't1', passwordHash: 'scrypt$new$hash', now: NOW })).toBeNull();
    expect(await passwordResets.resetPassword({ tokenHash: 't1', passwordHash: 'scrypt$new$hash', now: new Date(NOW.getTime() + 1) })).toBeNull();

    expect(await users.findPasswordHashById(user.id)).toBe('scrypt$old$hash');
    expect(await pending(user.id)).toEqual({ n: 1 });
  });

  it('does not use the link when the password cannot be saved', async () => {
    // A temporary hiker has no password: the database refuses it, and the link stays unused.
    const temporary = await users.insertTemporaryHiker({ firstName: 'Giulia', lastName: `${LAST}Verdi`, phone: null });
    await passwordResets.insert({ userId: temporary.id, tokenHash: 't1', expiresAt: inAnHour });

    await expect(passwordResets.resetPassword({ tokenHash: 't1', passwordHash: 'scrypt$new$hash', now: NOW }))
      .rejects.toMatchObject({ code: '23514' });

    expect(await pending(temporary.id)).toEqual({ n: 1 });
  });

  it('lets only one of two requests with the same link win', async () => {
    const user = await hiker();
    await passwordResets.insert({ userId: user.id, tokenHash: 't1', expiresAt: inAnHour });

    const results = await Promise.all([
      passwordResets.resetPassword({ tokenHash: 't1', passwordHash: 'scrypt$a$hash', now: NOW }),
      passwordResets.resetPassword({ tokenHash: 't1', passwordHash: 'scrypt$b$hash', now: NOW }),
    ]);

    expect(results.filter((userId) => userId === user.id)).toHaveLength(1);
    expect(results.filter((userId) => userId === null)).toHaveLength(1);
  });
});

describe('insert', () => {
  it('replaces the link that was waiting: only the new one works', async () => {
    const user = await hiker();
    await passwordResets.insert({ userId: user.id, tokenHash: 'old', expiresAt: inAnHour });
    await passwordResets.insert({ userId: user.id, tokenHash: 'new', expiresAt: inAnHour });

    expect(await pending(user.id)).toEqual({ n: 1 });
    expect(await passwordResets.resetPassword({ tokenHash: 'old', passwordHash: 'scrypt$x$hash', now: NOW })).toBeNull();
    expect(await passwordResets.resetPassword({ tokenHash: 'new', passwordHash: 'scrypt$x$hash', now: NOW })).toBe(user.id);
  });

  it('keeps the links of the other users', async () => {
    const first = await hiker('Marco');
    const second = await hiker('Anna');
    await passwordResets.insert({ userId: first.id, tokenHash: 'first', expiresAt: inAnHour });
    await passwordResets.insert({ userId: second.id, tokenHash: 'second', expiresAt: inAnHour });

    expect(await pending(first.id)).toEqual({ n: 1 });
    expect(await pending(second.id)).toEqual({ n: 1 });
  });

  it('can ask again after the link was used', async () => {
    const user = await hiker();
    await passwordResets.insert({ userId: user.id, tokenHash: 't1', expiresAt: inAnHour });
    await passwordResets.resetPassword({ tokenHash: 't1', passwordHash: 'scrypt$x$hash', now: NOW });

    await passwordResets.insert({ userId: user.id, tokenHash: 't2', expiresAt: inAnHour });

    expect(await pending(user.id)).toEqual({ n: 1 });
  });

  it('keeps one link when two requests for the same user arrive at the same time', async () => {
    const user = await hiker();

    await Promise.all([
      passwordResets.insert({ userId: user.id, tokenHash: 'a', expiresAt: inAnHour }),
      passwordResets.insert({ userId: user.id, tokenHash: 'b', expiresAt: inAnHour }),
    ]);

    expect(await pending(user.id)).toEqual({ n: 1 });
  });

  it('is removed with the user', async () => {
    const user = await hiker();
    await passwordResets.insert({ userId: user.id, tokenHash: 't1', expiresAt: inAnHour });

    await run('DELETE FROM app_user WHERE id = $1', [user.id]);

    expect(await get('SELECT 1 FROM password_reset WHERE token_hash = $1', ['t1'])).toBeNull();
  });
});

describe('removeExpired', () => {
  it('deletes only the links that have expired, used or not', async () => {
    const first = await hiker('Marco');
    const second = await hiker('Anna');
    const third = await hiker('Luca');
    await passwordResets.insert({ userId: first.id, tokenHash: 'expired', expiresAt: new Date(NOW.getTime() - 1000) });
    await passwordResets.insert({ userId: second.id, tokenHash: 'used', expiresAt: inAnHour });
    await passwordResets.resetPassword({ tokenHash: 'used', passwordHash: 'scrypt$x$hash', now: NOW });
    await passwordResets.insert({ userId: third.id, tokenHash: 'live', expiresAt: inAnHour });

    await passwordResets.removeExpired(NOW);

    expect(await get('SELECT 1 FROM password_reset WHERE token_hash = $1', ['expired'])).toBeNull();
    expect(await get('SELECT 1 FROM password_reset WHERE token_hash = $1', ['used'])).not.toBeNull();
    expect(await get('SELECT 1 FROM password_reset WHERE token_hash = $1', ['live'])).not.toBeNull();
  });
});
