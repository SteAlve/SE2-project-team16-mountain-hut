import { describe, expect, it } from 'vitest';
import { makeLogin } from '../../src/usecases/login.js';
import { UnauthorizedError } from '../../src/domain/errors.js';
import { input, setup } from './auth-fixtures.js';

const existingUser = {
  id: 1,
  firstName: input.firstName,
  lastName: input.lastName,
  email: input.email,
  phone: '+39 333 1234567',
  role: 'EMPLOYEE',
  passwordHash: 'h(password1)',
};

describe('login use case', () => {
  it('logs in with valid credentials and starts a session', async () => {
    const t = setup();
    t.rows.push(existingUser);
    const login = makeLogin({ users: t.users, passwordHasher: t.passwordHasher, startSession: (user) => ({
      userId: user.id,
      id: 'session-id',
    }) });

    const result = await login({ email: input.email, password: input.password });

    expect(result.user).toEqual({
      id: 1,
      firstName: 'A',
      lastName: 'B',
      email: input.email,
      phone: existingUser.phone,
      role: 'EMPLOYEE',
    });
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.session).toEqual({ userId: 1, id: 'session-id' });
    expect(t.calls.passwordVerify).toEqual([{ password: input.password, passwordHash: 'h(password1)' }]);
  });

  it('rejects an incorrect password without starting a session', async () => {
    const t = setup();
    t.rows.push(existingUser);
    const startSession = async () => { throw new Error('must not start a session'); };
    const login = makeLogin({ users: t.users, passwordHasher: t.passwordHasher, startSession });

    await expect(login({ email: input.email, password: 'wrong-password' }))
      .rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejects an unknown email and still verifies a password', async () => {
    const t = setup();
    const startSession = async () => { throw new Error('must not start a session'); };
    const login = makeLogin({ users: t.users, passwordHasher: t.passwordHasher, startSession });

    await expect(login({ email: 'unknown@example.com', password: input.password }))
      .rejects.toBeInstanceOf(UnauthorizedError);
    expect(t.calls.passwordVerify).toEqual([{ password: input.password, passwordHash: undefined }]);
  });

  it('uses the same error for an unknown email and a wrong password', async () => {
    const t = setup();
    t.rows.push(existingUser);
    const login = makeLogin({ users: t.users, passwordHasher: t.passwordHasher, startSession: async () => ({}) });
    const unknown = await login({ email: 'unknown@example.com', password: input.password }).catch((error) => error);
    const wrong = await login({ email: input.email, password: 'wrong-password' }).catch((error) => error);

    expect(unknown).toBeInstanceOf(UnauthorizedError);
    expect(wrong).toBeInstanceOf(UnauthorizedError);
    expect(unknown.message).toBe(wrong.message);
  });

  it('creates a fresh session for every successful login', async () => {
    const t = setup();
    t.rows.push(existingUser);
    const sessions = [];
    const login = makeLogin({
      users: t.users,
      passwordHasher: t.passwordHasher,
      startSession: async () => ({ id: `session-${sessions.push(1)}` }),
    });

    const first = await login({ email: input.email, password: input.password });
    const second = await login({ email: input.email, password: input.password });

    expect(first.session.id).not.toBe(second.session.id);
  });
});
