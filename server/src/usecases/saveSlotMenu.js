/**
 * Use case: the staff writes or changes the menu of a slot (MH-10). The menu replaces the one the
 * slot had, if any: when two employees save the same menu, the last one wins. A menu started from a
 * previous one is a copy, so saving it changes only this slot (SE2-Polito/AY26-27-Mountain-Hut#39).
 *
 * Errors: 403 the user is not staff; 400 the menu breaks a rule (domain/menu.js); 404 the slot does
 * not exist.
 */
import { NotFoundError } from '../domain/errors.js';
import { normalizeMenu } from '../domain/menu.js';
import { describeSlotMenu } from '../domain/slotMenu.js';
import { requireStaff } from './requireStaff.js';

export const makeSaveSlotMenu = ({ slots, clock }) => async ({ user, slotId, menu }) => {
  requireStaff(user);

  const saved = await slots.saveMenu(slotId, normalizeMenu(menu), clock.now());
  if (saved === null) throw new NotFoundError(`Slot ${slotId} not found`);
  return describeSlotMenu(saved);
};
