/**
 * Use case: the menu of one slot, as hikers see it on Book a table, Check availability and My bookings
 * (MH-10, MH-11). Public, like the list of the slots: a visitor checks the availability before
 * logging in. menu is null when the slot has no menu yet: the slot can still be booked.
 *
 * Errors: 404 the slot does not exist.
 */
import { NotFoundError } from '../domain/errors.js';
import { describeSlotMenu } from '../domain/slotMenu.js';

export const makeGetSlotMenu = ({ slots }) => async ({ slotId }) => {
  const slot = await slots.findMenuById(slotId);
  if (slot === null) throw new NotFoundError(`Slot ${slotId} not found`);
  return describeSlotMenu(slot);
};
