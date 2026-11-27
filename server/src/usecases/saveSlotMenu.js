/**
 * Use case: the staff writes or changes the menu of a slot (MH-10). The menu replaces the one the
 * slot had, if any: when two employees save the same menu, the last one wins. A menu started from a
 * previous one is a copy, so saving it changes only this slot (SE2-Polito/AY26-27-Mountain-Hut#39,
 * and PO issue 59: changing the menu of a slot never changes the other slots with the same text).
 * The menu can be written or changed only before the slot starts (PO issue 59).
 *
 * Errors: 403 the user is not staff; 400 the menu breaks a rule (domain/menu.js); 404 the slot does
 * not exist; 422 the slot has started.
 */
import { NotFoundError } from '../domain/errors.js';
import { normalizeMenu } from '../domain/menu.js';
import { describeSlotMenu } from '../domain/slotMenu.js';
import { requireMenuOpen } from './requireMenuOpen.js';
import { requireStaff } from './requireStaff.js';

export const makeSaveSlotMenu = ({ slots, clock, hutTimeZone }) => async ({ user, slotId, menu }) => {
  requireStaff(user);
  const text = normalizeMenu(menu);

  const slot = await slots.findMenuById(slotId);
  if (slot === null) throw new NotFoundError(`Slot ${slotId} not found`);
  requireMenuOpen(slot, { clock, hutTimeZone });

  const saved = await slots.saveMenu(slotId, text, clock.now());
  if (saved === null) throw new NotFoundError(`Slot ${slotId} not found`);
  return describeSlotMenu(saved);
};
