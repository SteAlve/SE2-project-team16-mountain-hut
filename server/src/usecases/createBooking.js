/**
 * Use case: a hiker books the tables the seating preview showed (MH-01).
 *
 * The client sends back the tables of the preview. The server works out again where the party
 * would sit now (domain/seating.js, the same choice as the preview) and books the request only if
 * it is exactly that: the same tables with the same seats. Otherwise it books nothing and answers
 * 409, so a hiker never gets other tables than the ones shown.
 *
 * Errors: 403 the user is not a hiker; 404 the slot does not exist; 422 the slot cannot be booked,
 * is closed (less than 2 hours to the meal) or the hiker already has a booking for it;
 * 409 with a code, so the client can tell the two cases apart:
 *   NO_SEATS        the party does not fit in the free seats any more: choose another slot
 *   TABLES_CHANGED  the party still fits, but not at these tables: ask for a new preview
 */
import { ConflictError, ForbiddenError, NotFoundError, UnprocessableError } from '../domain/errors.js';
import { ROLES } from '../domain/roles.js';
import { assignSeats, describeSeating } from '../domain/seating.js';

const noSeats = () => new ConflictError('Not enough free seats', { code: 'NO_SEATS' });
const tablesChanged = () => new ConflictError(
  'The chosen tables are no longer the ones proposed for this party',
  { code: 'TABLES_CHANGED' },
);

const sameTables = (a, b) => a.length === b.length
  && a.every((table, i) => table.tableNumber === b[i].tableNumber && table.seats === b[i].seats);

export const makeCreateBooking = ({ slots, bookings, checkSlotOpen }) =>
  async ({ user, slotId, partySize, tables }) => {
    if (user.role !== ROLES.HIKER) throw new ForbiddenError('Only hikers can create bookings');

    const slot = await slots.findById(slotId);
    if (!slot) throw new NotFoundError(`Slot ${slotId} not found`);
    checkSlotOpen(slot);

    if (await bookings.hasActiveBooking(user.id, slotId)) {
      throw new UnprocessableError('You already have a booking for this slot');
    }

    const free = await slots.findAvailableTablesBySlotId(slotId);
    const proposed = assignSeats(partySize, free);
    if (proposed === null) throw noSeats();
    const requested = [...tables].sort((x, y) => x.tableNumber - y.tableNumber);
    if (!sameTables(requested, describeSeating(proposed, free))) throw tablesChanged();

    try {
      const booking = await bookings.createWithTableAssignments({
        hikerId: user.id,
        slotId,
        partySize,
        tableAssignments: proposed,
      });
      return { id: booking.id, date: slot.serviceDate, slotId, partySize, tables: requested };
    } catch (error) {
      // The dao checks the seats again with the slot locked: someone may have booked just now.
      if (error.code === 'SEATS_UNAVAILABLE') throw tablesChanged();
      if (error.code === 'DUPLICATE_BOOKING') {
        throw new UnprocessableError('You already have a booking for this slot');
      }
      throw error;
    }
  };
