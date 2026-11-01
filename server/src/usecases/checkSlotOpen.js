/**
 * Use case helper: can this slot be booked now? Shared by the booking and by the seating preview,
 * so both answer the same. Throws UnprocessableError (422) when the slot has no tables or booking
 * has closed (less than 2 hours to the meal). `slot` is a row of the slot dao.
 */
import { isBookingOpen } from '../domain/bookingWindow.js';
import { UnprocessableError } from '../domain/errors.js';

export const makeCheckSlotOpen = ({ clock, hutTimeZone }) => (slot) => {
  if (slot.tableSetId === null) {
    throw new UnprocessableError(`Slot ${slot.slotId} is not available for booking`);
  }

  const mealStartsAt = clock.at(slot.serviceDate, slot.startsAt, hutTimeZone);
  if (!isBookingOpen(mealStartsAt, clock.now())) {
    throw new UnprocessableError('Bookings close two hours before the meal');
  }
};
