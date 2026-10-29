/**
 * Use case: a visitor signs up as a hiker, and is logged in straight away.
 * The role is always HIKER: it is decided here, never read from the request.
 * Throws ConflictError (409) when an account with the email already exists.
 */
import { ConflictError } from '../domain/errors.js';
import { ROLES } from '../domain/roles.js';

export const makeRegister = ({ users, passwordHasher, startSession }) => async ({
  firstName,
  lastName,
  email,
  phone,
  password,
}) => {
  const passwordHash = await passwordHasher.hash(password);
  const user = await users.insert({
    firstName,
    lastName,
    email,
    phone,
    role: ROLES.HIKER,
    passwordHash,
  });

  if (!user) throw new ConflictError('An account with this email already exists');

  return { user, session: await startSession(user) };
};
