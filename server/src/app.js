/**
 * APP: the composition root, the only file that knows every other piece.
 * It builds the use cases, the controllers and the routers, handing each one what it needs
 * (dao, clock, ...), mounts the routers under /api and adds the error middleware that
 * turns domain errors into status codes.
 * Not here: business rules, SQL, request handling.
 *
 * Wired so far: the authentication (sign up, login, logout, who am I, the change of the password
 * and the password reset by email), the slots, the seating preview, the booking of a table, its
 * confirmation email, the bookings of a hiker and their changes (with an email), the table sets and
 * slots of the staff, and the reservations that the staff makes for a hiker.
 * A story adds its own lines in each step.
 */

// general imports
import express from 'express';

// settings and the services handed to the use cases
import { config } from './config.js';
import { clock } from './clock.js';
import { makeMailer } from './mailer.js';
import * as passwordGenerator from './passwordGenerator.js';
import * as passwordHasher from './passwordHasher.js';
import * as tokens from './sessionTokens.js';

// the dao
import * as bookings from './dao/bookings.js';
import * as passwordResets from './dao/passwordResets.js';
import * as sessions from './dao/sessions.js';
import * as slots from './dao/slots.js';
import * as tableSets from './dao/tableSets.js';
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
import { requirePasswordChanged } from './domain/passwordChange.js';

// 1. middleware
import {
  makeReadSessionCookie,
  makeRequireAuth,
  makeRequirePasswordChanged,
} from './middleware/session.js';

// 2. use cases
import { makeAssignTableSet } from './usecases/assignTableSet.js';
import { makeAuthenticate } from './usecases/authenticate.js';
import { makeBookTable } from './usecases/bookTable.js';
import { makeChangePassword } from './usecases/changePassword.js';
import { makeCreateBooking } from './usecases/createBooking.js';
import { makeChangeBooking } from './usecases/changeBooking.js';
import { makeChangeBookingAndNotify } from './usecases/changeBookingAndNotify.js';
import { makeListMyBookings } from './usecases/listMyBookings.js';
import { makeCheckSlotOpen, makeCheckSlotOpenForStaff } from './usecases/checkSlotOpen.js';
import { makeCreateHiker } from './usecases/createHiker.js';
import { makeCreateStaffBooking } from './usecases/createStaffBooking.js';
import { makeCreateStaffSlot } from './usecases/createStaffSlot.js';
import { makeCreateTableSet } from './usecases/createTableSet.js';
import { makeListSlots } from './usecases/listSlots.js';
import { makeListStaffSlots } from './usecases/listStaffSlots.js';
import { makeListTableSets } from './usecases/listTableSets.js';
import { makePreviewSeating } from './usecases/previewSeating.js';
import { makePreviewStaffSeating } from './usecases/previewStaffSeating.js';
import { makeLogin } from './usecases/login.js';
import { makeLogout } from './usecases/logout.js';
import { makeRegister } from './usecases/register.js';
import { makeRequestPasswordReset } from './usecases/requestPasswordReset.js';
import { makeResetPassword } from './usecases/resetPassword.js';
import { makeSearchHikers } from './usecases/searchHikers.js';
import { makeStartSession } from './usecases/startSession.js';

// 3. controllers
import {
  makeChangeBookingController,
  makeCreateBookingController,
  makeListMyBookingsController,
} from './controllers/bookings.js';
import { makeListSlotsController, makeSeatingController } from './controllers/slots.js';
import {
  makeAssignTableSetController,
  makeCreateHikerController,
  makeCreateSlotController,
  makeCreateStaffBookingController,
  makeCreateTableSetController,
  makeListStaffSlotsController,
  makeListTableSetsController,
  makeSearchHikersController,
  makeStaffSeatingController,
} from './controllers/staff.js';
import {
  makeChangePasswordController,
  makeLoginController,
  makeLogoutController,
  makeMeController,
  makeRegisterController,
  makeRequestPasswordResetController,
  makeResetPasswordController,
} from './controllers/auth.js';

// 4. routers
import { makeAuthRouter } from './routes/auth.js';
import { makeBookingsRouter } from './routes/bookings.js';
import { makeSlotsRouter } from './routes/slots.js';
import { makeStaffRouter } from './routes/staff.js';

// the mailer is used by the authentication (the password reset), the bookings and the staff
const mailer = makeMailer(config.mail);

// authentication
const startSession = makeStartSession({ sessions, tokens, clock, sessionTtlMs: config.sessionTtlMs });
const authenticate = makeAuthenticate({ sessions, tokens, clock });
const register = makeRegister({ users, passwordHasher, startSession });
const login = makeLogin({ users, passwordHasher, startSession });
const logout = makeLogout({ sessions, tokens });

const changePassword = makeChangePassword({ users, passwordHasher });
const requestPasswordReset = makeRequestPasswordReset({
  users, passwordResets, tokens, clock, mailer, appUrl: config.appUrl,
});
const resetPassword = makeResetPassword({ passwordResets, passwordHasher, tokens, clock });

const readSessionCookie = makeReadSessionCookie(config.sessionCookieName);
// requireLogin finds who is calling. requireAuth also refuses (403) a hiker who still has to change
// the generated password (MH-07): it is in front of every protected path but `me` and the change of
// the password, which are what that hiker can still do (requireLogin).
const requireLogin = makeRequireAuth(authenticate);
const requireAuth = [requireLogin, makeRequirePasswordChanged(requirePasswordChanged)];

const cookie = { name: config.sessionCookieName, secure: config.cookieSecure };
const authRouter = makeAuthRouter({
  registerController: makeRegisterController({ register, cookie }),
  loginController: makeLoginController({ login, cookie }),
  logoutController: makeLogoutController({ logout, cookie }),
  meController: makeMeController(),
  changePasswordController: makeChangePasswordController({ changePassword }),
  requestPasswordResetController: makeRequestPasswordResetController({ requestPasswordReset }),
  resetPasswordController: makeResetPasswordController({ resetPassword }),
  requireLogin,
});

// slots and bookings
const checkSlotOpen = makeCheckSlotOpen({ clock, hutTimeZone: config.hutTimeZone });
const listSlots = makeListSlots({ slots, clock, hutTimeZone: config.hutTimeZone });
const previewSeating = makePreviewSeating({ slots, checkSlotOpen });
const createBooking = makeCreateBooking({ slots, bookings, checkSlotOpen });
const bookTable = makeBookTable({ createBooking, bookings, mailer });
const listMyBookings = makeListMyBookings({ bookings, clock, hutTimeZone: config.hutTimeZone });
const changeBooking = makeChangeBooking({
  bookings, slots, checkSlotOpen, clock, hutTimeZone: config.hutTimeZone,
});
const changeBookingAndNotify = makeChangeBookingAndNotify({
  changeBooking, bookings, mailer, clock, hutTimeZone: config.hutTimeZone,
});

const slotsRouter = makeSlotsRouter({
  listSlotsController: makeListSlotsController({ listSlots }),
  seatingController: makeSeatingController({ previewSeating }),
});
const bookingsRouter = makeBookingsRouter({
  createBookingController: makeCreateBookingController({ bookTable }),
  listMyBookingsController: makeListMyBookingsController({ listMyBookings }),
  changeBookingController: makeChangeBookingController({ changeBookingAndNotify }),
  requireAuth,
});

// the tables and the slots of the hut, and the reservations for a hiker (staff). The staff can book
// until the meal starts, not only until 2 hours before it (checkSlotOpenForStaff).
const checkSlotOpenForStaff = makeCheckSlotOpenForStaff({ clock, hutTimeZone: config.hutTimeZone });
const createStaffBooking = makeCreateStaffBooking({
  users, slots, bookings, checkSlotOpen: checkSlotOpenForStaff,
});
const bookTableForHiker = makeBookTable({ createBooking: createStaffBooking, bookings, mailer });
const staffRouter = makeStaffRouter({
  createTableSetController: makeCreateTableSetController({
    createTableSet: makeCreateTableSet({ tableSets }),
  }),
  listTableSetsController: makeListTableSetsController({
    listTableSets: makeListTableSets({ tableSets }),
  }),
  createSlotController: makeCreateSlotController({
    createStaffSlot: makeCreateStaffSlot({ slots, tableSets }),
  }),
  listStaffSlotsController: makeListStaffSlotsController({
    listStaffSlots: makeListStaffSlots({ slots, tableSets }),
  }),
  assignTableSetController: makeAssignTableSetController({
    assignTableSet: makeAssignTableSet({ slots, tableSets }),
  }),
  searchHikersController: makeSearchHikersController({
    searchHikers: makeSearchHikers({ users }),
  }),
  createHikerController: makeCreateHikerController({
    createHiker: makeCreateHiker({
      users, passwordHasher, passwordGenerator, mailer, appUrl: config.appUrl,
    }),
  }),
  staffSeatingController: makeStaffSeatingController({
    previewStaffSeating: makePreviewStaffSeating({ slots, checkSlotOpen: checkSlotOpenForStaff }),
  }),
  createStaffBookingController: makeCreateStaffBookingController({ bookTableForHiker }),
  requireAuth,
});

export const app = express();
app.use(express.json());
app.use(readSessionCookie);
app.use('/api', authRouter);
app.use('/api', slotsRouter);
app.use('/api', bookingsRouter);
app.use('/api', staffRouter);

// an /api path no router answers
app.use('/api', (_req, _res, next) => next(new NotFoundError('Resource not found')));

// In Docker the server also serves the built client. Any other page gets index.html, so the
// router of the client works when a page is reloaded or opened from a link.
if (config.clientDir) {
  app.use(express.static(config.clientDir));
  app.get('/{*path}', (_req, res) => res.sendFile('index.html', { root: config.clientDir }));
}

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
  const body = { error: err.name, message: err.message };
  if (err.code !== undefined) body.code = err.code;
  res.status(status).json(body);
});
