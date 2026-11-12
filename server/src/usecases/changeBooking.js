/**
 * Use case: a hiker changes their booking (MH-06): the slot, the party size, the dietary needs, or
 * some of them. What is not sent stays as it is.
 *
 * Rules:
 *   - only the hiker who made the booking can change it (another booking answers 404, as if it did
 *     not exist), and not once it is cancelled;
 *   - changes close 48 hours before the meal, for the booking and for the slot it moves to
 *     (domain/bookingWindow.js);
 *   - a new slot or party size is seated again like a new booking in that slot (product owner,
 *     issue #38). The seats of the booking count as free, so it can keep or reuse them. The server
 *     chooses the tables: there is no preview to confirm, the change succeeds or answers 409;
 *   - only new dietary needs: the seats are not checked, the tables stay;
 *   - there can be at most one line of dietary needs per person of the party.
 *
 * Errors: 403 not a hiker; 404 the booking or the new slot does not exist; 422 changes are closed,
 * the booking was cancelled, the new slot cannot be booked, the hiker already has a booking for the
 * new slot, or more lines of needs than people; 409 NO_SEATS the party does not fit any more;
 * 409 BOOKING_CHANGED another change of the same booking was saved while this one was checked
 * (the booking is read before it is locked, so the dao checks it did not move in between).
 */
import { checkDietaryNeeds } from '../domain/dietaryNeeds.js';
import { isChangeOpen } from '../domain/bookingWindow.js';
import { ConflictError, ForbiddenError, NotFoundError, UnprocessableError } from '../domain/errors.js';
import { ROLES } from '../domain/roles.js';
import { assignSeats } from '../domain/seating.js';

const noSeats = () => new ConflictError('Not enough free seats', { code: 'NO_SEATS' });
const changesClosed = () => new UnprocessableError('Bookings can be changed until 48 hours before the meal');
const changedMeanwhile = () => new ConflictError(
  'The booking was changed in the meantime: reload it and try again',
  { code: 'BOOKING_CHANGED' },
);
const alreadyBooked = () => new UnprocessableError('You already have a booking for this slot');

export const makeChangeBooking = ({ bookings, slots, checkSlotOpen, clock, hutTimeZone }) =>
  async ({ user, bookingId, slotId, partySize, requirements }) => {
    if (user.role !== ROLES.HIKER) throw new ForbiddenError('Only hikers can change bookings');
    if (requirements !== undefined) checkDietaryNeeds(requirements);

    const booking = await bookings.findById(bookingId);
    if (!booking || booking.hikerId !== user.id) throw new NotFoundError(`Booking ${bookingId} not found`);
    if (booking.cancelled) throw new UnprocessableError('This booking was cancelled');

    const now = clock.now();
    const changeOpen = (date, startsAt) => isChangeOpen(clock.at(date, startsAt, hutTimeZone), now);
    if (!changeOpen(booking.date, booking.startsAt)) throw changesClosed();

    const newSlotId = slotId ?? booking.slotId;
    const newPartySize = partySize ?? booking.partySize;
    const newRequirements = requirements ?? booking.requirements;
    if (newRequirements.length > newPartySize) {
      throw new UnprocessableError('There can be at most one requirement per person of the party');
    }

    let seats = null;
    if (newSlotId !== booking.slotId || newPartySize !== booking.partySize) {
      if (newSlotId !== booking.slotId) {
        const slot = await slots.findById(newSlotId);
        if (!slot) throw new NotFoundError(`Slot ${newSlotId} not found`);
        checkSlotOpen(slot);
        if (!changeOpen(slot.serviceDate, slot.startsAt)) throw changesClosed();
        if (await bookings.hasActiveBooking(user.id, newSlotId)) throw alreadyBooked();
      }

      const free = await slots.findAvailableTablesBySlotId(newSlotId, { exceptBookingId: bookingId });
      const tableAssignments = assignSeats(newPartySize, free);
      if (tableAssignments === null) throw noSeats();
      seats = { slotId: newSlotId, partySize: newPartySize, tableAssignments };
    }

    try {
      return await bookings.updateBooking({
        bookingId,
        expected: { slotId: booking.slotId, partySize: booking.partySize },
        seats,
        requirements: requirements ?? null,
      });
    } catch (error) {
      // The dao checks again with the slot locked: someone may have booked or changed just now.
      if (error.code === 'SEATS_UNAVAILABLE') throw noSeats();
      if (error.code === 'DUPLICATE_BOOKING') throw alreadyBooked();
      if (error.code === 'BOOKING_NOT_FOUND') throw new UnprocessableError('This booking was cancelled');
      if (error.code === 'BOOKING_CHANGED' || error.code === 'TOO_MANY_REQUIREMENTS') throw changedMeanwhile();
      throw error;
    }
  };
