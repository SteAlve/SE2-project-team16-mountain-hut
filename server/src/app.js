/**
 * APP: the composition root, the only file that knows every other piece.
 * It builds the use cases, the controllers and the routers, handing each one what it needs
 * (dao, clock, ...), mounts the routers under /api and adds the error middleware that
 * turns domain errors into status codes.
 * Not here: business rules, SQL, request handling.
 *
 * It wires no feature yet: a story adds its own lines in each step.
 */

// general imports
import express from 'express';

// the errors the middleware turns into status codes
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  UnprocessableError,
  ValidationError,
} from './domain/errors.js';

// 2. use cases

// 3. controllers

// 4. routers
export const app = express();
app.use(express.json());

// an /api path no router answers
app.use('/api', (_req, _res, next) => next(new NotFoundError('Resource not found')));

// 5. errors
const isBadJson = (err) => err.type === 'entity.parse.failed';

const statusOf = (err) => {
  if (err instanceof ValidationError || isBadJson(err)) return 400;
  if (err instanceof UnauthorizedError) return 401;
  if (err instanceof ForbiddenError) return 403;
  if (err instanceof NotFoundError) return 404;
  if (err instanceof ConflictError) return 409;
  if (err instanceof UnprocessableError) return 422;
  return 500;
};

app.use((err, _req, res, _next) => {
  const status = statusOf(err);
  if (status === 500) {
    console.error(err);
    return res.status(500).json({ error: 'InternalServerError', message: 'Unexpected error' });
  }
  if (isBadJson(err)) {
    return res.status(400).json({ error: 'ValidationError', message: 'Request body must be valid JSON' });
  }
  res.status(status).json({ error: err.name, message: err.message });
});
