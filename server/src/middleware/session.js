/**
 * Middleware of the session: finding out who is calling.
 *
 * makeReadSessionCookie(name) runs on every request: it puts the session id found in the cookie
 * (or undefined) in req.sessionId. It does not check it.
 * makeRequireAuth(authenticate) runs in front of the protected paths: it asks `authenticate`
 * (handed over by app.js) who the session belongs to and puts the user in req.user. A missing,
 * unknown or expired session goes to next(err) as an UnauthorizedError (401).
 */

const readCookie = (header, name) => {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator !== -1 && part.slice(0, separator).trim() === name) {
      const value = part.slice(separator + 1).trim();
      return value === '' ? undefined : value;
    }
  }
  return undefined;
};

export const makeReadSessionCookie = (name) => (req, _res, next) => {
  req.sessionId = readCookie(req.headers.cookie, name);
  next();
};

export const makeRequireAuth = (authenticate) => async (req, _res, next) => {
  try {
    req.user = await authenticate(req.sessionId);
    next();
  } catch (err) {
    next(err);
  }
};
