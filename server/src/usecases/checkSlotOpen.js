/**
 * Use case helper: can this slot be booked now? Shared by the booking and by the seating preview,
 * so both answer the same. Throws UnprocessableError (422) when the slot has no tables or booking
 * has closed. `slot` is a row of the slot dao.
 *
 * There are two versions, which differ only in when booking closes:
 *   makeCheckSlotOpen          a hiker: 2 hours before the meal (MH-01)
 *   makeCheckSlotOpenForStaff  an employee or the warden, who enters a reservation for a hiker:
 *                              until the meal starts (MH-07)
 */
import { isBookingOpen, isOpenForStaff } from '../domain/bookingWindow.js';
import { UnprocessableError } from '../domain/errors.js';

const makeCheck = ({ clock, hutTimeZone, isOpen, closedMessage }) => (slot) => {
  if (slot.tableSetId === null) {
    throw new UnprocessableError(`Slot ${slot.slotId} is not available for booking`);
  }

  const mealStartsAt = clock.at(slot.serviceDate, slot.startsAt, hutTimeZone);
  if (!isOpen(mealStartsAt, clock.now())) {
    throw new UnprocessableError(closedMessage);
  }
};

export const makeCheckSlotOpen = ({ clock, hutTimeZone }) => makeCheck({
  clock,
  hutTimeZone,
  isOpen: isBookingOpen,
  closedMessage: 'Bookings close two hours before the meal',
});

export const makeCheckSlotOpenForStaff = ({ clock, hutTimeZone }) => makeCheck({
  clock,
  hutTimeZone,
  isOpen: isOpenForStaff,
  closedMessage: 'The meal has already started',
});
