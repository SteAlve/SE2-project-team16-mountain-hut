/**
 * Use case: end a login session. It deletes the session, so the id stops working at once.
 * It never fails: with no session id, or an unknown one, there is nothing to end.
 */
export const makeLogout = ({ sessions, tokens }) => async (sessionId) => {
  if (!sessionId) return;
  await sessions.remove(tokens.hash(sessionId));
};
