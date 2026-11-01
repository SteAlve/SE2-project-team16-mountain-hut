/**
 * DTO of the authentication: validates what arrives in the body of sign up and login (a wrong
 * body throws a ValidationError, 400) and shapes the user that goes out. The password hash never
 * leaves: toUserDto copies only the public fields.
 */
import { ValidationError } from '../domain/errors.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9 ]*[0-9][0-9 ]*$/; // digits and spaces, a leading + allowed
const MIN_PASSWORD_LENGTH = 8;

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

const requireObject = (body) => {
  if (!isObject(body)) throw new ValidationError('Request body must be a JSON object');
  return body;
};

const rejectUnknown = (body, allowed) => {
  const unknown = Object.keys(body).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) throw new ValidationError(`Unknown field: ${unknown[0]}`);
};

const requireText = (body, field) => {
  const value = body[field];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ValidationError(`${field} is required`);
  }
  return value.trim();
};

// Emails are compared without regard to letter case, so they are stored in lowercase.
const normalizeEmail = (email) => email.toLowerCase();

export function parseRegister(body) {
  requireObject(body);
  rejectUnknown(body, ['firstName', 'lastName', 'email', 'phone', 'password']);

  const firstName = requireText(body, 'firstName');
  const lastName = requireText(body, 'lastName');
  const email = normalizeEmail(requireText(body, 'email'));
  if (!EMAIL_PATTERN.test(email)) throw new ValidationError('email must be a valid email');

  let phone = null;
  if (body.phone !== undefined && body.phone !== null && body.phone !== '') {
    if (typeof body.phone !== 'string' || !PHONE_PATTERN.test(body.phone.trim())) {
      throw new ValidationError('phone must contain only digits, spaces and a leading +');
    }
    phone = body.phone.trim();
  }

  const { password } = body;
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError(`password must have at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  return { firstName, lastName, email, phone, password };
}

export function parseLogin(body) {
  requireObject(body);
  rejectUnknown(body, ['email', 'password']);

  const { email, password } = body;
  if (typeof email !== 'string' || email.trim() === '' || typeof password !== 'string' || password === '') {
    throw new ValidationError('email and password are required');
  }

  return { email: normalizeEmail(email.trim()), password };
}

export const toUserDto = ({ id, firstName, lastName, email, phone, role }) => ({
  id,
  firstName,
  lastName,
  email,
  phone: phone ?? null,
  role,
});
