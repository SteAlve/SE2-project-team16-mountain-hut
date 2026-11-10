/**
 * Use case: the employee looks for a hiker who is already in the system, to reserve for them (MH-07).
 * The text can be any part of the name, the email or the phone, in any letter case. Only regular
 * accounts are listed: not the temporary hikers (each quick entry makes a new one), not the staff.
 * At most 20 come back, by last name and first name: a longer text narrows the list.
 *
 * Errors: 400 the text has fewer than 2 characters; 403 the user is not staff.
 */
import { ValidationError } from '../domain/errors.js';
import { requireStaff } from './requireStaff.js';

const MIN_TEXT_LENGTH = 2;
const MAX_RESULTS = 20;

export const makeSearchHikers = ({ users }) => async ({ user, text }) => {
  requireStaff(user);

  const trimmed = text.trim();
  if (trimmed.length < MIN_TEXT_LENGTH) {
    throw new ValidationError(`The text must have at least ${MIN_TEXT_LENGTH} characters`);
  }

  return users.searchHikers(trimmed, MAX_RESULTS);
};
