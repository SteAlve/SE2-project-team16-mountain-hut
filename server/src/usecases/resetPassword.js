/**
 * Use case: the user chooses a new password with the link of the password reset email (MH-07).
 * In one transaction the link is used up, the password is changed and the obligation to change a
 * generated password is cleared (the hiker chose it). It does not log the user in.
 *
 * Errors: 422 with the code RESET_LINK_NOT_VALID, always the same, when the link has expired, was
 * already used, was replaced by a newer one or never existed.
 * (The length of the new password, at least 8, is checked by the DTO: it is bad input, 400.)
 */
import { UnprocessableError } from '../domain/errors.js';

export const makeResetPassword = ({ passwordResets, passwordHasher, tokens, clock }) =>
  async ({ token, newPassword }) => {
    const userId = await passwordResets.resetPassword({
      tokenHash: tokens.hash(token),
      passwordHash: await passwordHasher.hash(newPassword),
      now: clock.now(),
    });

    if (userId === null) {
      throw new UnprocessableError('This link no longer works', { code: 'RESET_LINK_NOT_VALID' });
    }
  };
