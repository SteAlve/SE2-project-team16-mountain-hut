/**
 * USE CASES: here goes one function per operation of the system, roughly one per story.
 * It receives what it needs (dao, clock, ...) as parameters, handed over by app.js,
 * applies the rules of domain/ and throws domain errors.
 * Not here: req/res, status codes, SQL, Date (use the injected clock), imports except domain/.
 *
 * THE CODE BELOW IS JUST AN EXAMPLE (story MH-01: a hiker books a table).
 * Delete this file when the first real one exists.
 */
import { isBookingOpen } from '../domain/bookingWindow.js';
import { ConflictError } from '../domain/errors.js';

export const makeBookTable = ({ slots, bookings, clock }) => async (user, { slotId, partySize }) => {
  const slot = await slots.findById(slotId);
  if (!isBookingOpen(slot.startsAt, clock.now())) {
    throw new ConflictError('Bookings for this slot are closed');
  }
  return bookings.insert({ hikerId: user.id, slotId, partySize });
};
