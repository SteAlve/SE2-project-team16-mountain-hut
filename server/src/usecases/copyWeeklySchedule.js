/**
 * Use case: an employee or the warden copies one seven-day schedule into one or more destination
 * intervals (MH-09). Each destination interval contains one or more whole seven-day periods.
 * The DAO performs the copy atomically and checks the destination again while it is locked, so a
 * booking arriving after the request was validated still prevents the replacement.
 *
 * Errors: 403 not staff; 400 invalid or empty source period; 409 the destination has active bookings.
 */
import { ConflictError, ValidationError } from '../domain/errors.js';
import { requireStaff } from './requireStaff.js';

const INVALID_REQUEST_CODES = new Set([
  'INVALID_WEEK_START',
  'INVALID_DESTINATION_INTERVAL',
  'OVERLAPPING_WEEKS',
  'EMPTY_SOURCE_WEEK',
]);

export const makeCopyWeeklySchedule = ({ slots }) => async ({
  user,
  sourceStart,
  destinationIntervals,
}) => {
  requireStaff(user);

  try {
    return await slots.copyScheduleIntervals({ sourceStart, destinationIntervals });
  } catch (error) {
    if (INVALID_REQUEST_CODES.has(error.code)) {
      throw new ValidationError(error.message);
    }
    if (error.code === 'WEEK_HAS_BOOKINGS') {
      throw new ConflictError(error.message, { code: error.code });
    }
    throw error;
  }
};
