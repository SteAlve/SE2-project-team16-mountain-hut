/**
 * Use case: the slots of a date that a hiker can still book. A slot is listed when it has free
 * seats (the dao) and it is not closed yet: booking closes 2 hours before the meal, so a listed
 * slot is one that createBooking would accept. `date` is 'YYYY-MM-DD'.
 */
import { isBookingOpen } from '../domain/bookingWindow.js';

export const makeListBookableSlots = ({ slots, clock, hutTimeZone }) => async (date) => {
  const now = clock.now();
  const withFreeSeats = await slots.findBookableByDate(date);
  return withFreeSeats.filter((slot) =>
    isBookingOpen(clock.at(date, slot.startsAt, hutTimeZone), now));
};
