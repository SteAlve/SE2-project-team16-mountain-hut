import { describe, expect, it } from 'vitest';
import { makeStartSession } from '../../src/usecases/startSession.js';
import { makeRegister } from '../../src/usecases/register.js';
import { makeLogin } from '../../src/usecases/login.js';
import { makeLogout } from '../../src/usecases/logout.js';
import { makeAuthenticate } from '../../src/usecases/authenticate.js';
import { ConflictError, UnauthorizedError } from '../../src/domain/errors.js';

const NOW = new Date('2026-01-01T12:00:00Z');

function setup() {
  const rows = [];
  const stored = [];
  const clock = { now: () => NOW, after: (ms) => new Date(NOW.getTime() + ms) };
  const tokens = {
    generate: () => ({ id: `id-${stored.length + 1}`, hash: `hash-id-${stored.length + 1}` }),
    hash: (id) => `hash-${id}`,
  };
  const passwordHasher = {
    hash: async (p) => `h(${p})`,
    verify: async (p, h) => h === `h(${p})`,
  };
  const users = {
    findByEmail: async (email) => rows.find((u) => u.email === email) ?? null,
    insert: async (data) => {
      if (rows.some((u) => u.email === data.email)) return null;
      const row = { id: rows.length + 1, ...data };
      rows.push(row);
      return row;
    },
  };
  const sessions = {
    insert: async (s) => { stored.push(s); },
    findByTokenHash: async (h) => {
      const s = stored.find((x) => x.tokenHash === h);
      const u = s && rows.find((r) => r.id === s.userId);
      return s && { expiresAt: s.expiresAt, ...u };
    },
    remove: async (h) => {
      const i = stored.findIndex((x) => x.tokenHash === h);
      if (i !== -1) stored.splice(i, 1);
    },
    removeExpired: async () => {},
  };
  const startSession = makeStartSession({ sessions, tokens, clock, sessionTtlMs: 1000 });
  return {
    rows, stored, startSession, sessions,
    register: makeRegister({ users, passwordHasher, startSession }),
    login: makeLogin({ users, passwordHasher, startSession }),
    logout: makeLogout({ sessions, tokens }),
    authenticate: makeAuthenticate({ sessions, tokens, clock }),
  };
}

const input = { firstName: 'A', lastName: 'B', email: 'a@b.it', phone: null, password: 'password1' };

describe('auth use cases', () => {
  it('register creates a HIKER, hashes the password and opens a session', async () => {
    const t = setup();
    const { user, session } = await t.register(input);

    expect(user).toMatchObject({ email: 'a@b.it', role: 'HIKER' });
    expect(t.rows[0].passwordHash).toBe('h(password1)');
    expect(session.expiresAt).toEqual(new Date(NOW.getTime() + 1000));
    expect(t.stored).toHaveLength(1);
    expect(t.stored[0].tokenHash).not.toBe(session.id);
  });

  it('register refuses a duplicate email with ConflictError', async () => {
    const t = setup();
    await t.register(input);
    await expect(t.register(input)).rejects.toBeInstanceOf(ConflictError);
  });

  it('login returns the user without the password hash and a fresh session each time', async () => {
    const t = setup();
    await t.register(input);
    const first = await t.login({ email: 'a@b.it', password: 'password1' });
    const second = await t.login({ email: 'a@b.it', password: 'password1' });

    expect(first.user).not.toHaveProperty('passwordHash');
    expect(first.session.id).not.toBe(second.session.id);
  });

  it('login gives the same UnauthorizedError for unknown email and wrong password', async () => {
    const t = setup();
    await t.register(input);
    const unknown = await t.login({ email: 'x@b.it', password: 'password1' }).catch((e) => e);
    const wrong = await t.login({ email: 'a@b.it', password: 'nope' }).catch((e) => e);

    expect(unknown).toBeInstanceOf(UnauthorizedError);
    expect(wrong).toBeInstanceOf(UnauthorizedError);
    expect(unknown.message).toBe(wrong.message);
  });

  it('authenticate returns the user for a live session only', async () => {
    const t = setup();
    const { session } = await t.register(input);

    await expect(t.authenticate(session.id)).resolves.toEqual({
      id: 1, firstName: 'A', lastName: 'B', email: 'a@b.it', phone: null, role: 'HIKER',
    });
    await expect(t.authenticate(undefined)).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(t.authenticate('unknown')).rejects.toBeInstanceOf(UnauthorizedError);

    t.stored[0].expiresAt = NOW; // expiry instant reached
    await expect(t.authenticate(session.id)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('logout removes the session and does nothing without an id', async () => {
    const t = setup();
    const { session } = await t.register(input);

    await t.logout(undefined);
    expect(t.stored).toHaveLength(1);
    await t.logout(session.id);
    expect(t.stored).toHaveLength(0);
    await expect(t.authenticate(session.id)).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
