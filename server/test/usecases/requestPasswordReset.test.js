import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeRequestPasswordReset } from '../../src/usecases/requestPasswordReset.js';

const user = { id: 4, firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' };
const now = new Date('2026-11-01T12:00:00Z');

function setup(found = user) {
  const users = { findByEmail: vi.fn().mockResolvedValue(found) };
  const passwordResets = {
    removeExpired: vi.fn().mockResolvedValue(undefined),
    insert: vi.fn().mockResolvedValue(undefined),
  };
  const tokens = { generate: vi.fn().mockReturnValue({ id: 'token-id', hash: 'token-hash' }) };
  const clock = { now: () => now, after: vi.fn((milliseconds) => new Date(now.getTime() + milliseconds)) };
  const mailer = { send: vi.fn().mockResolvedValue(undefined) };
  return {
    users, passwordResets, tokens, clock, mailer,
    request: makeRequestPasswordReset({ users, passwordResets, tokens, clock, mailer, appUrl: 'https://quota.example/' }),
  };
}

const nextTurn = () => new Promise((resolve) => setImmediate(resolve));

afterEach(() => vi.restoreAllMocks());

describe('requestPasswordReset use case', () => {
  it('stores a new hashed link and sends the reset email for an existing account', async () => {
    const t = setup();

    await t.request({ email: user.email });

    expect(t.passwordResets.removeExpired).toHaveBeenCalledExactlyOnceWith(now);
    expect(t.passwordResets.insert).toHaveBeenCalledExactlyOnceWith({
      userId: 4,
      tokenHash: 'token-hash',
      expiresAt: new Date('2026-11-02T12:00:00Z'),
    });
    expect(t.clock.after).toHaveBeenCalledExactlyOnceWith(24 * 60 * 60 * 1000);
    expect(t.mailer.send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      to: user.email,
      subject: 'Choose a new password for QUOTA',
      text: expect.stringContaining('https://quota.example/reset-password?token=token-id'),
    }));
  });

  it('does nothing for an unknown email', async () => {
    const t = setup(null);

    await t.request({ email: 'unknown@example.com' });

    expect(t.tokens.generate).not.toHaveBeenCalled();
    expect(t.passwordResets.removeExpired).not.toHaveBeenCalled();
    expect(t.passwordResets.insert).not.toHaveBeenCalled();
    expect(t.mailer.send).not.toHaveBeenCalled();
  });

  it('does not fail the request when sending the email fails', async () => {
    const t = setup();
    const error = new Error('SMTP unavailable');
    t.mailer.send.mockRejectedValue(error);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(t.request({ email: user.email })).resolves.toBeUndefined();
    await nextTurn();

    expect(log).toHaveBeenCalledExactlyOnceWith('The password reset email for user 4 was not sent:', error);
  });
});
