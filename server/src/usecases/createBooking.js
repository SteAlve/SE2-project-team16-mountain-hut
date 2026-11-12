/**
 * Use case: a hiker books the tables the seating preview showed (MH-01), with the dietary needs of
 * the guests, if any (MH-05). The rules of the booking itself (the tables, the seats, the 409 codes)
 * are in reserveTables.js, shared with the booking an employee makes for a hiker (MH-07).
 *
 * Here: only hikers book (403), booking closes 2 hours before the meal (422, through the
 * `checkSlotOpen` that app.js hands over), and the booking is for the hiker who is logged in.
 *
 * Errors: 403 the user is not a hiker; 404 the slot does not exist; 422 the slot cannot be booked,
 * is closed (less than 2 hours to the meal) or the hiker already has a booking for it;
 * 409 with a code (NO_SEATS or TABLES_CHANGED, see reserveTables.js).
 */
import { ForbiddenError } from '../domain/errors.js';
import { ROLES } from '../domain/roles.js';
import { makeReserveTables } from './reserveTables.js';

export const makeCreateBooking = ({ slots, bookings, checkSlotOpen }) => {
  const reserveTables = makeReserveTables({
    slots,
    bookings,
    checkSlotOpen,
    alreadyBookedMessage: 'You already have a booking for this slot',
  });

  return async ({ user, ...booking }) => {
    if (user.role !== ROLES.HIKER) throw new ForbiddenError('Only hikers can create bookings');
    return reserveTables({ hikerId: user.id, ...booking });
  };
};
