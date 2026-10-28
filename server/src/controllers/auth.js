/**
 * Controllers of the authentication: register, login, logout and "who am I".
 * The cookie is an HTTP detail, so it is set and cleared here and never reaches a use case.
 * `cookie` is { name, secure }, handed over by app.js.
 */
import { parseLogin, parseRegister, toUserDto } from '../dto/auth.js';

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
