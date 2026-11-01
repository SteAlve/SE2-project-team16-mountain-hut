/**
 * Use case: who is calling? Given the session id read from the cookie, returns the user.
 * Throws UnauthorizedError (401) when there is no id, the id is unknown or the session expired.
 */
import { UnauthorizedError } from '../domain/errors.js';
import { isSessionActive } from '../domain/session.js';

export const makeAuthenticate = ({ sessions, tokens, clock }) => async (sessionId) => {
  if (!sessionId) throw new UnauthorizedError();

  const found = await sessions.findByTokenHash(tokens.hash(sessionId));
  if (!found || !isSessionActive(found.expiresAt, clock.now())) throw new UnauthorizedError();

  const { id, firstName, lastName, email, phone, role } = found;
  return { id, firstName, lastName, email, phone, role };
};
