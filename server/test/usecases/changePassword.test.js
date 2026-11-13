import { describe, expect, it, vi } from 'vitest';
import { makeChangePassword } from '../../src/usecases/changePassword.js';
import { UnprocessableError } from '../../src/domain/errors.js';

const user = { id: 7, role: 'HIKER' };

function setup() {
  const users = {
    findPasswordHashById: vi.fn().mockResolvedValue('hash-current'),
    updatePassword: vi.fn().mockResolvedValue(true),
  };
  const passwordHasher = {
    verify: vi.fn(async (password, passwordHash) => passwordHash === 'hash-current' && password === 'current'),
    hash: vi.fn(async (password) => `hash-${password}`),
  };
  return { users, passwordHasher, change: makeChangePassword({ users, passwordHasher }) };
}

describe('changePassword use case', () => {
  it('changes the password and clears the first-login obligation through the user DAO', async () => {
    const t = setup();

    await t.change({ user, currentPassword: 'current', newPassword: 'new-password' });

    expect(t.users.findPasswordHashById).toHaveBeenCalledExactlyOnceWith(7);
    expect(t.passwordHasher.hash).toHaveBeenCalledExactlyOnceWith('new-password');
    expect(t.users.updatePassword).toHaveBeenCalledExactlyOnceWith({ userId: 7, passwordHash: 'hash-new-password' });
  });

  it('rejects a wrong current password without writing', async () => {
    const t = setup();

    await expect(t.change({ user, currentPassword: 'wrong', newPassword: 'new-password' }))
      .rejects.toThrow(new UnprocessableError('The current password is wrong'));
    expect(t.users.updatePassword).not.toHaveBeenCalled();
  });

  it('rejects reusing the current password without writing', async () => {
    const t = setup();

    await expect(t.change({ user, currentPassword: 'current', newPassword: 'current' }))
      .rejects.toThrow(new UnprocessableError('The new password must be different from the current one'));
    expect(t.users.updatePassword).not.toHaveBeenCalled();
  });
});
