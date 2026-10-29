/**
 * APP: the composition root, the only file that knows every other piece.
 * It builds the use cases, the controllers and the routers, handing each one what it needs
 * (dao, clock, ...), mounts the routers under /api and adds the error middleware that
 * turns domain errors into status codes.
 * Not here: business rules, SQL, request handling.
 *
 * Wired so far: the authentication (sign up, login, logout, who am I), the bookable slots
 * and the booking of a table.
 * A story adds its own lines in each step.
 */

// general imports
import express from 'express';

// settings and the services handed to the use cases
import { config } from './config.js';
import { clock } from './clock.js';
import * as passwordHasher from './passwordHasher.js';
import * as tokens from './sessionTokens.js';

// the dao
import * as bookings from './dao/bookings.js';
import * as sessions from './dao/sessions.js';
import * as slots from './dao/slots.js';
import * as users from './dao/users.js';

// the errors the middleware turns into status codes
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  UnprocessableError,
  ValidationError,
} from './domain/errors.js';

// 1. middleware
import { makeReadSessionCookie, makeRequireAuth } from './middleware/session.js';

// 2. use cases
import { makeAuthenticate } from './usecases/authenticate.js';
import { makeCreateBooking } from './usecases/createBooking.js';
import { makeListBookableSlots } from './usecases/listBookableSlots.js';
import { makeLogin } from './usecases/login.js';
import { makeLogout } from './usecases/logout.js';
import { makeRegister } from './usecases/register.js';
import { makeStartSession } from './usecases/startSession.js';

// 3. controllers
import { makeCreateBookingController } from './controllers/bookings.js';
import { makeListSlotsController } from './controllers/slots.js';
import {
  makeLoginController,
  makeLogoutController,
  makeMeController,
  makeRegisterController,
} from './controllers/auth.js';

// 4. routers
import { makeAuthRouter } from './routes/auth.js';
import { makeBookingsRouter } from './routes/bookings.js';
import { makeSlotsRouter } from './routes/slots.js';

// authentication
const startSession = makeStartSession({ sessions, tokens, clock, sessionTtlMs: config.sessionTtlMs });
const authenticate = makeAuthenticate({ sessions, tokens, clock });
const register = makeRegister({ users, passwordHasher, startSession });
const login = makeLogin({ users, passwordHasher, startSession });
const logout = makeLogout({ sessions, tokens });

const readSessionCookie = makeReadSessionCookie(config.sessionCookieName);
const requireAuth = makeRequireAuth(authenticate);

const cookie = { name: config.sessionCookieName, secure: config.cookieSecure };
const authRouter = makeAuthRouter({
  registerController: makeRegisterController({ register, cookie }),
  loginController: makeLoginController({ login, cookie }),
  logoutController: makeLogoutController({ logout, cookie }),
  meController: makeMeController(),
  requireAuth,
});

// slots and bookings
const listBookableSlots = makeListBookableSlots({ slots, clock, hutTimeZone: config.hutTimeZone });
const createBooking = makeCreateBooking({ slots, bookings, clock, hutTimeZone: config.hutTimeZone });

const slotsRouter = makeSlotsRouter({ listSlotsController: makeListSlotsController({ listBookableSlots }) });
const bookingsRouter = makeBookingsRouter({
  createBookingController: makeCreateBookingController({ createBooking }),
  requireAuth,
});

export const app = express();
app.use(express.json());
app.use(readSessionCookie);
app.use('/api', authRouter);
app.use('/api', slotsRouter);
app.use('/api', bookingsRouter);

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
