/**
 * Use case: start a login session for a user. Sign up and login both end with it.
 * A new random id is always made here: the id never comes from the client, so a session id
 * planted in a browser cannot become a login. Returns the id (for the cookie) and its expiry.
 */
export const makeStartSession = ({ sessions, tokens, clock, sessionTtlMs }) => async (user) => {
  const token = tokens.generate();
  const expiresAt = clock.after(sessionTtlMs);

  await sessions.removeExpired(clock.now());
  await sessions.insert({ tokenHash: token.hash, userId: user.id, expiresAt });

  return { id: token.id, expiresAt };
};
