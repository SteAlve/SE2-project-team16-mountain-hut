/**
 * Use case: the staff deletes the menu of a slot (MH-10). Only before the slot starts: the menus of
 * the slots that have started stay as they are (PO issue 59). The slot is left with no menu, and the
 * menu is no longer listed among the previous menus, unless another slot has the same text.
 * Deleting the menu of a slot that has none is not an error: the result is the same.
 *
 * Errors: 403 the user is not staff; 404 the slot does not exist; 422 the slot has started.
 */
import { NotFoundError } from '../domain/errors.js';
import { requireMenuOpen } from './requireMenuOpen.js';
import { requireStaff } from './requireStaff.js';

export const makeDeleteSlotMenu = ({ slots, clock, hutTimeZone }) => async ({ user, slotId }) => {
  requireStaff(user);

  const slot = await slots.findMenuById(slotId);
  if (slot === null) throw new NotFoundError(`Slot ${slotId} not found`);
  requireMenuOpen(slot, { clock, hutTimeZone });

  if (!(await slots.deleteMenu(slotId))) throw new NotFoundError(`Slot ${slotId} not found`);
};
