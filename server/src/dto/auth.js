/**
 * DTO of the authentication: validates what arrives in the body of sign up, login, the change of
 * the password and the password reset (a wrong body throws a ValidationError, 400) and shapes the
 * user that goes out. The password hash never leaves: toUserDto copies only the public fields.
 */
import { ValidationError } from '../domain/errors.js';
import {
  optionalPhone,
  rejectUnknownFields,
  requireEmail,
  requireObject,
  requireText,
} from './fields.js';

const MIN_PASSWORD_LENGTH = 8;

// A password that somebody chooses: at least 8 characters, spaces included.
const requireNewPassword = (body, field) => {
  const password = body[field];
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError(`${field} must have at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  return password;
};

export function parseRegister(body) {
  requireObject(body);
  rejectUnknownFields(body, ['firstName', 'lastName', 'email', 'phone', 'password']);

  return {
    firstName: requireText(body, 'firstName'),
    lastName: requireText(body, 'lastName'),
    email: requireEmail(body),
    phone: optionalPhone(body),
    password: requireNewPassword(body, 'password'),
  };
}

export function parseLogin(body) {
  requireObject(body);
  rejectUnknownFields(body, ['email', 'password']);

  const { email, password } = body;
  if (typeof email !== 'string' || email.trim() === '' || typeof password !== 'string' || password === '') {
    throw new ValidationError('email and password are required');
  }

  return { email: email.trim().toLowerCase(), password };
}

// POST /api/auth/change-password. The current password is not checked for its length: it is only
// compared with the stored one.
export function parseChangePassword(body) {
  requireObject(body);
  rejectUnknownFields(body, ['currentPassword', 'newPassword']);

  const { currentPassword } = body;
  if (typeof currentPassword !== 'string' || currentPassword === '') {
    throw new ValidationError('currentPassword is required');
  }
  return { currentPassword, newPassword: requireNewPassword(body, 'newPassword') };
}

// POST /api/auth/password-reset-requests
export function parseForgotPassword(body) {
  requireObject(body);
  rejectUnknownFields(body, ['email']);
  return { email: requireEmail(body) };
}

// POST /api/auth/password-resets. The token is the one of the link of the email: it is sent back as
// it is, whether it is a real one is for the use case to say.
export function parseResetPassword(body) {
  requireObject(body);
  rejectUnknownFields(body, ['token', 'newPassword']);

  const { token } = body;
  if (typeof token !== 'string' || token === '') throw new ValidationError('token is required');
  return { token, newPassword: requireNewPassword(body, 'newPassword') };
}

export const toUserDto = ({ id, firstName, lastName, email, phone, role, mustChangePassword }) => ({
  id,
  firstName,
  lastName,
  email,
  phone: phone ?? null,
  role,
  mustChangePassword,
});
