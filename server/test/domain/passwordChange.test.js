import { describe, expect, it } from 'vitest';
import { requirePasswordChanged } from '../../src/domain/passwordChange.js';
import { ForbiddenError } from '../../src/domain/errors.js';

describe('requirePasswordChanged', () => {
  it.each([false, undefined, null])('allows a user whose flag is %s', (mustChangePassword) => {
    expect(() => requirePasswordChanged({ id: 1, mustChangePassword })).not.toThrow();
  });

  it('refuses a user who still has the generated password', () => {
    expect(() => requirePasswordChanged({ id: 1, mustChangePassword: true })).toThrow(
      new ForbiddenError('You must change your password first', { code: 'PASSWORD_CHANGE_REQUIRED' }),
    );
  });
});
