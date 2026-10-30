/**
 * Use case: a hiker books the tables the seating preview showed (MH-01).
 *
 * The client sends back the tables of the preview. The server works out again where the party
 * would sit now (domain/seating.js, the same choice as the preview) and books the request only if
 * it is exactly that: the same tables with the same seats. Otherwise it books nothing and answers
 * 409, so a hiker never gets other tables than the ones shown. The client then asks for a new preview.
 *
 * Errors: 403 the user is not a hiker; 422 the slot does not exist on that date, cannot be booked,
 * is closed (less than 2 hours to the meal) or the hiker already has a booking for it;
 * 409 the tables are not the ones now proposed for the party (someone booked in between, or
 * the request was not a preview).
 */
import { ConflictError, ForbiddenError, UnprocessableError } from '../domain/errors.js';
import { ROLES } from '../domain/roles.js';
import { assignSeats, describeSeating } from '../domain/seating.js';

const NOT_THE_PREVIEW = 'The chosen tables are no longer the ones proposed for this party';

const sameTables = (a, b) => a.length === b.length
  && a.every((table, i) => table.tableNumber === b[i].tableNumber && table.seats === b[i].seats);

export const makeCreateBooking = ({ slots, bookings, checkSlotOpen }) =>
  async ({ user, date, slotId, partySize, tables }) => {
    if (user.role !== ROLES.HIKER) throw new ForbiddenError('Only hikers can create bookings');

    const slot = await slots.findByIdAndDate(slotId, date);
    if (!slot) throw new UnprocessableError(`Slot ${slotId} does not exist on ${date}`);
    checkSlotOpen(slot);

    if (await bookings.hasActiveBooking(user.id, slotId)) {
      throw new UnprocessableError('You already have a booking for this slot');
    }

    const free = await slots.findAvailableTablesBySlotId(slotId);
    const proposed = assignSeats(partySize, free);
    const requested = [...tables].sort((x, y) => x.tableNumber - y.tableNumber);
    if (proposed === null || !sameTables(requested, describeSeating(proposed, free))) {
      throw new ConflictError(NOT_THE_PREVIEW);
    }

    try {
      const booking = await bookings.createWithTableAssignments({
        hikerId: user.id,
        slotId,
        partySize,
        tableAssignments: proposed,
      });
      return {
        id: booking.id,
        date,
        slotId,
        partySize,
        tables: requested,
      };
    } catch (error) {
      // The dao checks the seats again with the slot locked: someone may have booked just now.
      if (error.code === 'SEATS_UNAVAILABLE') throw new ConflictError(NOT_THE_PREVIEW);
      if (error.code === 'DUPLICATE_BOOKING') {
        throw new UnprocessableError('You already have a booking for this slot');
      }
      throw error;
    }
  };
