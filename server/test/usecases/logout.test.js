import { describe, expect, it } from 'vitest';
import { makeLogout } from '../../src/usecases/logout.js';
import { setup } from './auth-fixtures.js';

describe('logout use case', () => {
  it('hashes and removes an existing session', async () => {
    const t = setup();
    const logout = makeLogout({ sessions: t.sessions, tokens: t.tokens });

    await logout('session-id');

    expect(t.calls.tokenHash).toEqual(['session-id']);
    expect(t.calls.sessionRemove).toEqual(['hash-session-id']);
  });

  it('does nothing when there is no session id', async () => {
    const t = setup();
    const logout = makeLogout({ sessions: t.sessions, tokens: t.tokens });

    await expect(logout(undefined)).resolves.toBeUndefined();

    expect(t.calls.tokenHash).toHaveLength(0);
    expect(t.calls.sessionRemove).toHaveLength(0);
  });

  it('does not fail for an unknown session id', async () => {
    const t = setup();
    const logout = makeLogout({ sessions: t.sessions, tokens: t.tokens });

    await expect(logout('unknown-session')).resolves.toBeUndefined();
    expect(t.calls.sessionRemove).toEqual(['hash-unknown-session']);
  });
});
