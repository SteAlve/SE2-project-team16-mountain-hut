/**
 * Use case: an employee or the warden books the tables of the seating preview for a hiker (MH-07),
 * for example for someone who phones or arrives at the hut. The hiker can be a regular account or a
 * temporary one. The dietary needs of the guests can be given too (MH-05).
 *
 * It works like the booking of a hiker (reserveTables.js: the same tables check, the same 409 codes),
 * with two differences: the booking is for `hikerId`, not for the user who is logged in, and the
 * only time limit is that the meal has not started (the `checkSlotOpen` that app.js hands over is
 * makeCheckSlotOpenForStaff, not the 2-hour rule of the hikers).
 *
 * Errors: 403 the user is not staff; 404 the slot or the hiker does not exist (a user who is not a
 * hiker counts as a hiker that does not exist); 422 the slot cannot be booked, has started or the
 * hiker already has a booking for it; 409 with a code (NO_SEATS or TABLES_CHANGED).
 */
import { NotFoundError } from '../domain/errors.js';
import { makeReserveTables } from './reserveTables.js';
import { requireStaff } from './requireStaff.js';

export const makeCreateStaffBooking = ({ users, slots, bookings, checkSlotOpen }) => {
  const reserveTables = makeReserveTables({
    slots,
    bookings,
    checkSlotOpen,
    alreadyBookedMessage: 'The hiker already has a booking for this slot',
  });

  return async ({ user, hikerId, ...booking }) => {
    requireStaff(user);

    const hiker = await users.findHikerById(hikerId);
    if (hiker === null) throw new NotFoundError(`Hiker ${hikerId} not found`);

    return reserveTables({ hikerId: hiker.id, ...booking });
  };
};
