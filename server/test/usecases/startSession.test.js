import { describe, expect, it } from 'vitest';
import { makeStartSession } from '../../src/usecases/startSession.js';
import { NOW, setup } from './auth-fixtures.js';

describe('start session use case', () => {
  it('removes expired sessions, stores a hash, and returns an expiry', async () => {
    const t = setup();
    const startSession = makeStartSession({
      sessions: t.sessions,
      tokens: t.tokens,
      clock: t.clock,
      sessionTtlMs: 1000,
    });

    const result = await startSession({ id: 7 });

    expect(t.calls.expiredRemoval).toEqual([NOW]);
    expect(t.stored).toHaveLength(1);
    expect(t.stored[0]).toMatchObject({ tokenHash: 'hash-id-1', userId: 7 });
    expect(t.stored[0].tokenHash).not.toBe(result.id);
    expect(result).toEqual({ id: 'id-1', expiresAt: new Date(NOW.getTime() + 1000) });
  });
});
