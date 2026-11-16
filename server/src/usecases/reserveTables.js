/**
 * Use case: book the tables the seating preview showed, for a hiker (MH-01, MH-05, MH-07), with the
 * dietary needs of the guests, if any. They are saved with the booking, in one transaction.
 *
 * It is the common part of the two ways to book: createBooking (a hiker books for themselves) and
 * createStaffBooking (an employee or the warden books for a hiker). Who may book, and when booking
 * closes, are decided by the caller: it hands over `checkSlotOpen`, and says what to answer when the
 * hiker already has a booking for the slot.
 *
 * The client sends back the tables of the preview. The server works out again where the party
 * would sit now (domain/seating.js, the same choice as the preview) and books the request only if
 * it is exactly that: the same tables with the same seats. Otherwise it books nothing and answers
 * 409, so nobody gets other tables than the ones shown.
 *
 * Errors: 404 the slot does not exist; 422 the slot cannot be booked, is closed or the hiker already
 * has a booking for it; 409 with a code, so the client can tell the two cases apart:
 *   NO_SEATS        the party does not fit in the free seats any more: choose another slot
 *   TABLES_CHANGED  the party still fits, but not at these tables: ask for a new preview
 */
import { checkDietaryNeeds } from '../domain/dietaryNeeds.js';
import { ConflictError, NotFoundError, UnprocessableError } from '../domain/errors.js';
import { assignSeats, describeSeating } from '../domain/seating.js';

const noSeats = () => new ConflictError('Not enough free seats', { code: 'NO_SEATS' });
const tablesChanged = () => new ConflictError(
  'The chosen tables are no longer the ones proposed for this party',
  { code: 'TABLES_CHANGED' },
);

const sameTables = (a, b) => a.length === b.length
  && a.every((table, i) => table.tableNumber === b[i].tableNumber && table.seats === b[i].seats);

export const makeReserveTables = ({ slots, bookings, checkSlotOpen, alreadyBookedMessage }) =>
  async ({ hikerId, slotId, partySize, tables, requirements = [] }) => {
    checkDietaryNeeds(requirements);

    const slot = await slots.findById(slotId);
    if (!slot) throw new NotFoundError(`Slot ${slotId} not found`);
    checkSlotOpen(slot);

    if (await bookings.hasActiveBooking(hikerId, slotId)) {
      throw new UnprocessableError(alreadyBookedMessage);
    }

    const free = await slots.findAvailableTablesBySlotId(slotId);
    const proposed = assignSeats(partySize, free);
    if (proposed === null) throw noSeats();
    const requested = [...tables].sort((x, y) => x.tableNumber - y.tableNumber);
    if (!sameTables(requested, describeSeating(proposed, free))) throw tablesChanged();

    try {
      const booking = await bookings.createWithTableAssignments({
        hikerId,
        slotId,
        partySize,
        tableAssignments: proposed,
        requirements,
      });
      return {
        id: booking.id, date: slot.serviceDate, slotId, partySize, tables: requested, requirements: booking.requirements,
      };
    } catch (error) {
      // The dao checks the seats again with the slot locked: someone may have booked just now.
      if (error.code === 'SEATS_UNAVAILABLE') throw tablesChanged();
      if (error.code === 'DUPLICATE_BOOKING') throw new UnprocessableError(alreadyBookedMessage);
      throw error;
    }
  };
