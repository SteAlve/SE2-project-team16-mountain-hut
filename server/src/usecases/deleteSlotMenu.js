/**
 * Use case: the staff deletes the menu of a slot (MH-10). Only until the slot starts: the menu of a
 * slot that has started stays as it is (product owner, SE2-Polito/AY26-27-Mountain-Hut#59,
 * checkMenuOpen). Only this slot loses it: the same text on other slots stays. Deleting the menu of a
 * slot that has none is not an error: the slot ends up with no menu either way.
 *
 * Errors: 403 the user is not staff; 404 the slot does not exist; 422 MENU_LOCKED the slot has started.
 */
import { NotFoundError } from '../domain/errors.js';
import { requireStaff } from './requireStaff.js';

export const makeDeleteSlotMenu = ({ slots, checkMenuOpen }) => async ({ user, slotId }) => {
  requireStaff(user);

  const slot = await slots.findMenuById(slotId);
  if (slot === null) throw new NotFoundError(`Slot ${slotId} not found`);
  checkMenuOpen(slot);

  if (!(await slots.deleteMenu(slotId))) throw new NotFoundError(`Slot ${slotId} not found`);
};
