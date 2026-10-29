/**
 * Use case: a hiker books a table (MH-01).
 *
 * Errors: 403 the user is not a hiker; 422 the slot does not exist on that date, cannot be booked,
 * is closed (less than 2 hours to the meal) or the hiker already has a booking for it;
 * 409 the party does not fit in the free seats.
 *
 * The seats are chosen here (domain/seating.js) from the free seats read just before. The dao
 * checks them again with the slot locked, so if another booking took them in between, the choice
 * is made again, a few times, before answering 409.
 */
import { isBookingOpen } from '../domain/bookingWindow.js';
import { ConflictError, ForbiddenError, UnprocessableError } from '../domain/errors.js';
import { ROLES } from '../domain/roles.js';
import { assignSeats } from '../domain/seating.js';

const MAX_ATTEMPTS = 3;

export const makeCreateBooking = ({ slots, bookings, clock, hutTimeZone }) =>
  async ({ user, date, slotId, partySize }) => {
    if (user.role !== ROLES.HIKER) throw new ForbiddenError('Only hikers can create bookings');

    const slot = await slots.findByIdAndDate(slotId, date);
    if (!slot) throw new UnprocessableError(`Slot ${slotId} does not exist on ${date}`);
    if (slot.tableSetId === null) {
      throw new UnprocessableError(`Slot ${slotId} is not available for booking`);
    }

    const mealStartsAt = clock.at(date, slot.startsAt, hutTimeZone);
    if (!isBookingOpen(mealStartsAt, clock.now())) {
      throw new UnprocessableError('Bookings close two hours before the meal');
    }

    if (await bookings.hasActiveBooking(user.id, slotId)) {
      throw new UnprocessableError('You already have a booking for this slot');
    }

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const tableAssignments = assignSeats(partySize, await slots.findAvailableTablesBySlotId(slotId));
      if (tableAssignments === null) throw new ConflictError('Not enough free seats');

      try {
        const booking = await bookings.createWithTableAssignments({
          hikerId: user.id,
          slotId,
          partySize,
          tableAssignments,
        });
        return { id: booking.id, date, slotId, partySize };
      } catch (error) {
        if (error.code === 'DUPLICATE_BOOKING') {
          throw new UnprocessableError('You already have a booking for this slot');
        }
        if (error.code !== 'SEATS_UNAVAILABLE') throw error;
      }
    }

    throw new ConflictError('Not enough free seats');
  };
