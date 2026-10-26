/**
 * MIDDLEWARE: here goes the code that runs before the controllers, for now finding out who is
 * calling. It receives what it needs from app.js and passes failures to next(err): the error
 * middleware in app.js turns them into status codes.
 * Not here: business rules (who may do what is checked by the use case), SQL, status codes,
 * imports from other layers.
 *
 * THE CODE BELOW IS JUST AN EXAMPLE: it reads the session cookie and puts the user in req.user.
 * Delete this file when the first real one exists.
 */
export const makeRequireAuth = (authenticate) => async (req, _res, next) => {
  try {
    const sessionId = req.headers.cookie?.match(/sid=([^;]+)/)?.[1];
    req.user = await authenticate(sessionId);
    next();
  } catch (err) {
    next(err);
  }
};
