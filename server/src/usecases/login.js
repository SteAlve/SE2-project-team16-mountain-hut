/**
 * Use case: a user logs in with email and password (the same for every role).
 * Throws UnauthorizedError (401) with one message for both an unknown email and a wrong password,
 * so the answer never tells which of the two was wrong.
 */
import { UnauthorizedError } from '../domain/errors.js';

export const makeLogin = ({ users, passwordHasher, startSession }) => async ({ email, password }) => {
  const found = await users.findByEmail(email);

  // verify() also runs when there is no user, so both failures take the same time.
  const passwordMatches = await passwordHasher.verify(password, found?.passwordHash);
  if (!found || !passwordMatches) throw new UnauthorizedError('Invalid email or password');

  const { id, firstName, lastName, email: userEmail, phone, role } = found;
  const user = { id, firstName, lastName, email: userEmail, phone, role };
  return { user, session: await startSession(user) };
};
