/**
 * Use case: a logged-in user changes their password (MH-07). The user stays logged in. It is also
 * how a hiker whose account was made by the staff ends the obligation to change the generated
 * password (mustChangePassword): the dao clears it together with the new hash.
 *
 * Errors: 422 the current password is wrong, or the new one is the same as the current one.
 * (The length of the new password, at least 8, is checked by the DTO: it is bad input, 400.)
 */
import { UnprocessableError } from '../domain/errors.js';

export const makeChangePassword = ({ users, passwordHasher }) => async ({ user, currentPassword, newPassword }) => {
  const storedHash = await users.findPasswordHashById(user.id);

  if (!(await passwordHasher.verify(currentPassword, storedHash))) {
    throw new UnprocessableError('The current password is wrong');
  }
  if (await passwordHasher.verify(newPassword, storedHash)) {
    throw new UnprocessableError('The new password must be different from the current one');
  }

  await users.updatePassword({ userId: user.id, passwordHash: await passwordHasher.hash(newPassword) });
};
