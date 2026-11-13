/**
 * Checks of single input values, shared by the DTOs. A wrong value throws a ValidationError (400).
 * Only the DTOs use it: like them, it imports nothing from the project but domain/errors.js.
 */
import { ValidationError } from '../domain/errors.js';

const POSITIVE_INTEGER_TEXT = /^[1-9]\d*$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9 ]*[0-9][0-9 ]*$/; // digits and spaces, a leading + allowed
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const requireObject = (value, message = 'Request body must be a JSON object') => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ValidationError(message);
  }
  return value;
};

export const rejectUnknownFields = (object, allowed, where = '') => {
  const unknown = Object.keys(object).find((key) => !allowed.includes(key));
  if (unknown !== undefined) throw new ValidationError(`Unknown field${where}: ${unknown}`);
};

// A text of the body that cannot be missing or blank, without the spaces around it.
export const requireText = (body, field) => {
  const value = body[field];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ValidationError(`${field} is required`);
  }
  return value.trim();
};

// An email of the body, required. Emails are compared without regard to letter case, so they are
// kept in lowercase.
export const requireEmail = (body, field = 'email') => {
  const email = requireText(body, field).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) throw new ValidationError(`${field} must be a valid email`);
  return email;
};

// The phone of the body, which can be left out: not sent, null and '' all mean no phone (null).
export const optionalPhone = (body) => {
  const { phone } = body;
  if (phone === undefined || phone === null || phone === '') return null;
  if (typeof phone !== 'string' || !PHONE_PATTERN.test(phone.trim())) {
    throw new ValidationError('phone must contain only digits, spaces and a leading +');
  }
  return phone.trim();
};

export const requirePositiveInteger = (value, field) => {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new ValidationError(`${field} must be a positive integer`);
  }
  return value;
};

// A value of the URL (a path parameter or a query string value) is text.
export const requirePositiveIntegerText = (value, field) => {
  if (typeof value !== 'string' || !POSITIVE_INTEGER_TEXT.test(value)) {
    throw new ValidationError(`${field} must be a positive integer`);
  }
  return requirePositiveInteger(Number(value), field);
};

// 'YYYY-MM-DD', a day that exists (not 2026-02-30).
export const requireDate = (value, field) => {
  const match = typeof value === 'string' ? DATE_PATTERN.exec(value) : null;
  const [year, month, day] = match ? match.slice(1).map(Number) : [];
  const check = match ? new Date(Date.UTC(year, month - 1, day)) : null;
  const exists = check !== null
    && check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day;
  if (!exists) throw new ValidationError(`${field} must be a valid date`);
  return value;
};

// 'HH:MM', 00:00 to 23:59.
export const requireTime = (value, field) => {
  if (typeof value !== 'string' || !TIME_PATTERN.test(value)) {
    throw new ValidationError(`${field} must be a valid time (HH:MM)`);
  }
  return value;
};

// '12:00:00' (from the database) -> '12:00'
export const toHourMinute = (time) => time.slice(0, 5);
