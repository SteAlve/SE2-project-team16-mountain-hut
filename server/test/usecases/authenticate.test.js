import { describe, expect, it } from 'vitest';
import { makeAuthenticate } from '../../src/usecases/authenticate.js';
import { UnauthorizedError } from '../../src/domain/errors.js';
import { NOW, setup } from './auth-fixtures.js';

describe('authenticate use case', () => {
  it('returns the user for a live session', async () => {
    const t = setup();
    t.rows.push({ id: 1, firstName: 'A', lastName: 'B', email: 'a@b.it', phone: null, role: 'HIKER', mustChangePassword: true });
    t.stored.push({ tokenHash: 'hash-session-id', userId: 1, expiresAt: new Date(NOW.getTime() + 1000) });
    const authenticate = makeAuthenticate({ sessions: t.sessions, tokens: t.tokens, clock: t.clock });

    await expect(authenticate('session-id')).resolves.toEqual(t.rows[0]);
  });

  it.each([undefined, 'unknown-session'])('rejects %s as unauthorized', async (sessionId) => {
    const t = setup();
    const authenticate = makeAuthenticate({ sessions: t.sessions, tokens: t.tokens, clock: t.clock });

    await expect(authenticate(sessionId)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejects an expired session', async () => {
    const t = setup();
    t.rows.push({ id: 1, firstName: 'A', lastName: 'B', email: 'a@b.it', phone: null, role: 'HIKER' });
    t.stored.push({ tokenHash: 'hash-session-id', userId: 1, expiresAt: NOW });
    const authenticate = makeAuthenticate({ sessions: t.sessions, tokens: t.tokens, clock: t.clock });

    await expect(authenticate('session-id')).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
