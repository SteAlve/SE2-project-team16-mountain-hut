/**
 * Controllers of the authentication: register, login, logout and "who am I", and the passwords
 * (MH-07): change it, ask for a link to choose a new one, choose it with the link.
 * The cookie is an HTTP detail, so it is set and cleared here and never reaches a use case.
 * `cookie` is { name, secure }, handed over by app.js.
 */
import {
  parseChangePassword,
  parseForgotPassword,
  parseLogin,
  parseRegister,
  parseResetPassword,
  toUserDto,
} from '../dto/auth.js';

const cookieOptions = (cookie) => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: cookie.secure,
  path: '/',
});

const setSessionCookie = (res, cookie, session) => {
  res.cookie(cookie.name, session.id, { ...cookieOptions(cookie), expires: session.expiresAt });
};

export const makeRegisterController = ({ register, cookie }) => async (req, res) => {
  const { user, session } = await register(parseRegister(req.body));
  setSessionCookie(res, cookie, session);
  res.status(201).json(toUserDto(user));
};

export const makeLoginController = ({ login, cookie }) => async (req, res) => {
  const { user, session } = await login(parseLogin(req.body));
  setSessionCookie(res, cookie, session);
  res.status(200).json(toUserDto(user));
};

export const makeLogoutController = ({ logout, cookie }) => async (req, res) => {
  await logout(req.sessionId);
  res.clearCookie(cookie.name, cookieOptions(cookie));
  res.status(204).end();
};

// requireAuth has already found the user and put it in req.user.
export const makeMeController = () => (req, res) => {
  res.status(200).json(toUserDto(req.user));
};

// POST /api/auth/change-password: the logged-in user changes the password and stays logged in.
export const makeChangePasswordController = ({ changePassword }) => async (req, res) => {
  await changePassword({ user: req.user, ...parseChangePassword(req.body) });
  res.status(204).end();
};

// POST /api/auth/password-reset-requests: 204 whether the email has an account or not.
export const makeRequestPasswordResetController = ({ requestPasswordReset }) => async (req, res) => {
  await requestPasswordReset(parseForgotPassword(req.body));
  res.status(204).end();
};

// POST /api/auth/password-resets: the new password with the link of the email. It does not log in.
export const makeResetPasswordController = ({ resetPassword }) => async (req, res) => {
  await resetPassword(parseResetPassword(req.body));
  res.status(204).end();
};
