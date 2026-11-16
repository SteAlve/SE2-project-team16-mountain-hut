import { describe, expect, it, vi } from 'vitest';
import { makeResetPassword } from '../../src/usecases/resetPassword.js';
import { UnprocessableError } from '../../src/domain/errors.js';

const now = new Date('2026-11-01T12:00:00Z');

function setup(userId = 4) {
  const passwordResets = { resetPassword: vi.fn().mockResolvedValue(userId) };
  const passwordHasher = { hash: vi.fn().mockResolvedValue('new-hash') };
  const tokens = { hash: vi.fn().mockReturnValue('hashed-token') };
  const clock = { now: () => now };
  return {
    passwordResets, passwordHasher, tokens,
    reset: makeResetPassword({ passwordResets, passwordHasher, tokens, clock }),
  };
}

describe('resetPassword use case', () => {
  it('hashes the new password and consumes the token without starting a session', async () => {
    const t = setup();

    await t.reset({ token: 'token-id', newPassword: 'new-password' });

    expect(t.tokens.hash).toHaveBeenCalledExactlyOnceWith('token-id');
    expect(t.passwordHasher.hash).toHaveBeenCalledExactlyOnceWith('new-password');
    expect(t.passwordResets.resetPassword).toHaveBeenCalledExactlyOnceWith({
      tokenHash: 'hashed-token', passwordHash: 'new-hash', now,
    });
  });

  it('returns the same invalid-link error when the token cannot be used', async () => {
    const t = setup(null);

    await expect(t.reset({ token: 'expired-token', newPassword: 'new-password' }))
      .rejects.toThrow(new UnprocessableError('This link no longer works', { code: 'RESET_LINK_NOT_VALID' }));
  });
});
