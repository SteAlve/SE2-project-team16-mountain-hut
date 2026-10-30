/**
 * Use case: where would a party sit in a slot? It answers with the tables the booking would use,
 * without booking anything: the same choice as createBooking (domain/seating.js), so the hiker can
 * check it before confirming. Public. Nothing is held: if someone books first, the booking chooses
 * again among the seats that are left, or answers 409.
 *
 * Errors: 404 the slot does not exist; 422 it cannot be booked or is closed; 409 the party does not fit.
 */
import { ConflictError, NotFoundError } from '../domain/errors.js';
import { assignSeats, describeSeating } from '../domain/seating.js';

export const makePreviewSeating = ({ slots, checkSlotOpen }) => async ({ slotId, partySize }) => {
  const slot = await slots.findById(slotId);
  if (!slot) throw new NotFoundError(`Slot ${slotId} not found`);
  checkSlotOpen(slot);

  const tables = await slots.findAvailableTablesBySlotId(slotId);
  const assignments = assignSeats(partySize, tables);
  if (assignments === null) throw new ConflictError('Not enough free seats', { code: 'NO_SEATS' });

  return { slotId, partySize, tables: describeSeating(assignments, tables) };
};
