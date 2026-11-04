import { describe, expect, it } from 'vitest';
import { makeRegister } from '../../src/usecases/register.js';
import { ConflictError } from '../../src/domain/errors.js';
import { input, setup } from './auth-fixtures.js';

describe('register use case', () => {
  it('creates a hiker, hashes the password, and starts a session', async () => {
    const t = setup();
    const startSession = async (user) => ({ id: `session-for-${user.id}` });
    const register = makeRegister({ users: t.users, passwordHasher: t.passwordHasher, startSession });

    const result = await register(input);

    expect(result.user).toMatchObject({ email: input.email, role: 'HIKER', phone: null });
    expect(t.rows[0].passwordHash).toBe('h(password1)');
    expect(t.calls.passwordHash).toEqual([input.password]);
    expect(result.session).toEqual({ id: 'session-for-1' });
  });

  it('always creates a HIKER account instead of accepting a requested role', async () => {
    const t = setup();
    const register = makeRegister({
      users: t.users,
      passwordHasher: t.passwordHasher,
      startSession: async () => ({}),
    });

    const result = await register({ ...input, role: 'WARDEN' });

    expect(result.user.role).toBe('HIKER');
  });

  it('rejects a duplicate email with ConflictError', async () => {
    const t = setup();
    const register = makeRegister({
      users: t.users,
      passwordHasher: t.passwordHasher,
      startSession: async () => ({}),
    });

    await register(input);

    await expect(register(input)).rejects.toBeInstanceOf(ConflictError);
  });
});
